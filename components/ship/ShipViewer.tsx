"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ShipData, ShipBay, ShipLayer } from "@/types/ship";
import ShipSvgLayer from "./ShipSvgLayer";
import ShipBayModal from "./ShipBayModal";

interface ShipViewerProps {
  ship: ShipData;
}

const ANIM_DURATION = 1400; // ms for the full 0→1 or 1→0 transition

/** Ease-in-out cubic */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function ShipViewer({ ship }: ShipViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0); // current rendered progress
  const animRef = useRef<number | null>(null); // rAF id
  const targetRef = useRef<0 | 1>(0); // where we're animating to
  const animStartRef = useRef({ time: 0, from: 0 }); // animation start state

  const [progress, setProgress] = useState(0);
  const [selectedBay, setSelectedBay] = useState<ShipBay | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<ShipLayer | null>(null);
  const [hoveredBay, setHoveredBay] = useState<string | null>(null);

  const animate = useCallback((timestamp: number) => {
    const { time: startTime, from } = animStartRef.current;
    const target = targetRef.current;
    const elapsed = timestamp - startTime;
    // Scale duration proportionally to the remaining distance
    const distance = Math.abs(target - from);
    const duration = ANIM_DURATION * distance;
    const rawT = duration > 0 ? Math.min(1, elapsed / duration) : 1;
    const easedT = easeInOutCubic(rawT);

    const value = from + (target - from) * easedT;
    progressRef.current = value;
    setProgress(value);

    if (rawT < 1) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      animRef.current = null;
    }
  }, []);

  const startAnimation = useCallback(
    (target: 0 | 1) => {
      if (targetRef.current === target) return; // already heading there
      targetRef.current = target;
      animStartRef.current = {
        time: performance.now(),
        from: progressRef.current,
      };
      if (animRef.current === null) {
        animRef.current = requestAnimationFrame(animate);
      }
    },
    [animate]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) {
        startAnimation(1);
      } else if (e.deltaY < 0) {
        startAnimation(0);
      }
    };

    // Touch support: swipe up = expand, swipe down = collapse
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const dy = touchStartY - e.changedTouches[0].clientY;
      if (dy > 30) startAnimation(1);
      else if (dy < -30) startAnimation(0);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [startAnimation]);

  const handleBayClick = useCallback((bay: ShipBay, layer: ShipLayer) => {
    setSelectedBay(bay);
    setSelectedLayer(layer);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedBay(null);
    setSelectedLayer(null);
  }, []);

  // Derived animation values
  const totalLayers = ship.layers.length;

  // Rotation: 90 (vertical) -> 15 (nose pointing right-bottom)
  const rotation = 90 - progress * 75;
  // "Spin inward" — slight perspective tilt via rotateY
  const tilt = progress * 8;
  const flatTilt = progress * 50; // rotateX to look from above
  // Size: 25vw (vertical) -> 70vw (horizontal, bigger for readability)
  const widthVw = 25 + progress * 20;
  // Fixed Z gap between layers — always there, just not visible from front
  const LAYER_Z_GAP = 200; // px between each deck in Z-space

  return (
    <>
      <div
        ref={containerRef}
        className="flex items-center justify-center"
        style={{
          height: "calc(100dvh - 4rem)",
          touchAction: "none",
        }}
      >
        {/* Ship background image — top right */}
        <img
          src="/ship/graviton_ship.png"
          alt=""
          className="absolute top-16 right-0 w-[50%] opacity-15 pointer-events-none select-none"
          style={{ maskImage: "linear-gradient(to bottom, black 40%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent)" }}
        />

        {/* Ship title */}
        <div
          className="absolute top-20 left-0 right-0 text-center z-10 pointer-events-none"
          style={{ opacity: Math.max(0, 1 - progress * 3) }}
        >
          <p
            className="text-[10px] tracking-[0.5em] text-white/30 uppercase mb-2"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            {ship.class}
          </p>
          <h1
            className="text-3xl text-white/80 font-semibold tracking-widest"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            {ship.name}
          </h1>
        </div>

        {/* Scroll hint */}
        <div
          className="absolute bottom-8 left-0 right-0 text-center z-10 pointer-events-none"
          style={{
            opacity: progress < 0.02 ? 1 : 0,
            transition: "opacity 0.4s ease-out",
          }}
        >
          <p className="text-[10px] tracking-[0.3em] text-white/25 uppercase animate-pulse">
            Scroll to explore decks
          </p>
          <svg
            className="mx-auto mt-2 text-white/20 animate-bounce"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </div>

        {/* Layer labels */}
        <div
          className="absolute left-6 top-0 bottom-0 flex flex-col justify-center z-10 pointer-events-none"
          style={{ gap: "28px" }}
        >
          {ship.layers.map((layer) => (
            <div
              key={layer.id}
              className="flex items-center gap-2"
              style={{
                opacity: Math.max(0, (progress - 0.5) * 2),
                transform: `translateX(${(1 - Math.max(0, (progress - 0.5) * 2)) * -30}px)`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: layer.color }}
              />
              <span
                className="text-[9px] tracking-[0.25em] uppercase whitespace-nowrap"
                style={{
                  color: layer.color,
                  fontFamily: "var(--font-cinzel), serif",
                }}
              >
                {layer.name}
              </span>
            </div>
          ))}
        </div>

        {/* Ship */}
        <div
          style={{
            width: `${widthVw}vw`,
            maxWidth: "900px",
            transform: `rotate(${rotation}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div
            className="relative"
            style={{
              transformStyle: "preserve-3d",
              transform: `perspective(1200px) rotateX(${flatTilt}deg) rotateY(${tilt}deg)`,
            }}
          >
            {ship.layers.map((layer, i) => {
              // Each deck at its own Z depth, centered around middle.
              // At progress=0 (front view) they overlap.
              // As rotateX increases, the Z gap is revealed.
              // Progressively increase gap for layers further from camera
              // so perspective compression doesn't make them look bunched up.
              const zPositions = [200, 80, -80, -250];
              const z = zPositions[i] ?? -i * LAYER_Z_GAP;
              // Compensate perspective size distortion so all layers
              // appear at their true size regardless of Z position.
              const perspDist = 1200;
              const scale = perspDist / (perspDist + z);

              return (
                <div
                  key={layer.id}
                  style={{
                    position: i === 0 ? "relative" : "absolute",
                    top: i === 0 ? undefined : 0,
                    left: i === 0 ? undefined : 0,
                    right: i === 0 ? undefined : 0,
                    transform: `translateZ(${z}px)`,
                  }}
                >
                  {/* Scale on inner div so it's outside the 3D/perspective context */}
                  <div style={{ transform: `scale(${scale})` }}>
                  <ShipSvgLayer
                    layer={layer}
                    layerIndex={i}
                    totalLayers={totalLayers}
                    onBayClick={handleBayClick}
                    hoveredBay={hoveredBay}
                    onBayHover={setHoveredBay}
                  />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-[2px] rounded-full"
              style={{
                height: "8px",
                backgroundColor:
                  i / 20 <= progress
                    ? "rgba(139, 92, 246, 0.6)"
                    : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>
      </div>

      <ShipBayModal
        bay={selectedBay}
        layerName={selectedLayer?.name ?? ""}
        layerColor={selectedLayer?.color ?? "#818CF8"}
        onClose={handleClose}
      />
    </>
  );
}
