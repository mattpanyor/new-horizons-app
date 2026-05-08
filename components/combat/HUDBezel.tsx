"use client";

import { useEffect, useRef, useState } from "react";

// Top + bottom HUD bezels. Each is a thin SVG line tracing the inside of the
// console frame with a chamfered notch in the middle (matching the user's
// concept sketch). The whole frame fades in on first mount with a stuttering
// "glitching" effect via the Web Animations API.
//
// Animation only runs once per mount — so the bezel re-renders smoothly after
// phase changes without repeating the glitch-in.
function GlitchInGroup({
  children,
  delayMs = 0,
}: {
  children: React.ReactNode;
  delayMs?: number;
}) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 0.45, offset: 0.12 },
        { opacity: 0.05, offset: 0.18 },
        { opacity: 0.65, offset: 0.32 },
        { opacity: 0.2, offset: 0.42 },
        { opacity: 0.85, offset: 0.55 },
        { opacity: 0.4, offset: 0.68 },
        { opacity: 1, offset: 1 },
      ],
      {
        duration: 900,
        delay: delayMs,
        easing: "linear",
        fill: "forwards",
      },
    );
    return () => anim.cancel();
  }, [delayMs]);
  return <g ref={ref} style={{ opacity: 0 }}>{children}</g>;
}

interface HUDBezelProps {
  // Thin chromatic-aberration ghost lines (red/blue offset). Adds the
  // "broken signal" feel without much cost.
  chromatic?: boolean;
}

const STROKE = "rgba(180, 220, 255, 0.55)";
const STROKE_WIDTH = 1;
const NOTCH_WIDTH_FRACTION = 0.28; // notch is this fraction of viewport width
const NOTCH_DEPTH = 64;            // how far the notch dips into the frame —
                                   // wide enough to host the End Turn button
                                   // (bottom) and the status overlay (top).
const NOTCH_CHAMFER = 22;          // diagonal taper at the notch sides
const FRAME_INSET = 6;             // padding from screen edge
const NAV_H = 64;                  // top navbar reserve

// The bezel SVG covers the viewport. Top/bottom path coordinates derive from
// the current viewport size, which lives in state so a window resize triggers
// a re-render and the paths recompute.
export default function HUDBezel({ chromatic = true }: HUDBezelProps) {
  // Default to a sensible size for SSR / first paint; the effect below
  // overwrites with the real viewport on mount and subsequent resizes.
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 1200, h: 800 });

  useEffect(() => {
    const update = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { w, h } = size;
  const topY = NAV_H + FRAME_INSET;
  const bottomY = h - FRAME_INSET;
  const cx = w / 2;
  const notchW = w * NOTCH_WIDTH_FRACTION;
  const cham = NOTCH_CHAMFER;

  // Top: horizontal line that dips DOWN by NOTCH_DEPTH in the middle.
  const topPath = [
    `M ${FRAME_INSET},${topY}`,
    `L ${cx - notchW / 2},${topY}`,
    `L ${cx - notchW / 2 + cham},${topY + NOTCH_DEPTH}`,
    `L ${cx + notchW / 2 - cham},${topY + NOTCH_DEPTH}`,
    `L ${cx + notchW / 2},${topY}`,
    `L ${w - FRAME_INSET},${topY}`,
  ].join(" ");

  // Bottom: line that dips UP in the middle.
  const bottomPath = [
    `M ${FRAME_INSET},${bottomY}`,
    `L ${cx - notchW / 2},${bottomY}`,
    `L ${cx - notchW / 2 + cham},${bottomY - NOTCH_DEPTH}`,
    `L ${cx + notchW / 2 - cham},${bottomY - NOTCH_DEPTH}`,
    `L ${cx + notchW / 2},${bottomY}`,
    `L ${w - FRAME_INSET},${bottomY}`,
  ].join(" ");

  // Side accent ticks — short verticals where the panels dock.
  const sideTopY = topY + 8;
  const sideBottomY = bottomY - 8;
  const sideX1 = FRAME_INSET;
  const sideX2 = w - FRAME_INSET;
  const sidePaths = [
    `M ${sideX1},${sideTopY} L ${sideX1},${sideBottomY}`,
    `M ${sideX2},${sideTopY} L ${sideX2},${sideBottomY}`,
  ];

  return (
    <svg
      className="fixed inset-0 z-20 pointer-events-none"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
    >
      <GlitchInGroup>
        {chromatic && (
          <>
            <path
              d={topPath}
              fill="none"
              stroke="rgba(255, 80, 80, 0.35)"
              strokeWidth={STROKE_WIDTH}
              transform="translate(-1.5, 0)"
            />
            <path
              d={topPath}
              fill="none"
              stroke="rgba(80, 180, 255, 0.35)"
              strokeWidth={STROKE_WIDTH}
              transform="translate(1.5, 0)"
            />
          </>
        )}
        <path d={topPath} fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
      </GlitchInGroup>

      <GlitchInGroup delayMs={120}>
        {chromatic && (
          <>
            <path
              d={bottomPath}
              fill="none"
              stroke="rgba(255, 80, 80, 0.35)"
              strokeWidth={STROKE_WIDTH}
              transform="translate(-1.5, 0)"
            />
            <path
              d={bottomPath}
              fill="none"
              stroke="rgba(80, 180, 255, 0.35)"
              strokeWidth={STROKE_WIDTH}
              transform="translate(1.5, 0)"
            />
          </>
        )}
        <path d={bottomPath} fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
      </GlitchInGroup>

      <GlitchInGroup delayMs={240}>
        {sidePaths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={STROKE}
            strokeWidth={STROKE_WIDTH}
          />
        ))}
      </GlitchInGroup>
    </svg>
  );
}
