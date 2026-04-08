"use client";

import { useEffect, useRef, useState } from "react";

// ─── Configurable colors ───

export interface HexShieldColors {
  fill: [number, number, number];   // RGB for hex fill
  edge: [number, number, number];   // RGB for hex edges
}

const DEFAULT_COLORS: HexShieldColors = {
  fill: [210, 145, 50],
  edge: [240, 185, 85],
};

// ─── Types ───

interface Hex {
  cx: number; cy: number;
  baseOpacity: number;
  verts: { x: number; y: number }[];
}

interface Ripple {
  cx: number; cy: number;
  radius: number;
  speed: number;
  maxRadius: number;
  width: number;
}

interface Flicker {
  hexIdx: number;
  life: number;
  decay: number;
}

// ─── Hex grid generation ───

const HEX_R = 18;

function generateHexGrid(w: number, h: number): Hex[] {
  const hexes: Hex[] = [];
  const colW = HEX_R * 1.5;
  const rowH = HEX_R * Math.sqrt(3);

  for (let col = -1; col * colW < w + HEX_R * 2; col++) {
    const cx = col * colW;
    const offsetY = col % 2 === 0 ? 0 : rowH / 2;
    for (let row = -1; row * rowH + offsetY < h + HEX_R * 2; row++) {
      const cy = row * rowH + offsetY;
      const verts: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        verts.push({
          x: cx + HEX_R * Math.cos(angle),
          y: cy + HEX_R * Math.sin(angle),
        });
      }
      hexes.push({
        cx, cy,
        baseOpacity: 0.02 + Math.random() * 0.08,
        verts,
      });
    }
  }
  return hexes;
}

// ─── Component ───

interface HexShieldAnimationProps {
  colors?: HexShieldColors;
}

export default function HexShieldAnimation({ colors = DEFAULT_COLORS }: HexShieldAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const spread = !!(e as CustomEvent).detail?.spread;
      hiddenRef.current = spread;
      setHidden(spread);
    };
    window.addEventListener("ship-spread", handler);
    return () => window.removeEventListener("ship-spread", handler);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0 || dims.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = dims.w;
    const H = dims.h;
    const SIZE = Math.min(W, H);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const hexArr = generateHexGrid(W, H);
    const glow = new Float32Array(hexArr.length);
    const rippleList: Ripple[] = [];
    const flickerList: Flicker[] = [];
    let animFrame = 0;

    const [fr, fg, fb] = colors.fill;
    const [er, eg, eb] = colors.edge;

    // Scale ripple sizes to canvas
    const rippleMaxBase = SIZE * 0.16;
    const rippleMaxRange = SIZE * 0.24;
    const rippleWidthBase = SIZE * 0.05;
    const rippleWidthRange = SIZE * 0.04;
    const rippleSpeedBase = 0.8;
    const rippleSpeedRange = 0.8;

    function draw() {
      if (!ctx) return;

      if (hiddenRef.current) {
        animFrame = requestAnimationFrame(draw);
        return;
      }

      // Spawn ripples (rare)
      if (Math.random() < 0.005) {
        rippleList.push({
          cx: Math.random() * W,
          cy: Math.random() * H,
          radius: 0,
          speed: rippleSpeedBase + Math.random() * rippleSpeedRange,
          maxRadius: rippleMaxBase + Math.random() * rippleMaxRange,
          width: rippleWidthBase + Math.random() * rippleWidthRange,
        });
      }

      // Spawn flickers (rare)
      if (Math.random() < 0.04) {
        flickerList.push({
          hexIdx: Math.floor(Math.random() * hexArr.length),
          life: 0.6 + Math.random() * 0.4,
          decay: 0.015 + Math.random() * 0.02,
        });
      }

      // Advance ripples
      for (let i = rippleList.length - 1; i >= 0; i--) {
        rippleList[i].radius += rippleList[i].speed;
        if (rippleList[i].radius > rippleList[i].maxRadius) {
          rippleList.splice(i, 1);
        }
      }

      // Advance flickers
      for (let i = flickerList.length - 1; i >= 0; i--) {
        flickerList[i].life -= flickerList[i].decay;
        if (flickerList[i].life <= 0) {
          flickerList.splice(i, 1);
        }
      }

      // Compute glow per hex
      for (let i = 0; i < hexArr.length; i++) {
        const hex = hexArr[i];
        let target = 0;

        for (const r of rippleList) {
          const dist = Math.hypot(hex.cx - r.cx, hex.cy - r.cy);
          const distFromRing = Math.abs(dist - r.radius);
          if (distFromRing < r.width) {
            const ringIntensity = 1 - distFromRing / r.width;
            const ageFade = 1 - r.radius / r.maxRadius;
            target = Math.max(target, ringIntensity * ageFade);
          }
        }

        for (const f of flickerList) {
          if (f.hexIdx === i) {
            target = Math.max(target, f.life);
          }
        }

        if (target > glow[i]) {
          glow[i] += (target - glow[i]) * 0.3;
        } else {
          glow[i] += (target - glow[i]) * 0.06;
        }
      }

      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < hexArr.length; i++) {
        const hex = hexArr[i];
        const glowAlpha = glow[i] * 0.7;
        if (glowAlpha < 0.01) continue;

        ctx.beginPath();
        ctx.moveTo(hex.verts[0].x, hex.verts[0].y);
        for (let v = 1; v < 6; v++) {
          ctx.lineTo(hex.verts[v].x, hex.verts[v].y);
        }
        ctx.closePath();

        ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${glowAlpha * 0.3})`;
        ctx.fill();

        if (glowAlpha > 0.02) {
          ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, ${glowAlpha * 0.7})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      animFrame = requestAnimationFrame(draw);
    }

    animFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame);
  }, [dims, colors]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${hidden ? "opacity-0" : "opacity-100"}`}
    >
      <canvas
        ref={canvasRef}
        style={{ width: dims.w, height: dims.h }}
      />
    </div>
  );
}
