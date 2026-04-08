"use client";

import { useEffect, useRef, useState } from "react";

// ─── Ship name generator ───

const NAME_PREFIXES = [
  "Star", "Nova", "Void", "Nebula", "Astral", "Cosmic", "Solar", "Lunar",
  "Iron", "Silver", "Ghost", "Shadow", "Storm", "Thunder", "Crystal", "Dark",
  "Dawn", "Dusk", "Crimson", "Obsidian", "Radiant", "Silent", "Swift", "Pale",
];
const NAME_SUFFIXES = [
  "Runner", "Drifter", "Seeker", "Walker", "Dancer", "Striker", "Voyager",
  "Hawk", "Serpent", "Fang", "Blade", "Lance", "Arrow", "Phantom", "Wraith",
  "Herald", "Warden", "Strider", "Prowler", "Viper", "Talon", "Specter",
];

function randomShipName(): string {
  const pre = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const suf = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  return `${pre} ${suf}`;
}

// ─── Types ───

interface SpotState {
  x: number; y: number;
  rx: number; ry: number;
  angle: number;
}

interface JumpFx {
  x: number; y: number;
  frame: number;
  maxFrames: number;
  streaks: number[];
  rippleSpeed: number;
}

type Phase = "trailing" | "jump-out" | "spotlight-move" | "jump-in";

interface TravelerState {
  x: number; y: number;
  targetX: number; targetY: number;
  trail: { x: number; y: number }[];
  stepsLeft: number;
  stepsTotal: number;
  visited: Set<string>;
  phase: Phase;
  destX: number; destY: number;
  jumpInX: number; jumpInY: number;
  jumpOriginX: number; jumpOriginY: number;
  visible: boolean;
  shipName: string;
}

// ─── Helpers ───

const DOT_SPACING = 16;
const DOT_RADIUS = 1;
const SHOW_LABEL = true;

function getIntensity(x: number, y: number, s: SpotState): number {
  const dx = x - s.x;
  const dy = y - s.y;
  const nd = Math.sqrt((dx * dx) / (s.rx * s.rx) + (dy * dy) / (s.ry * s.ry));
  const intensity = Math.max(0, 1 - nd);
  return intensity * intensity;
}

// ─── Types ───

export interface ExclusionZone {
  /** Percentage-based position and size (0-100) relative to the container */
  x: number;      // left edge %
  y: number;      // top edge %
  width: number;  // width %
  height: number; // height %
}

interface DotGridAnimationProps {
  exclusionZones?: ExclusionZone[];
}

// ─── Component ───

export default function DotGridAnimation({ exclusionZones = [] }: DotGridAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Observe container size
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

  // Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0 || dims.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = dims.w;
    const H = dims.h;
    const SIZE = Math.min(W, H); // for proportional calculations
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const SPEED = 0.7;
    const TRAIL_MAX = Math.ceil((DOT_SPACING * 1.5) / SPEED);
    const MARGIN_X = W * 0.125;
    const MARGIN_Y = H * 0.125;
    const MIN_X = MARGIN_X;
    const MAX_X = W - MARGIN_X;
    const MIN_Y = MARGIN_Y;
    const MAX_Y = H - MARGIN_Y;
    const SPOT_SIZE = SIZE * 0.26;

    const dk = (x: number, y: number) => `${x},${y}`;
    // Convert percentage-based exclusion zones to pixel rects
    const pixelZones = exclusionZones.map((z) => ({
      left: (z.x / 100) * W,
      top: (z.y / 100) * H,
      right: ((z.x + z.width) / 100) * W,
      bottom: ((z.y + z.height) / 100) * H,
    }));

    const inExclusionZone = (x: number, y: number) =>
      pixelZones.some((z) => x >= z.left && x <= z.right && y >= z.top && y <= z.bottom);

    const inBounds = (x: number, y: number) =>
      x >= MIN_X && x <= MAX_X && y >= MIN_Y && y <= MAX_Y && !inExclusionZone(x, y);

    const GRID_COLS = Math.floor((W - DOT_SPACING) / DOT_SPACING);
    const GRID_ROWS = Math.floor((H - DOT_SPACING) / DOT_SPACING);

    const spot: SpotState = {
      x: W / 2, y: H / 2,
      rx: SPOT_SIZE, ry: SPOT_SIZE,
      angle: 0,
    };

    const traveler: TravelerState = {
      x: W / 2, y: H / 2, targetX: W / 2, targetY: H / 2,
      trail: [], stepsLeft: 5, stepsTotal: 5, visited: new Set(),
      phase: "trailing", destX: W / 2, destY: H / 2,
      jumpInX: W / 2, jumpInY: H / 2,
      jumpOriginX: W / 2, jumpOriginY: H / 2,
      visible: true, shipName: randomShipName(),
    };

    let jumpFx: JumpFx | null = null;
    let animFrame = 0;

    function pickNeighbor() {
      const gx = Math.round(traveler.x / DOT_SPACING) * DOT_SPACING;
      const gy = Math.round(traveler.y / DOT_SPACING) * DOT_SPACING;
      traveler.visited.add(dk(gx, gy));
      const neighbors = [
        { x: gx + DOT_SPACING, y: gy },
        { x: gx - DOT_SPACING, y: gy },
        { x: gx, y: gy + DOT_SPACING },
        { x: gx, y: gy - DOT_SPACING },
      ].filter((p) => inBounds(p.x, p.y) && !traveler.visited.has(dk(p.x, p.y)));
      if (neighbors.length === 0) {
        traveler.stepsLeft = 0;
        return;
      }
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      traveler.targetX = pick.x;
      traveler.targetY = pick.y;
    }

    function startJump() {
      const streaks: number[] = [];
      const numStreaks = 6 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numStreaks; i++) streaks.push(Math.random() * Math.PI * 2);
      jumpFx = { x: traveler.x, y: traveler.y, frame: 0, maxFrames: 60, streaks, rippleSpeed: 3 };

      const areaW = MAX_X - MIN_X;
      const areaH = MAX_Y - MIN_Y;
      const angle = Math.random() * Math.PI * 2;
      let rawX = traveler.x + Math.cos(angle) * areaW * 0.5;
      let rawY = traveler.y + Math.sin(angle) * areaH * 0.5;

      const wrap = (v: number, min: number, max: number) => {
        const range = max - min;
        let r = ((v - min) % range);
        if (r < 0) r += range;
        return min + r;
      };
      rawX = wrap(rawX, MIN_X, MAX_X);
      rawY = wrap(rawY, MIN_Y, MAX_Y);

      let destX = Math.max(MIN_X, Math.min(MAX_X, Math.round(rawX / DOT_SPACING) * DOT_SPACING));
      let destY = Math.max(MIN_Y, Math.min(MAX_Y, Math.round(rawY / DOT_SPACING) * DOT_SPACING));

      // If destination lands in an exclusion zone, nudge it out
      let attempts = 0;
      while (inExclusionZone(destX, destY) && attempts < 20) {
        destX += DOT_SPACING;
        if (destX > MAX_X) { destX = MIN_X; destY += DOT_SPACING; }
        if (destY > MAX_Y) destY = MIN_Y;
        attempts++;
      }

      traveler.destX = destX;
      traveler.destY = destY;
      traveler.jumpOriginX = traveler.x;
      traveler.jumpOriginY = traveler.y;
      traveler.visible = false;
      traveler.trail = [];
      traveler.phase = "jump-out";
    }

    function prepareArrival() {
      const areaSize = Math.min(MAX_X - MIN_X, MAX_Y - MIN_Y);
      const offset = Math.max(DOT_SPACING * 3, Math.round(areaSize * 0.15 / DOT_SPACING) * DOT_SPACING);
      const dirs = [
        { x: offset, y: 0 }, { x: -offset, y: 0 },
        { x: 0, y: offset }, { x: 0, y: -offset },
      ];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      traveler.jumpInX = traveler.destX + dir.x;
      traveler.jumpInY = traveler.destY + dir.y;
      traveler.x = traveler.jumpInX;
      traveler.y = traveler.jumpInY;
      traveler.targetX = traveler.destX;
      traveler.targetY = traveler.destY;
      traveler.stepsTotal = 8 + Math.floor(Math.random() * 3);
      traveler.stepsLeft = traveler.stepsTotal;
      const backX = traveler.destX + (traveler.destX - traveler.jumpInX);
      const backY = traveler.destY + (traveler.destY - traveler.jumpInY);
      traveler.visited = new Set([dk(backX, backY)]);
      traveler.trail = [];
      traveler.shipName = randomShipName();
    }

    // Init
    traveler.stepsTotal = 8 + Math.floor(Math.random() * 3);
    traveler.stepsLeft = traveler.stepsTotal;
    pickNeighbor();

    const JUMP_IN_SPEED = SPEED * 8;
    const SPOT_CHASE_SPEED = 0.03;

    function draw() {
      if (!ctx) return;
      const t = traveler;
      const s = spot;
      const fx = jumpFx;

      // Phase logic
      if (t.phase === "trailing") {
        const dx = t.targetX - t.x;
        const dy = t.targetY - t.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= SPEED) {
          t.x = t.targetX; t.y = t.targetY;
          t.stepsLeft--;
          if (t.stepsLeft <= 0) startJump();
          else pickNeighbor();
        } else {
          t.x += (dx / dist) * SPEED;
          t.y += (dy / dist) * SPEED;
        }
        t.trail.push({ x: t.x, y: t.y });
        if (t.trail.length > TRAIL_MAX) t.trail.shift();
        s.x += (t.x - s.x) * SPOT_CHASE_SPEED;
        s.y += (t.y - s.y) * SPOT_CHASE_SPEED;
      } else if (t.phase === "jump-out") {
        if (!fx || fx.frame >= fx.maxFrames) {
          t.phase = "spotlight-move";
          prepareArrival();
        }
      } else if (t.phase === "spotlight-move") {
        s.x += (t.destX - s.x) * SPOT_CHASE_SPEED;
        s.y += (t.destY - s.y) * SPOT_CHASE_SPEED;
        if (Math.hypot(s.x - t.destX, s.y - t.destY) < 30) {
          t.phase = "jump-in";
          t.visible = true;
        }
      } else if (t.phase === "jump-in") {
        const dx = t.targetX - t.x;
        const dy = t.targetY - t.y;
        const dist = Math.hypot(dx, dy);
        const totalDist = Math.hypot(t.destX - t.jumpInX, t.destY - t.jumpInY);
        const progress = 1 - (dist / (totalDist || 1));
        const curSpeed = Math.max(SPEED * 0.5, JUMP_IN_SPEED * (1 - progress * progress));
        if (dist <= curSpeed) {
          t.x = t.targetX; t.y = t.targetY;
          t.phase = "trailing";
          pickNeighbor();
        } else {
          t.x += (dx / dist) * curSpeed;
          t.y += (dy / dist) * curSpeed;
        }
        t.trail.push({ x: t.x, y: t.y });
        if (t.trail.length > TRAIL_MAX) t.trail.shift();
        s.x += (t.x - s.x) * SPOT_CHASE_SPEED;
        s.y += (t.y - s.y) * SPOT_CHASE_SPEED;
      }

      s.rx = SPOT_SIZE;
      s.ry = SPOT_SIZE;

      ctx.clearRect(0, 0, W, H);

      // Dots with ripple
      const rippleRadius = fx ? fx.frame * fx.rippleSpeed : 0;
      const rippleWidth = SIZE * 0.08;

      for (let x = DOT_SPACING; x < W; x += DOT_SPACING) {
        for (let y = DOT_SPACING; y < H; y += DOT_SPACING) {
          let drawX = x;
          let drawY = y;

          if (fx) {
            const dxR = x - fx.x;
            const dyR = y - fx.y;
            const distR = Math.hypot(dxR, dyR);
            if (distR > 0) {
              const distFromWave = Math.abs(distR - rippleRadius);
              if (distFromWave < rippleWidth) {
                const waveFactor = 1 - distFromWave / rippleWidth;
                const timeFade = 1 - fx.frame / fx.maxFrames;
                const displacement = waveFactor * timeFade * 6;
                const oscillation = Math.sin(waveFactor * Math.PI * 3) * timeFade;
                const totalDisp = displacement + oscillation * 2;
                drawX += (dxR / distR) * totalDisp;
                drawY += (dyR / distR) * totalDisp;
              }
            }
          }

          const eased = getIntensity(x, y, s);
          const alpha = eased * 0.8;
          if (alpha < 0.01) continue;

          ctx.beginPath();
          ctx.arc(drawX, drawY, DOT_RADIUS + eased * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(140, 140, 140, ${alpha})`;
          ctx.fill();
        }
      }

      // Corner dots
      const isJumpPhase = t.phase === "jump-out" || t.phase === "spotlight-move";
      const anchorX = isJumpPhase ? t.jumpOriginX : t.x;
      const anchorY = isJumpPhase ? t.jumpOriginY : t.y;
      const gx = Math.round(anchorX / DOT_SPACING) * DOT_SPACING;
      const gy = Math.round(anchorY / DOT_SPACING) * DOT_SPACING;
      const corners = [
        { x: gx - DOT_SPACING, y: gy - DOT_SPACING },
        { x: gx + DOT_SPACING, y: gy - DOT_SPACING },
        { x: gx - DOT_SPACING, y: gy + DOT_SPACING },
        { x: gx + DOT_SPACING, y: gy + DOT_SPACING },
      ];

      for (const c of corners) {
        const cI = getIntensity(c.x, c.y, s);
        if (isJumpPhase) {
          if (cI < 0.05) continue;
          const pulse = 0.4 + Math.sin((fx ? fx.frame : 0) * 0.3) * 0.3;
          ctx.beginPath();
          ctx.arc(c.x, c.y, DOT_RADIUS + 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 60, 60, ${pulse * cI})`;
          ctx.fill();
        } else if (t.phase === "trailing" || t.phase === "jump-in") {
          const alpha = Math.max(0.15, cI * 0.6);
          ctx.beginPath();
          ctx.arc(c.x, c.y, DOT_RADIUS + 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(80, 200, 80, ${alpha})`;
          ctx.fill();
        }
      }

      // Trail and head
      if (t.visible) {
        for (let i = 0; i < t.trail.length; i++) {
          const p = t.trail[i];
          const pI = getIntensity(p.x, p.y, s);
          if (pI < 0.05) continue;
          const age = (i + 1) / t.trail.length;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 220, 220, ${age * pI * 0.9})`;
          ctx.fill();
        }

        const hI = getIntensity(t.x, t.y, s);
        if (hI >= 0.05) {
          const ds = 3.5;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y - ds);
          ctx.lineTo(t.x + ds, t.y);
          ctx.lineTo(t.x, t.y + ds);
          ctx.lineTo(t.x - ds, t.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(220, 220, 220, ${hI * 0.9})`;
          ctx.fill();

          if (SHOW_LABEL && t.phase === "trailing") {
            ctx.font = '7px "Cinzel", serif';
            ctx.textAlign = "center";
            ctx.fillStyle = `rgba(255, 255, 255, ${hI * 0.6})`;
            ctx.letterSpacing = "2px";
            ctx.fillText(t.shipName.toUpperCase(), t.x, t.y - 8);
            ctx.letterSpacing = "0px";
          }
        }
      }

      // Jump FX
      if (fx) {
        fx.frame++;
        const progress = fx.frame / fx.maxFrames;
        const fade = 1 - progress;

        const ringRadius = progress * 35;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 200, 220, ${fade * 0.6})`;
        ctx.lineWidth = 1.5 * fade;
        ctx.stroke();

        if (progress < 0.3) {
          const flashAlpha = (1 - progress / 0.3) * 0.5;
          const flashR = progress * 12;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, flashR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 220, 240, ${flashAlpha})`;
          ctx.fill();
        }

        for (const angle of fx.streaks) {
          const innerR = progress * 8;
          const outerR = progress * 30 + 5;
          ctx.beginPath();
          ctx.moveTo(fx.x + Math.cos(angle) * innerR, fx.y + Math.sin(angle) * innerR);
          ctx.lineTo(fx.x + Math.cos(angle) * outerR, fx.y + Math.sin(angle) * outerR);
          ctx.strokeStyle = `rgba(180, 180, 200, ${fade * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (fx.frame >= fx.maxFrames) jumpFx = null;
      }

      animFrame = requestAnimationFrame(draw);
    }

    animFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame);
  }, [dims, exclusionZones]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <canvas
        ref={canvasRef}
        style={{ width: dims.w, height: dims.h }}
      />
    </div>
  );
}
