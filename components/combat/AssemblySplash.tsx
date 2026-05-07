"use client";

import { useEffect, useRef, useState } from "react";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface AssemblySplashProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
}

const NUM_PARTICLES = 240;
const SCATTER_DURATION = 60;   // ~1 s
const ASSEMBLE_DURATION = 180; // ~3 s

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  size: number;
}

// Fullscreen splash that runs the particle-assembly animation from /test
// (Type 9). Fades out gracefully when `visible` flips false; unmounts after
// the fade so it stops consuming a render-loop frame.
//
// Visibility for combat is gated by the parent — see SpaceCombatBoard:
//   show while initial 3D scene is loading, AND for non-GM users until the
//   GM has ended their first turn (moveCount → 1).
export default function AssemblySplash({
  visible,
  title = "Initializing Combat Systems",
  subtitle,
}: AssemblySplashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(visible);
  const [fadingOut, setFadingOut] = useState(false);

  // Visibility transition manager — uses prev-prop pattern to avoid setState
  // in render. The actual unmount-after-fade timeout still uses useEffect
  // (acceptable since it's an async timer event, not a synchronous setState).
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) {
      setShouldRender(true);
      setFadingOut(false);
    } else {
      setFadingOut(true);
    }
  }
  useEffect(() => {
    if (!fadingOut) return;
    const t = window.setTimeout(() => setShouldRender(false), 700);
    return () => window.clearTimeout(t);
  }, [fadingOut]);

  // Particle animation loop.
  useEffect(() => {
    if (!shouldRender) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // The splash sits below the 64px navbar — canvas dimensions reflect the
    // visible region (viewport height minus navbar) so particles stay inside.
    const NAV_H = 64;
    let w = window.innerWidth;
    let h = Math.max(0, window.innerHeight - NAV_H);

    const setupCanvas = () => {
      w = window.innerWidth;
      h = Math.max(0, window.innerHeight - NAV_H);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    setupCanvas();
    window.addEventListener("resize", setupCanvas);

    const cx = () => w / 2;
    const cy = () => h / 2;
    const R = () => Math.min(w, h) * 0.25;

    const particles: Particle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        targetX: 0,
        targetY: 0,
        size: 1 + Math.random() * 1.5,
      });
    }

    const buildPatterns = () => {
      const r = R();
      const cxv = cx();
      const cyv = cy();

      // Hex
      const hexTargets: { x: number; y: number }[] = [];
      const hexVerts: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        hexVerts.push({ x: cxv + Math.cos(a) * r, y: cyv + Math.sin(a) * r });
      }
      const perSide = Math.floor(NUM_PARTICLES / 6);
      for (let i = 0; i < 6; i++) {
        const v1 = hexVerts[i];
        const v2 = hexVerts[(i + 1) % 6];
        for (let s = 0; s < perSide; s++) {
          const t = s / perSide;
          hexTargets.push({
            x: v1.x + (v2.x - v1.x) * t,
            y: v1.y + (v2.y - v1.y) * t,
          });
        }
      }

      // Circle
      const circleTargets: { x: number; y: number }[] = [];
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const a = (i / NUM_PARTICLES) * Math.PI * 2;
        circleTargets.push({ x: cxv + Math.cos(a) * r, y: cyv + Math.sin(a) * r });
      }

      // Diamond
      const diamondTargets: { x: number; y: number }[] = [];
      const dverts = [
        { x: cxv, y: cyv - r },
        { x: cxv + r, y: cyv },
        { x: cxv, y: cyv + r },
        { x: cxv - r, y: cyv },
      ];
      const perDSide = Math.floor(NUM_PARTICLES / 4);
      for (let i = 0; i < 4; i++) {
        const v1 = dverts[i];
        const v2 = dverts[(i + 1) % 4];
        for (let s = 0; s < perDSide; s++) {
          const t = s / perDSide;
          diamondTargets.push({
            x: v1.x + (v2.x - v1.x) * t,
            y: v1.y + (v2.y - v1.y) * t,
          });
        }
      }
      // Hex first (ship lock-on grid feel), then circle (scan), then diamond.
      return [hexTargets, circleTargets, diamondTargets];
    };

    let patterns = buildPatterns();

    let phase: "scatter" | "assemble" = "scatter";
    let phaseTimer = 0;
    let currentPattern = 0;

    const assignTargets = () => {
      const targets = patterns[currentPattern % patterns.length];
      const cxv = cx();
      const cyv = cy();
      const indexed = particles.map((p, i) => ({
        i,
        angle: Math.atan2(p.y - cyv, p.x - cxv),
      }));
      indexed.sort((a, b) => a.angle - b.angle);
      const sortedTargets = [...targets].sort(
        (a, b) =>
          Math.atan2(a.y - cyv, a.x - cxv) - Math.atan2(b.y - cyv, b.x - cxv),
      );
      for (let j = 0; j < indexed.length; j++) {
        const t = sortedTargets[j % sortedTargets.length];
        particles[indexed[j].i].targetX = t.x;
        particles[indexed[j].i].targetY = t.y;
      }
    };
    assignTargets();

    let raf = 0;
    const draw = () => {
      phaseTimer++;
      if (phase === "scatter" && phaseTimer > SCATTER_DURATION) {
        phase = "assemble";
        phaseTimer = 0;
        currentPattern++;
        // Rebuild in case the viewport resized (cheap).
        patterns = buildPatterns();
        assignTargets();
      } else if (phase === "assemble" && phaseTimer > ASSEMBLE_DURATION) {
        phase = "scatter";
        phaseTimer = 0;
      }

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        if (phase === "assemble") {
          p.vx += (p.targetX - p.x) * 0.02;
          p.vy += (p.targetY - p.y) * 0.02;
          p.vx *= 0.9;
          p.vy *= 0.9;
        } else {
          p.vx += (Math.random() - 0.5) * 0.3;
          p.vy += (Math.random() - 0.5) * 0.3;
          p.vx *= 0.98;
          p.vy *= 0.98;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x += w;
        if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h;
        if (p.y > h) p.y -= h;

        const dx = p.x - p.targetX;
        const dy = p.y - p.targetY;
        const distToTarget = Math.hypot(dx, dy);
        const lockedness =
          phase === "assemble" ? Math.max(0, 1 - distToTarget / 50) : 0;
        const alpha = 0.2 + lockedness * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
        ctx.fill();

        if (lockedness > 0.5 && phase === "assemble") {
          for (const p2 of particles) {
            const d = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (d > 0 && d < 30) {
              const d2 = Math.hypot(p2.x - p2.targetX, p2.y - p2.targetY);
              const lock2 = Math.max(0, 1 - d2 / 50);
              if (lock2 > 0.5) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(100, 180, 255, ${
                  lockedness * lock2 * 0.15
                })`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
            }
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setupCanvas);
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed left-0 right-0 bottom-0 top-16 z-50 bg-black flex flex-col items-center justify-center transition-opacity duration-700"
      style={{
        opacity: fadingOut ? 0 : 1,
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
        <p
          className="text-base md:text-lg tracking-[0.5em] uppercase text-white/85"
          style={cinzel}
        >
          {title}
        </p>
        {subtitle && (
          <p
            className="text-xs tracking-[0.35em] uppercase text-white/40"
            style={cinzel}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
