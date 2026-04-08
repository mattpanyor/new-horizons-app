"use client";

import { useEffect, useRef, useState } from "react";

// ─── Shared types & helpers ───

interface SpotState {
  x: number; y: number;
  targetX: number; targetY: number;
  rx: number; ry: number;
  targetRx: number; targetRy: number;
  angle: number; targetAngle: number;
}

interface Traveler {
  x: number; y: number;
  targetX: number; targetY: number;
  edges: { x: number; y: number }[];
}

const SIZE = 500;
const DOT_SPACING = 16;
const DOT_RADIUS = 1;
const GRID_COLS = Math.floor((SIZE - DOT_SPACING) / DOT_SPACING);
const GRID_ROWS = Math.floor((SIZE - DOT_SPACING) / DOT_SPACING);

function initSpot(): SpotState {
  return {
    x: 250, y: 250, targetX: 250, targetY: 250,
    rx: SIZE * 0.26, ry: SIZE * 0.26, targetRx: SIZE * 0.26, targetRy: SIZE * 0.26,
    angle: 0, targetAngle: 0,
  };
}

function pickSpotTarget(s: SpotState) {
  s.targetX = -40 + Math.random() * (SIZE + 80);
  s.targetY = -40 + Math.random() * (SIZE + 80);
  const base = SIZE * 0.2 + Math.random() * SIZE * 0.12;
  const stretch = 0.5 + Math.random() * 0.5;
  s.targetRx = base;
  s.targetRy = base * stretch;
  s.targetAngle = Math.random() * Math.PI;
}

function stepSpot(s: SpotState) {
  s.x += (s.targetX - s.x) * 0.008;
  s.y += (s.targetY - s.y) * 0.008;
  s.rx += (s.targetRx - s.rx) * 0.008;
  s.ry += (s.targetRy - s.ry) * 0.008;
  s.angle += (s.targetAngle - s.angle) * 0.008;
  if (Math.hypot(s.targetX - s.x, s.targetY - s.y) < 20) pickSpotTarget(s);
}

function getIntensity(x: number, y: number, s: SpotState, cosA: number, sinA: number): number {
  const dx = x - s.x;
  const dy = y - s.y;
  const lx = dx * cosA - dy * sinA;
  const ly = dx * sinA + dy * cosA;
  const nd = Math.sqrt((lx * lx) / (s.rx * s.rx) + (ly * ly) / (s.ry * s.ry));
  const intensity = Math.max(0, 1 - nd);
  return intensity * intensity;
}

function drawDots(ctx: CanvasRenderingContext2D, s: SpotState, cosA: number, sinA: number) {
  for (let x = DOT_SPACING; x < SIZE; x += DOT_SPACING) {
    for (let y = DOT_SPACING; y < SIZE; y += DOT_SPACING) {
      const eased = getIntensity(x, y, s, cosA, sinA);
      const alpha = eased * 0.8;
      if (alpha < 0.01) continue;
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS + eased * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(140, 140, 140, ${alpha})`;
      ctx.fill();
    }
  }
}

function initTravelers(count: number): Traveler[] {
  const allDots: { x: number; y: number }[] = [];
  for (let gx = 1; gx <= GRID_COLS; gx++) {
    for (let gy = 1; gy <= GRID_ROWS; gy++) {
      allDots.push({ x: gx * DOT_SPACING, y: gy * DOT_SPACING });
    }
  }
  for (let i = allDots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allDots[i], allDots[j]] = [allDots[j], allDots[i]];
  }
  return allDots.slice(0, count).map((d) => ({
    x: d.x, y: d.y, targetX: d.x, targetY: d.y, edges: [{ x: d.x, y: d.y }],
  }));
}

const SAMPLE_IMAGE = "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/exploratorium_logo.png";

const boxOuterStyle = {
  width: SIZE,
  height: SIZE,
  borderRadius: 36,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 2px 40px rgba(0,0,0,0.5)",
  overflow: "hidden" as const,
  position: "relative" as const,
};

// ─── Animation Type 1: Spotlight only ───

function useAnimSpotlight(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);
  const spot = useRef<SpotState>(initSpot());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    pickSpotTarget(spot.current);

    function draw() {
      if (!ctx) return;
      const s = spot.current;
      stepSpot(s);
      const cosA = Math.cos(-s.angle);
      const sinA = Math.sin(-s.angle);
      ctx.clearRect(0, 0, SIZE, SIZE);
      drawDots(ctx, s, cosA, sinA);
      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

// ─── Animation Type 2: Spotlight + Travelers ───

function useAnimTravelers(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);
  const spot = useRef<SpotState>(initSpot());
  const travelers = useRef<Traveler[]>(initTravelers(50));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    pickSpotTarget(spot.current);

    const TRAVELER_SPEED = 1.2;
    const MIN_DIST = DOT_SPACING * 2;

    function isTooClose(px: number, py: number, self: Traveler): boolean {
      for (const other of travelers.current) {
        if (other === self) continue;
        if (Math.hypot(px - other.x, py - other.y) < MIN_DIST) return true;
        if (Math.hypot(px - other.targetX, py - other.targetY) < MIN_DIST) return true;
      }
      return false;
    }

    function pickTravelerTarget(t: Traveler) {
      const gx = Math.round(t.x / DOT_SPACING) * DOT_SPACING;
      const gy = Math.round(t.y / DOT_SPACING) * DOT_SPACING;
      const prev = t.edges.length >= 2 ? t.edges[t.edges.length - 2] : null;
      const neighbors = [
        { x: gx + DOT_SPACING, y: gy },
        { x: gx - DOT_SPACING, y: gy },
        { x: gx, y: gy + DOT_SPACING },
        { x: gx, y: gy - DOT_SPACING },
      ].filter(
        (p) => p.x > 0 && p.x < SIZE && p.y > 0 && p.y < SIZE &&
          !(prev && p.x === prev.x && p.y === prev.y) &&
          !isTooClose(p.x, p.y, t)
      );
      if (neighbors.length > 0) {
        const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
        t.targetX = pick.x;
        t.targetY = pick.y;
      }
    }

    function draw() {
      if (!ctx) return;
      const s = spot.current;
      stepSpot(s);
      const cosA = Math.cos(-s.angle);
      const sinA = Math.sin(-s.angle);

      // Move travelers
      for (const t of travelers.current) {
        const dx = t.targetX - t.x;
        const dy = t.targetY - t.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= TRAVELER_SPEED) {
          t.x = t.targetX;
          t.y = t.targetY;
          const last = t.edges[t.edges.length - 1];
          if (!last || last.x !== t.targetX || last.y !== t.targetY) {
            t.edges.push({ x: t.targetX, y: t.targetY });
            if (t.edges.length > 4) t.edges.shift();
          }
          pickTravelerTarget(t);
        } else {
          t.x += (dx / dist) * TRAVELER_SPEED;
          t.y += (dy / dist) * TRAVELER_SPEED;
        }
      }

      ctx.clearRect(0, 0, SIZE, SIZE);
      drawDots(ctx, s, cosA, sinA);

      // Draw travelers
      for (const t of travelers.current) {
        const edges = t.edges;
        for (let i = 0; i < edges.length - 1; i++) {
          const a = edges[i];
          const b = edges[i + 1];
          const aI = getIntensity(a.x, a.y, s, cosA, sinA);
          const bI = getIntensity(b.x, b.y, s, cosA, sinA);
          const eI = Math.min(aI, bI);
          if (eI < 0.05) continue;
          const age = (i + 1) / (edges.length - 1);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(200, 200, 200, ${age * eI * 0.8})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (edges.length > 0) {
          const last = edges[edges.length - 1];
          const lI = getIntensity(last.x, last.y, s, cosA, sinA);
          const hI = getIntensity(t.x, t.y, s, cosA, sinA);
          const cI = Math.min(lI, hI);
          if (cI >= 0.05) {
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(t.x, t.y);
            ctx.strokeStyle = `rgba(220, 220, 220, ${cI * 0.9})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          if (hI >= 0.05) {
            const ds = 2.5;
            ctx.beginPath();
            ctx.moveTo(t.x, t.y - ds);
            ctx.lineTo(t.x + ds, t.y);
            ctx.lineTo(t.x, t.y + ds);
            ctx.lineTo(t.x - ds, t.y);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 255, 255, ${hI * 0.95})`;
            ctx.fill();
          }
        }
      }

      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

// ─── Animation Type 3: Pre-drawn edge pattern ───

interface Edge {
  ax: number; ay: number;
  bx: number; by: number;
}

function generateEdgePattern(): Edge[] {
  const dk = (x: number, y: number) => `${x},${y}`;

  // Exclusion: 1 empty dot between lines = 2 * DOT_SPACING distance
  const EXCLUSION = DOT_SPACING * 2;

  // Directions: right or down only (straight lines, 90 degrees)
  const DIRS = [
    { dx: DOT_SPACING, dy: 0 },   // right
    { dx: -DOT_SPACING, dy: 0 },  // left
    { dx: 0, dy: DOT_SPACING },   // down
    { dx: 0, dy: -DOT_SPACING },  // up
  ];

  const claimed = new Set<string>();

  function claimDot(x: number, y: number) {
    for (let ox = -EXCLUSION; ox <= EXCLUSION; ox += DOT_SPACING) {
      for (let oy = -EXCLUSION; oy <= EXCLUSION; oy += DOT_SPACING) {
        claimed.add(dk(x + ox, y + oy));
      }
    }
  }

  function isValid(x: number, y: number): boolean {
    return x >= DOT_SPACING && x <= GRID_COLS * DOT_SPACING &&
           y >= DOT_SPACING && y <= GRID_ROWS * DOT_SPACING &&
           !claimed.has(dk(x, y));
  }

  // Pick a random perpendicular direction
  function turnDir(cur: { dx: number; dy: number }): { dx: number; dy: number } {
    if (cur.dx !== 0) {
      // Was horizontal → go vertical
      return Math.random() < 0.5 ? { dx: 0, dy: DOT_SPACING } : { dx: 0, dy: -DOT_SPACING };
    }
    // Was vertical → go horizontal
    return Math.random() < 0.5 ? { dx: DOT_SPACING, dy: 0 } : { dx: -DOT_SPACING, dy: 0 };
  }

  const starts: { x: number; y: number }[] = [];
  for (let gx = 1; gx <= GRID_COLS; gx++) {
    for (let gy = 1; gy <= GRID_ROWS; gy++) {
      starts.push({ x: gx * DOT_SPACING, y: gy * DOT_SPACING });
    }
  }
  for (let i = starts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [starts[i], starts[j]] = [starts[j], starts[i]];
  }

  const edges: Edge[] = [];
  const SEGMENT_MIN = 2; // min dots before a turn
  const SEGMENT_MAX = 4; // max dots before forced turn
  const MAX_LINE_DOTS = 25;

  for (const start of starts) {
    if (claimed.has(dk(start.x, start.y))) continue;

    let dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    const lineDots: { x: number; y: number }[] = [start];
    let stepsInSegment = 0;
    const segmentLen = SEGMENT_MIN + Math.floor(Math.random() * (SEGMENT_MAX - SEGMENT_MIN + 1));
    let currentSegmentLen = segmentLen;

    for (let total = 0; total < MAX_LINE_DOTS; total++) {
      const last = lineDots[lineDots.length - 1];
      const nx = last.x + dir.dx;
      const ny = last.y + dir.dy;

      stepsInSegment++;

      // Force turn if segment length reached
      if (stepsInSegment >= currentSegmentLen) {
        const newDir = turnDir(dir);
        const tnx = last.x + newDir.dx;
        const tny = last.y + newDir.dy;
        if (isValid(tnx, tny)) {
          dir = newDir;
          lineDots.push({ x: tnx, y: tny });
          stepsInSegment = 0;
          currentSegmentLen = SEGMENT_MIN + Math.floor(Math.random() * (SEGMENT_MAX - SEGMENT_MIN + 1));
          continue;
        }
        // Can't turn, try opposite turn
        const altDir = { dx: -newDir.dx, dy: -newDir.dy };
        const anx = last.x + altDir.dx;
        const any_ = last.y + altDir.dy;
        if (isValid(anx, any_)) {
          dir = altDir;
          lineDots.push({ x: anx, y: any_ });
          stepsInSegment = 0;
          currentSegmentLen = SEGMENT_MIN + Math.floor(Math.random() * (SEGMENT_MAX - SEGMENT_MIN + 1));
          continue;
        }
        // Can't turn either way, stop
        break;
      }

      if (!isValid(nx, ny)) break;
      lineDots.push({ x: nx, y: ny });
    }

    if (lineDots.length < 3) continue;

    for (const d of lineDots) claimDot(d.x, d.y);

    for (let i = 0; i < lineDots.length - 1; i++) {
      edges.push({
        ax: lineDots[i].x, ay: lineDots[i].y,
        bx: lineDots[i + 1].x, by: lineDots[i + 1].y,
      });
    }
  }

  return edges;
}

function useAnimType3(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);
  const spot = useRef<SpotState>(initSpot());
  const edges = useRef<Edge[]>(generateEdgePattern());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    pickSpotTarget(spot.current);

    function draw() {
      if (!ctx) return;
      const s = spot.current;
      stepSpot(s);
      const cosA = Math.cos(-s.angle);
      const sinA = Math.sin(-s.angle);

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Draw edges revealed by spotlight
      for (const e of edges.current) {
        const aI = getIntensity(e.ax, e.ay, s, cosA, sinA);
        const bI = getIntensity(e.bx, e.by, s, cosA, sinA);
        const eI = Math.min(aI, bI);
        if (eI < 0.02) continue;

        ctx.beginPath();
        ctx.moveTo(e.ax, e.ay);
        ctx.lineTo(e.bx, e.by);
        ctx.strokeStyle = `rgba(140, 140, 140, ${eI * 0.7})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // No dots for type 3 — edges only

      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

// ─── Animation Type 4: Single diamond traveler with following spotlight ───

function useAnimType4(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);
  const spot = useRef<SpotState>(initSpot());

  interface JumpFx {
    x: number; y: number;
    frame: number;
    maxFrames: number;
    streaks: number[];
    rippleSpeed: number;
  }

  type Phase = "trailing" | "jump-out" | "spotlight-move" | "jump-in";

  interface T4State {
    x: number; y: number;
    targetX: number; targetY: number;
    trail: { x: number; y: number }[];
    stepsLeft: number;
    stepsTotal: number;
    visited: Set<string>;
    phase: Phase;
    // Jump destination (set when jump triggered)
    destX: number; destY: number;
    // Jump-in: traveler approaches from offset
    jumpInX: number; jumpInY: number;
    visible: boolean;
  }

  const traveler = useRef<T4State>({
    x: 250, y: 250, targetX: 250, targetY: 250,
    trail: [], stepsLeft: 5, stepsTotal: 5, visited: new Set(),
    phase: "trailing", destX: 250, destY: 250,
    jumpInX: 250, jumpInY: 250, visible: true,
  });
  const jumpFx = useRef<JumpFx | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const SPEED = 0.7;
    const TRAIL_MAX = Math.ceil((DOT_SPACING * 1.5) / SPEED); // 1.5 dots worth of trail points
    const MARGIN = SIZE * 0.125; // 12.5% each side = inner 75%
    const MIN_BOUND = MARGIN;
    const MAX_BOUND = SIZE - MARGIN;

    const dk = (x: number, y: number) => `${x},${y}`;
    const inBounds = (x: number, y: number) => x >= MIN_BOUND && x <= MAX_BOUND && y >= MIN_BOUND && y <= MAX_BOUND;

    function pickNeighbor(t: T4State) {
      const gx = Math.round(t.x / DOT_SPACING) * DOT_SPACING;
      const gy = Math.round(t.y / DOT_SPACING) * DOT_SPACING;
      t.visited.add(dk(gx, gy));
      const neighbors = [
        { x: gx + DOT_SPACING, y: gy },
        { x: gx - DOT_SPACING, y: gy },
        { x: gx, y: gy + DOT_SPACING },
        { x: gx, y: gy - DOT_SPACING },
      ].filter((p) => inBounds(p.x, p.y) && !t.visited.has(dk(p.x, p.y)));
      if (neighbors.length === 0) {
        // Boxed in — force a jump
        t.stepsLeft = 0;
        return;
      }
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      t.targetX = pick.x;
      t.targetY = pick.y;
    }

    function startJump(t: T4State) {
      // Spawn jump-out FX at departure
      const streaks: number[] = [];
      const numStreaks = 6 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numStreaks; i++) {
        streaks.push(Math.random() * Math.PI * 2);
      }
      jumpFx.current = { x: t.x, y: t.y, frame: 0, maxFrames: 60, streaks, rippleSpeed: 3 };

      // Pick destination — 50% of available area away, wrapping like a torus
      const areaW = MAX_BOUND - MIN_BOUND;
      const areaH = MAX_BOUND - MIN_BOUND;
      const jumpDist = 0.5; // 50% of area

      // Random cardinal direction
      const angle = Math.random() * Math.PI * 2;
      let rawX = t.x + Math.cos(angle) * areaW * jumpDist;
      let rawY = t.y + Math.sin(angle) * areaH * jumpDist;

      // Wrap within bounds (torus)
      const wrap = (v: number, min: number, max: number) => {
        const range = max - min;
        let r = ((v - min) % range);
        if (r < 0) r += range;
        return min + r;
      };
      rawX = wrap(rawX, MIN_BOUND, MAX_BOUND);
      rawY = wrap(rawY, MIN_BOUND, MAX_BOUND);

      // Snap to nearest grid dot
      t.destX = Math.round(rawX / DOT_SPACING) * DOT_SPACING;
      t.destY = Math.round(rawY / DOT_SPACING) * DOT_SPACING;
      // Clamp just in case
      t.destX = Math.max(MIN_BOUND, Math.min(MAX_BOUND, t.destX));
      t.destY = Math.max(MIN_BOUND, Math.min(MAX_BOUND, t.destY));

      t.visible = false;
      t.trail = [];
      t.phase = "jump-out";
    }

    function prepareArrival(t: T4State) {
      // Offset: 15% of available area
      const offset = Math.max(DOT_SPACING * 3, Math.round((MAX_BOUND - MIN_BOUND) * 0.15 / DOT_SPACING) * DOT_SPACING);
      const dirs = [
        { x: offset, y: 0 },
        { x: -offset, y: 0 },
        { x: 0, y: offset },
        { x: 0, y: -offset },
      ];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      t.jumpInX = t.destX + dir.x;
      t.jumpInY = t.destY + dir.y;
      t.x = t.jumpInX;
      t.y = t.jumpInY;
      t.targetX = t.destX;
      t.targetY = t.destY;
      t.stepsTotal = 8 + Math.floor(Math.random() * 3);
      t.stepsLeft = t.stepsTotal;
      // Pre-visit the dot we came from so we never go backwards
      // The "came from" dot is in the opposite direction of the jump-in
      const backX = t.destX + (t.destX - t.jumpInX);
      const backY = t.destY + (t.destY - t.jumpInY);
      t.visited = new Set([dk(backX, backY)]);
      t.trail = [];
    }

    // Init — start trailing immediately
    {
      const t = traveler.current;
      t.phase = "trailing";
      t.visible = true;
      t.stepsTotal = 8 + Math.floor(Math.random() * 3);
      t.stepsLeft = t.stepsTotal;
      pickNeighbor(t);
    }

    const JUMP_IN_SPEED = SPEED * 8;
    const SPOT_CHASE_SPEED = 0.03;

    function draw() {
      if (!ctx) return;
      const t = traveler.current;
      const s = spot.current;
      const fx = jumpFx.current;

      // ── Phase logic ──
      if (t.phase === "trailing") {
        const dx = t.targetX - t.x;
        const dy = t.targetY - t.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= SPEED) {
          t.x = t.targetX;
          t.y = t.targetY;
          t.stepsLeft--;
          if (t.stepsLeft <= 0) {
            startJump(t);
          } else {
            pickNeighbor(t);
          }
        } else {
          t.x += (dx / dist) * SPEED;
          t.y += (dy / dist) * SPEED;
        }
        t.trail.push({ x: t.x, y: t.y });
        if (t.trail.length > TRAIL_MAX) t.trail.shift();
        // Spotlight chases traveler
        s.x += (t.x - s.x) * SPOT_CHASE_SPEED;
        s.y += (t.y - s.y) * SPOT_CHASE_SPEED;

      } else if (t.phase === "jump-out") {
        // Spotlight stays at jump origin (don't move)
        // Wait for FX to finish
        if (!fx || fx.frame >= fx.maxFrames) {
          t.phase = "spotlight-move";
          prepareArrival(t);
        }

      } else if (t.phase === "spotlight-move") {
        // Move spotlight toward destination
        s.x += (t.destX - s.x) * SPOT_CHASE_SPEED;
        s.y += (t.destY - s.y) * SPOT_CHASE_SPEED;
        // When spotlight is close enough, start jump-in
        const sDist = Math.hypot(s.x - t.destX, s.y - t.destY);
        if (sDist < 30) {
          t.phase = "jump-in";
          t.visible = true;
        }

      } else if (t.phase === "jump-in") {
        // Traveler flies in fast then decelerates
        const dx = t.targetX - t.x;
        const dy = t.targetY - t.y;
        const dist = Math.hypot(dx, dy);
        const totalDist = Math.hypot(t.destX - t.jumpInX, t.destY - t.jumpInY);
        // Speed based on remaining distance — fast at start, slow at end
        const progress = 1 - (dist / (totalDist || 1));
        const curSpeed = Math.max(SPEED * 0.5, JUMP_IN_SPEED * (1 - progress * progress));
        if (dist <= curSpeed) {
          t.x = t.targetX;
          t.y = t.targetY;
          t.phase = "trailing";
          pickNeighbor(t);
        } else {
          t.x += (dx / dist) * curSpeed;
          t.y += (dy / dist) * curSpeed;
        }
        t.trail.push({ x: t.x, y: t.y });
        if (t.trail.length > TRAIL_MAX) t.trail.shift();
        // Spotlight chases
        s.x += (t.x - s.x) * SPOT_CHASE_SPEED;
        s.y += (t.y - s.y) * SPOT_CHASE_SPEED;
      }

      s.rx = SIZE * 0.26;
      s.ry = SIZE * 0.26;
      s.angle = 0;

      const cosA = 1;
      const sinA = 0;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Draw dots with ripple displacement
      const rippleRadius = fx ? fx.frame * fx.rippleSpeed : 0;
      const rippleWidth = 40; // width of the wave band

      for (let x = DOT_SPACING; x < SIZE; x += DOT_SPACING) {
        for (let y = DOT_SPACING; y < SIZE; y += DOT_SPACING) {
          let drawX = x;
          let drawY = y;

          // Apply ripple displacement
          if (fx) {
            const dxR = x - fx.x;
            const dyR = y - fx.y;
            const distR = Math.hypot(dxR, dyR);

            if (distR > 0) {
              // How close is this dot to the ripple wavefront
              const distFromWave = Math.abs(distR - rippleRadius);
              if (distFromWave < rippleWidth) {
                // Displacement strength: peaks at wavefront, decays with time
                const waveFactor = 1 - distFromWave / rippleWidth;
                const timeFade = 1 - fx.frame / fx.maxFrames;
                const displacement = waveFactor * timeFade * 6;
                // Spring oscillation — sin creates the "string vibration" feel
                const oscillation = Math.sin(waveFactor * Math.PI * 3) * timeFade;
                const totalDisp = displacement + oscillation * 2;
                // Push outward from jump origin
                drawX += (dxR / distR) * totalDisp;
                drawY += (dyR / distR) * totalDisp;
              }
            }
          }

          const eased = getIntensity(x, y, s, cosA, sinA);
          const alpha = eased * 0.8;
          if (alpha < 0.01) continue;

          ctx.beginPath();
          ctx.arc(drawX, drawY, DOT_RADIUS + eased * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(140, 140, 140, ${alpha})`;
          ctx.fill();
        }
      }

      // Draw trail and head only when visible
      if (t.visible) {
        for (let i = 0; i < t.trail.length; i++) {
          const p = t.trail[i];
          const pI = getIntensity(p.x, p.y, s, cosA, sinA);
          if (pI < 0.05) continue;
          const age = (i + 1) / t.trail.length;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 220, 220, ${age * pI * 0.9})`;
          ctx.fill();
        }

        const hI = getIntensity(t.x, t.y, s, cosA, sinA);
        if (hI >= 0.05) {
          const ds = 2.5;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y - ds);
          ctx.lineTo(t.x + ds, t.y);
          ctx.lineTo(t.x, t.y + ds);
          ctx.lineTo(t.x - ds, t.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(255, 255, 255, ${hI * 0.95})`;
          ctx.fill();

          // Label over the traveler — only after jump-in completes
          if (SHOW_LABEL && t.phase === "trailing") {
            ctx.font = '7px "Cinzel", serif';
            ctx.textAlign = "center";
            ctx.fillStyle = `rgba(255, 255, 255, ${hI * 0.6})`;
            ctx.letterSpacing = "2px";
            ctx.fillText("EXPLORER", t.x, t.y - 8);
            ctx.letterSpacing = "0px";
          }
        }
      }

      // Draw jump-out FX
      if (fx) {
        fx.frame++;
        const progress = fx.frame / fx.maxFrames; // 0→1
        const fade = 1 - progress;

        // Expanding ring
        const ringRadius = progress * 35;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 200, 220, ${fade * 0.6})`;
        ctx.lineWidth = 1.5 * fade;
        ctx.stroke();

        // Inner flash (quick bright core that fades fast)
        if (progress < 0.3) {
          const flashAlpha = (1 - progress / 0.3) * 0.5;
          const flashR = progress * 12;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, flashR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 220, 240, ${flashAlpha})`;
          ctx.fill();
        }

        // Streaking lines radiating outward
        for (const angle of fx.streaks) {
          const innerR = progress * 8;
          const outerR = progress * 30 + 5;
          const x1 = fx.x + Math.cos(angle) * innerR;
          const y1 = fx.y + Math.sin(angle) * innerR;
          const x2 = fx.x + Math.cos(angle) * outerR;
          const y2 = fx.y + Math.sin(angle) * outerR;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(180, 180, 200, ${fade * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (fx.frame >= fx.maxFrames) jumpFx.current = null;
      }

      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

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

// ─── Animation Type 5: Type 4 clone with random ship names ───

function useAnimType5(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);
  const spot = useRef<SpotState>(initSpot());

  interface JumpFx {
    x: number; y: number;
    frame: number;
    maxFrames: number;
    streaks: number[];
    rippleSpeed: number;
  }

  type Phase = "trailing" | "jump-out" | "spotlight-move" | "jump-in";

  interface T5State {
    x: number; y: number;
    targetX: number; targetY: number;
    trail: { x: number; y: number }[];
    stepsLeft: number;
    stepsTotal: number;
    visited: Set<string>;
    phase: Phase;
    destX: number; destY: number;
    jumpInX: number; jumpInY: number;
    visible: boolean;
    shipName: string;
    jumpOriginX: number; jumpOriginY: number;
  }

  const traveler = useRef<T5State>({
    x: 250, y: 250, targetX: 250, targetY: 250,
    trail: [], stepsLeft: 5, stepsTotal: 5, visited: new Set(),
    phase: "trailing", destX: 250, destY: 250,
    jumpInX: 250, jumpInY: 250, visible: true,
    shipName: randomShipName(),
    jumpOriginX: 250, jumpOriginY: 250,
  });
  const jumpFx = useRef<JumpFx | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const SPEED = 0.7;
    const TRAIL_MAX = Math.ceil((DOT_SPACING * 1.5) / SPEED);
    const MARGIN = SIZE * 0.075;
    const MIN_BOUND = MARGIN;
    const MAX_BOUND = SIZE - MARGIN;

    const dk = (x: number, y: number) => `${x},${y}`;
    const inBounds = (x: number, y: number) => x >= MIN_BOUND && x <= MAX_BOUND && y >= MIN_BOUND && y <= MAX_BOUND;

    function pickNeighbor(t: T5State) {
      const gx = Math.round(t.x / DOT_SPACING) * DOT_SPACING;
      const gy = Math.round(t.y / DOT_SPACING) * DOT_SPACING;
      t.visited.add(dk(gx, gy));
      const neighbors = [
        { x: gx + DOT_SPACING, y: gy },
        { x: gx - DOT_SPACING, y: gy },
        { x: gx, y: gy + DOT_SPACING },
        { x: gx, y: gy - DOT_SPACING },
      ].filter((p) => inBounds(p.x, p.y) && !t.visited.has(dk(p.x, p.y)));
      if (neighbors.length === 0) {
        t.stepsLeft = 0;
        return;
      }
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      t.targetX = pick.x;
      t.targetY = pick.y;
    }

    function startJump(t: T5State) {
      const streaks: number[] = [];
      const numStreaks = 6 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numStreaks; i++) {
        streaks.push(Math.random() * Math.PI * 2);
      }
      jumpFx.current = { x: t.x, y: t.y, frame: 0, maxFrames: 60, streaks, rippleSpeed: 3 };

      const areaW = MAX_BOUND - MIN_BOUND;
      const areaH = MAX_BOUND - MIN_BOUND;
      const jumpDist = 0.5;
      const angle = Math.random() * Math.PI * 2;
      let rawX = t.x + Math.cos(angle) * areaW * jumpDist;
      let rawY = t.y + Math.sin(angle) * areaH * jumpDist;

      const wrap = (v: number, min: number, max: number) => {
        const range = max - min;
        let r = ((v - min) % range);
        if (r < 0) r += range;
        return min + r;
      };
      rawX = wrap(rawX, MIN_BOUND, MAX_BOUND);
      rawY = wrap(rawY, MIN_BOUND, MAX_BOUND);

      t.destX = Math.round(rawX / DOT_SPACING) * DOT_SPACING;
      t.destY = Math.round(rawY / DOT_SPACING) * DOT_SPACING;
      t.destX = Math.max(MIN_BOUND, Math.min(MAX_BOUND, t.destX));
      t.destY = Math.max(MIN_BOUND, Math.min(MAX_BOUND, t.destY));

      t.jumpOriginX = t.x;
      t.jumpOriginY = t.y;
      t.visible = false;
      t.trail = [];
      t.phase = "jump-out";
    }

    function prepareArrival(t: T5State) {
      const offset = Math.max(DOT_SPACING * 3, Math.round((MAX_BOUND - MIN_BOUND) * 0.15 / DOT_SPACING) * DOT_SPACING);
      const dirs = [
        { x: offset, y: 0 },
        { x: -offset, y: 0 },
        { x: 0, y: offset },
        { x: 0, y: -offset },
      ];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      t.jumpInX = t.destX + dir.x;
      t.jumpInY = t.destY + dir.y;
      t.x = t.jumpInX;
      t.y = t.jumpInY;
      t.targetX = t.destX;
      t.targetY = t.destY;
      t.stepsTotal = 8 + Math.floor(Math.random() * 3);
      t.stepsLeft = t.stepsTotal;
      const backX = t.destX + (t.destX - t.jumpInX);
      const backY = t.destY + (t.destY - t.jumpInY);
      t.visited = new Set([dk(backX, backY)]);
      t.trail = [];
      // New ship name on each arrival
      t.shipName = randomShipName();
    }

    // Init
    {
      const t = traveler.current;
      t.phase = "trailing";
      t.visible = true;
      t.stepsTotal = 8 + Math.floor(Math.random() * 3);
      t.stepsLeft = t.stepsTotal;
      pickNeighbor(t);
    }

    const JUMP_IN_SPEED = SPEED * 8;
    const SPOT_CHASE_SPEED = 0.03;

    function draw() {
      if (!ctx) return;
      const t = traveler.current;
      const s = spot.current;
      const fx = jumpFx.current;

      if (t.phase === "trailing") {
        const dx = t.targetX - t.x;
        const dy = t.targetY - t.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= SPEED) {
          t.x = t.targetX;
          t.y = t.targetY;
          t.stepsLeft--;
          if (t.stepsLeft <= 0) {
            startJump(t);
          } else {
            pickNeighbor(t);
          }
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
          prepareArrival(t);
        }

      } else if (t.phase === "spotlight-move") {
        s.x += (t.destX - s.x) * SPOT_CHASE_SPEED;
        s.y += (t.destY - s.y) * SPOT_CHASE_SPEED;
        const sDist = Math.hypot(s.x - t.destX, s.y - t.destY);
        if (sDist < 30) {
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
          t.x = t.targetX;
          t.y = t.targetY;
          t.phase = "trailing";
          pickNeighbor(t);
        } else {
          t.x += (dx / dist) * curSpeed;
          t.y += (dy / dist) * curSpeed;
        }
        t.trail.push({ x: t.x, y: t.y });
        if (t.trail.length > TRAIL_MAX) t.trail.shift();
        s.x += (t.x - s.x) * SPOT_CHASE_SPEED;
        s.y += (t.y - s.y) * SPOT_CHASE_SPEED;
      }

      s.rx = SIZE * 0.26;
      s.ry = SIZE * 0.26;
      s.angle = 0;

      const cosA = 1;
      const sinA = 0;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Draw dots with ripple displacement
      const rippleRadius = fx ? fx.frame * fx.rippleSpeed : 0;
      const rippleWidth = 40;

      for (let x = DOT_SPACING; x < SIZE; x += DOT_SPACING) {
        for (let y = DOT_SPACING; y < SIZE; y += DOT_SPACING) {
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

          const eased = getIntensity(x, y, s, cosA, sinA);
          const alpha = eased * 0.8;
          if (alpha < 0.01) continue;

          ctx.beginPath();
          ctx.arc(drawX, drawY, DOT_RADIUS + eased * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(140, 140, 140, ${alpha})`;
          ctx.fill();
        }
      }

      // Corner dots around the ship — 4 diagonal neighbors
      // During jump phases, use the stored jump origin, otherwise follow traveler
      const isJumpPhase = t.phase === "jump-out" || t.phase === "spotlight-move";
      const cornerAnchorX = isJumpPhase ? t.jumpOriginX : t.x;
      const cornerAnchorY = isJumpPhase ? t.jumpOriginY : t.y;
      const gx = Math.round(cornerAnchorX / DOT_SPACING) * DOT_SPACING;
      const gy = Math.round(cornerAnchorY / DOT_SPACING) * DOT_SPACING;
      const corners = [
        { x: gx - DOT_SPACING, y: gy - DOT_SPACING },
        { x: gx + DOT_SPACING, y: gy - DOT_SPACING },
        { x: gx - DOT_SPACING, y: gy + DOT_SPACING },
        { x: gx + DOT_SPACING, y: gy + DOT_SPACING },
      ];
      const isJumping = t.phase === "jump-out" || t.phase === "spotlight-move";
      for (const c of corners) {
        const cI = getIntensity(c.x, c.y, s, cosA, sinA);
        if (isJumping) {
          // Flash red at the old position — fade with spotlight
          const cI = getIntensity(c.x, c.y, s, cosA, sinA);
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

      // Draw trail and head
      if (t.visible) {
        for (let i = 0; i < t.trail.length; i++) {
          const p = t.trail[i];
          const pI = getIntensity(p.x, p.y, s, cosA, sinA);
          if (pI < 0.05) continue;
          const age = (i + 1) / t.trail.length;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 220, 220, ${age * pI * 0.9})`;
          ctx.fill();
        }

        const hI = getIntensity(t.x, t.y, s, cosA, sinA);
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

          // Ship name label — only after jump-in completes
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

      // Draw jump-out FX
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
          const x1 = fx.x + Math.cos(angle) * innerR;
          const y1 = fx.y + Math.sin(angle) * innerR;
          const x2 = fx.x + Math.cos(angle) * outerR;
          const y2 = fx.y + Math.sin(angle) * outerR;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(180, 180, 200, ${fade * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (fx.frame >= fx.maxFrames) jumpFx.current = null;
      }

      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

// ─── Animation Type 6: Shattered glass ───

interface Shard {
  // Polygon vertices (pixel coords)
  points: { x: number; y: number }[];
  opacity: number; // base opacity 0.02–0.12
}

function generateShards(): Shard[] {
  // Jittered grid of vertices, then split each quad into 2 triangles
  const CELL = DOT_SPACING * 3;
  const JITTER = CELL * 0.4;
  const cols = Math.ceil(SIZE / CELL) + 1;
  const rows = Math.ceil(SIZE / CELL) + 1;

  // Generate jittered grid vertices
  // vertices[row][col] = {x, y}
  const vertices: { x: number; y: number }[][] = [];
  for (let gy = 0; gy < rows; gy++) {
    const row: { x: number; y: number }[] = [];
    for (let gx = 0; gx < cols; gx++) {
      // Pin edge vertices to prevent gaps at borders
      const isEdgeX = gx === 0 || gx === cols - 1;
      const isEdgeY = gy === 0 || gy === rows - 1;
      row.push({
        x: gx * CELL + (isEdgeX ? 0 : (Math.random() - 0.5) * JITTER),
        y: gy * CELL + (isEdgeY ? 0 : (Math.random() - 0.5) * JITTER),
      });
    }
    vertices.push(row);
  }

  const shards: Shard[] = [];

  // For each cell in the grid, split the quad into 2 triangles
  for (let gy = 0; gy < rows - 1; gy++) {
    for (let gx = 0; gx < cols - 1; gx++) {
      const tl = vertices[gy][gx];
      const tr = vertices[gy][gx + 1];
      const bl = vertices[gy + 1][gx];
      const br = vertices[gy + 1][gx + 1];

      // Randomly choose diagonal split direction
      if (Math.random() < 0.5) {
        // TL-BR diagonal
        shards.push({ points: [tl, tr, br], opacity: 0.02 + Math.random() * 0.1 });
        shards.push({ points: [tl, br, bl], opacity: 0.02 + Math.random() * 0.1 });
      } else {
        // TR-BL diagonal
        shards.push({ points: [tl, tr, bl], opacity: 0.02 + Math.random() * 0.1 });
        shards.push({ points: [tr, br, bl], opacity: 0.02 + Math.random() * 0.1 });
      }
    }
  }

  return shards;
}

function useAnimType6(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);
  const spot = useRef<SpotState>(initSpot());
  const shards = useRef<Shard[]>(generateShards());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    pickSpotTarget(spot.current);

    function draw() {
      if (!ctx) return;
      const s = spot.current;
      stepSpot(s);
      const cosA = Math.cos(-s.angle);
      const sinA = Math.sin(-s.angle);

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Draw shards
      for (const shard of shards.current) {
        if (shard.points.length < 3) continue;

        // Get intensity at shard center
        const cx = shard.points.reduce((a, p) => a + p.x, 0) / shard.points.length;
        const cy = shard.points.reduce((a, p) => a + p.y, 0) / shard.points.length;
        const intensity = getIntensity(cx, cy, s, cosA, sinA);

        if (intensity < 0.02) continue;

        // Fill shard
        ctx.beginPath();
        ctx.moveTo(shard.points[0].x, shard.points[0].y);
        for (let i = 1; i < shard.points.length; i++) {
          ctx.lineTo(shard.points[i].x, shard.points[i].y);
        }
        ctx.closePath();

        const fillAlpha = shard.opacity * intensity * 3;
        ctx.fillStyle = `rgba(140, 150, 160, ${Math.min(0.25, fillAlpha)})`;
        ctx.fill();

        // Stroke shard edges (crack lines)
        ctx.strokeStyle = `rgba(180, 190, 200, ${intensity * 0.5})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

// ─── Animation Type 7: Hexagonal grid ───

interface Hex {
  cx: number; cy: number;
  baseOpacity: number;
  verts: { x: number; y: number }[];
  // Each hex gets a random detach direction/rotation
  driftX: number; driftY: number;
  driftRot: number; // radians
}

function generateHexGrid(): Hex[] {
  const HEX_R = 18;
  const hexes: Hex[] = [];

  const colW = HEX_R * 1.5;
  const rowH = HEX_R * Math.sqrt(3);

  for (let col = -1; col * colW < SIZE + HEX_R * 2; col++) {
    const cx = col * colW;
    const offsetY = col % 2 === 0 ? 0 : rowH / 2;
    for (let row = -1; row * rowH + offsetY < SIZE + HEX_R * 2; row++) {
      const cy = row * rowH + offsetY;
      const verts: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        verts.push({
          x: cx + HEX_R * Math.cos(angle),
          y: cy + HEX_R * Math.sin(angle),
        });
      }
      // Random drift direction (away from center-ish) + slight rotation
      const driftAngle = Math.random() * Math.PI * 2;
      const driftDist = 6 + Math.random() * 10;
      hexes.push({
        cx, cy,
        baseOpacity: 0.02 + Math.random() * 0.08,
        verts,
        driftX: Math.cos(driftAngle) * driftDist,
        driftY: Math.sin(driftAngle) * driftDist,
        driftRot: (Math.random() - 0.5) * 0.4,
      });
    }
  }

  return hexes;
}

function useAnimType7(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);
  const spot = useRef<SpotState>(initSpot());
  const hexes = useRef<Hex[]>(generateHexGrid());
  // 0 = fully detached/drifted, 1 = fully attached/snapped
  const hexAttach = useRef<Float32Array>(new Float32Array(hexes.current.length));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    pickSpotTarget(spot.current);

    const attach = hexAttach.current;

    function draw() {
      if (!ctx) return;
      const s = spot.current;
      stepSpot(s);
      const cosA = Math.cos(-s.angle);
      const sinA = Math.sin(-s.angle);

      ctx.clearRect(0, 0, SIZE, SIZE);

      for (let i = 0; i < hexes.current.length; i++) {
        const hex = hexes.current[i];
        const intensity = getIntensity(hex.cx, hex.cy, s, cosA, sinA);

        // Target: 1 (attached) when spotlight is strong, 0 (detached) when dim
        const target = intensity > 0.3 ? 1 : 0;

        // Ease: attach fast, detach slow
        if (target > attach[i]) {
          attach[i] += (target - attach[i]) * 0.12;
        } else {
          attach[i] += (target - attach[i]) * 0.03;
        }

        const t = attach[i]; // 0 = detached, 1 = attached
        if (t < 0.01 && intensity < 0.01) continue;

        // Compute drift: when detached (t→0), hex drifts away and rotates
        const drift = 1 - t; // 0 = no drift, 1 = full drift
        const offsetX = hex.driftX * drift;
        const offsetY = hex.driftY * drift;
        const rotation = hex.driftRot * drift;

        // Alpha: combine spotlight intensity with attachment
        const alpha = Math.max(intensity * 0.3, t) * intensity;
        if (alpha < 0.01) continue;

        ctx.save();
        ctx.translate(hex.cx + offsetX, hex.cy + offsetY);
        ctx.rotate(rotation);

        // Draw hex centered at origin
        ctx.beginPath();
        ctx.moveTo(hex.verts[0].x - hex.cx, hex.verts[0].y - hex.cy);
        for (let v = 1; v < 6; v++) {
          ctx.lineTo(hex.verts[v].x - hex.cx, hex.verts[v].y - hex.cy);
        }
        ctx.closePath();

        ctx.fillStyle = `rgba(130, 140, 160, ${alpha * hex.baseOpacity * 8})`;
        ctx.fill();

        ctx.strokeStyle = `rgba(160, 170, 190, ${alpha * 0.6})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.restore();
      }

      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

// ─── Animation Type 8: Hex waterfall waves ───

interface Ripple {
  cx: number; cy: number; // origin
  radius: number;         // current radius
  speed: number;          // expansion speed
  maxRadius: number;      // dies at this radius
  width: number;          // ring thickness
}

interface Flicker {
  hexIdx: number;
  life: number;    // 0→1, fades out
  decay: number;   // how fast it decays per frame
}

function useAnimType8(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);
  const hexes = useRef<Hex[]>(generateHexGrid());
  const hexGlow = useRef<Float32Array>(new Float32Array(hexes.current.length));
  const ripples = useRef<Ripple[]>([]);
  const flickers = useRef<Flicker[]>([]);
  const frameCount = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const glow = hexGlow.current;
    const hexArr = hexes.current;

    function draw() {
      if (!ctx) return;
      frameCount.current++;

      // Spawn ripples (rare)
      if (Math.random() < 0.005) {
        ripples.current.push({
          cx: Math.random() * SIZE,
          cy: Math.random() * SIZE,
          radius: 0,
          speed: 0.8 + Math.random() * 0.8,
          maxRadius: SIZE * 0.16 + Math.random() * SIZE * 0.24,
          width: SIZE * 0.05 + Math.random() * SIZE * 0.04,
        });
      }

      // Spawn flickers (rare)
      if (Math.random() < 0.04) {
        const idx = Math.floor(Math.random() * hexArr.length);
        flickers.current.push({
          hexIdx: idx,
          life: 0.6 + Math.random() * 0.4,
          decay: 0.015 + Math.random() * 0.02,
        });
      }

      // Advance ripples
      for (let i = ripples.current.length - 1; i >= 0; i--) {
        ripples.current[i].radius += ripples.current[i].speed;
        if (ripples.current[i].radius > ripples.current[i].maxRadius) {
          ripples.current.splice(i, 1);
        }
      }

      // Advance flickers
      for (let i = flickers.current.length - 1; i >= 0; i--) {
        flickers.current[i].life -= flickers.current[i].decay;
        if (flickers.current[i].life <= 0) {
          flickers.current.splice(i, 1);
        }
      }

      // Compute target glow per hex
      for (let i = 0; i < hexArr.length; i++) {
        const hex = hexArr[i];
        let target = 0;

        // Ripple contributions
        for (const r of ripples.current) {
          const dist = Math.hypot(hex.cx - r.cx, hex.cy - r.cy);
          const distFromRing = Math.abs(dist - r.radius);
          if (distFromRing < r.width) {
            const ringIntensity = 1 - distFromRing / r.width;
            // Fade as ripple expands
            const ageFade = 1 - r.radius / r.maxRadius;
            target = Math.max(target, ringIntensity * ageFade);
          }
        }

        // Flicker contributions
        for (const f of flickers.current) {
          if (f.hexIdx === i) {
            target = Math.max(target, f.life);
          }
        }

        // Ease toward target
        if (target > glow[i]) {
          glow[i] += (target - glow[i]) * 0.3;  // flare up fast
        } else {
          glow[i] += (target - glow[i]) * 0.06;  // fade slow
        }
      }

      ctx.clearRect(0, 0, SIZE, SIZE);

      for (let i = 0; i < hexArr.length; i++) {
        const hex = hexArr[i];
        // Base visibility + glow
        const baseAlpha = 0.04;
        const glowAlpha = glow[i] * 0.7;
        const alpha = baseAlpha + glowAlpha;
        if (alpha < 0.01) continue;

        ctx.beginPath();
        ctx.moveTo(hex.verts[0].x, hex.verts[0].y);
        for (let v = 1; v < 6; v++) {
          ctx.lineTo(hex.verts[v].x, hex.verts[v].y);
        }
        ctx.closePath();

        // Fill
        ctx.fillStyle = `rgba(210, 145, 50, ${glowAlpha * 0.3})`;
        ctx.fill();

        // Edges: only visible when glowing
        if (glowAlpha > 0.02) {
          ctx.strokeStyle = `rgba(240, 185, 85, ${glowAlpha * 0.7})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

// ─── Animation Type 9: Particle Assembly ───

function useAnimType9(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const animFrame = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const NUM_PARTICLES = 200;

    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      targetX: number; targetY: number;
      size: number;
    }

    // Target patterns
    const GRID_SPACING = 20;
    const gridTargets: { x: number; y: number }[] = [];
    for (let x = GRID_SPACING * 2; x < SIZE - GRID_SPACING; x += GRID_SPACING) {
      for (let y = GRID_SPACING * 2; y < SIZE - GRID_SPACING; y += GRID_SPACING) {
        gridTargets.push({ x, y });
      }
    }

    const circleTargets: { x: number; y: number }[] = [];
    const cr = SIZE * 0.35;
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const a = (i / NUM_PARTICLES) * Math.PI * 2;
      circleTargets.push({ x: SIZE / 2 + Math.cos(a) * cr, y: SIZE / 2 + Math.sin(a) * cr });
    }

    const hexTargets: { x: number; y: number }[] = [];
    const hr = SIZE * 0.3;
    // Compute 6 hex vertices first
    const hexVerts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      hexVerts.push({ x: SIZE / 2 + Math.cos(a) * hr, y: SIZE / 2 + Math.sin(a) * hr });
    }
    // Distribute particles evenly along the 6 edges
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

    const diamondTargets: { x: number; y: number }[] = [];
    const dr = SIZE * 0.35;
    const diamondVerts = [
      { x: SIZE / 2, y: SIZE / 2 - dr },     // top
      { x: SIZE / 2 + dr, y: SIZE / 2 },     // right
      { x: SIZE / 2, y: SIZE / 2 + dr },     // bottom
      { x: SIZE / 2 - dr, y: SIZE / 2 },     // left
    ];
    const perDSide = Math.floor(NUM_PARTICLES / 4);
    for (let i = 0; i < 4; i++) {
      const v1 = diamondVerts[i];
      const v2 = diamondVerts[(i + 1) % 4];
      for (let s = 0; s < perDSide; s++) {
        const t = s / perDSide;
        diamondTargets.push({
          x: v1.x + (v2.x - v1.x) * t,
          y: v1.y + (v2.y - v1.y) * t,
        });
      }
    }

    const patterns = [circleTargets, hexTargets, diamondTargets];

    const particles: Particle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      particles.push({
        x: Math.random() * SIZE,
        y: Math.random() * SIZE,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        targetX: 0, targetY: 0,
        size: 1 + Math.random() * 1.5,
      });
    }

    let phase: "scatter" | "assemble" = "scatter";
    let phaseTimer = 0;
    const SCATTER_DURATION = 180;
    const ASSEMBLE_DURATION = 240;
    let currentPattern = 0;

    function assignTargets() {
      const targets = patterns[currentPattern % patterns.length];
      // Sort particles by angle from center, match to sorted targets
      const cx = SIZE / 2, cy = SIZE / 2;
      const indexed = particles.map((p, i) => ({
        i,
        angle: Math.atan2(p.y - cy, p.x - cx),
      }));
      indexed.sort((a, b) => a.angle - b.angle);

      const sortedTargets = [...targets].sort((a, b) =>
        Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
      );

      for (let j = 0; j < indexed.length; j++) {
        const t = sortedTargets[j % sortedTargets.length];
        particles[indexed[j].i].targetX = t.x;
        particles[indexed[j].i].targetY = t.y;
      }
    }

    assignTargets();

    function draw() {
      if (!ctx) return;
      phaseTimer++;

      if (phase === "scatter" && phaseTimer > SCATTER_DURATION) {
        phase = "assemble";
        phaseTimer = 0;
        currentPattern++;
        assignTargets();
      } else if (phase === "assemble" && phaseTimer > ASSEMBLE_DURATION) {
        phase = "scatter";
        phaseTimer = 0;
      }

      ctx.clearRect(0, 0, SIZE, SIZE);

      for (const p of particles) {
        if (phase === "assemble") {
          // Ease toward target
          p.vx += (p.targetX - p.x) * 0.02;
          p.vy += (p.targetY - p.y) * 0.02;
          p.vx *= 0.9;
          p.vy *= 0.9;
        } else {
          // Scatter: gentle random drift
          p.vx += (Math.random() - 0.5) * 0.3;
          p.vy += (Math.random() - 0.5) * 0.3;
          p.vx *= 0.98;
          p.vy *= 0.98;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < 0) p.x += SIZE;
        if (p.x > SIZE) p.x -= SIZE;
        if (p.y < 0) p.y += SIZE;
        if (p.y > SIZE) p.y -= SIZE;

        // Draw particle
        const distToTarget = Math.hypot(p.x - p.targetX, p.y - p.targetY);
        const lockedness = phase === "assemble" ? Math.max(0, 1 - distToTarget / 50) : 0;
        const alpha = 0.2 + lockedness * 0.5;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
        ctx.fill();

        // Draw connection lines when close to target (assembled)
        if (lockedness > 0.5 && phase === "assemble") {
          for (const p2 of particles) {
            const d = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (d > 0 && d < GRID_SPACING * 1.5) {
              const d2 = Math.hypot(p2.x - p2.targetX, p2.y - p2.targetY);
              const lock2 = Math.max(0, 1 - d2 / 50);
              if (lock2 > 0.5) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(100, 180, 255, ${lockedness * lock2 * 0.15})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
            }
          }
        }
      }

      animFrame.current = requestAnimationFrame(draw);
    }

    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [canvasRef]);
}

// ─── Animation box components ───

type AnimType = "spotlight" | "travelers" | "type3" | "type4" | "type5" | "type6" | "type7" | "type8" | "type9";

const ANIM_HOOKS: Record<AnimType, (ref: React.RefObject<HTMLCanvasElement | null>) => void> = {
  spotlight: useAnimSpotlight,
  travelers: useAnimTravelers,
  type3: useAnimType3,
  type4: useAnimType4,
  type5: useAnimType5,
  type6: useAnimType6,
  type7: useAnimType7,
  type8: useAnimType8,
  type9: useAnimType9,
};

const SHOW_LABEL = true;

function AnimBox({ type }: { type: AnimType }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  ANIM_HOOKS[type](canvasRef);
  return (
    <div style={boxOuterStyle}>
      {/* Background layer */}
      <div className="absolute inset-0 bg-[#2a2a2a]" />
      {/* Blurred image layer */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={SAMPLE_IMAGE}
          alt=""
          className="w-3/5 h-3/5 object-contain opacity-15 blur-[3px]"
        />
      </div>
      {/* Canvas layer (transparent) */}
      <canvas
        ref={canvasRef}
        className="relative z-10"
        style={{ width: SIZE, height: SIZE }}
      />
    </div>
  );
}

// ─── Page ───

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const TYPES: { id: AnimType; label: string }[] = [
  { id: "spotlight", label: "Spotlight" },
  { id: "travelers", label: "Travelers" },
  { id: "type3", label: "Circuits" },
  { id: "type4", label: "Explorer" },
  { id: "type5", label: "Fleet" },
  { id: "type6", label: "Shattered" },
  { id: "type7", label: "Honeycomb" },
  { id: "type8", label: "Shield" },
  { id: "type9", label: "Assembly" },
];

export default function TestPage() {
  const [active, setActive] = useState<AnimType>("spotlight");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-[#1a1a1a]">
      {/* Switcher */}
      <div
        className="flex rounded-full border border-white/10 overflow-hidden"
        style={{ background: "rgba(30,30,30,0.8)" }}
      >
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-5 py-2 text-[10px] tracking-[0.2em] uppercase transition-all cursor-pointer ${
              active === t.id
                ? "bg-white/10 text-white/80"
                : "text-white/30 hover:text-white/50"
            }`}
            style={cinzel}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Box — remounts on type change for clean state */}
      <AnimBox key={active} type={active} />
    </div>
  );
}
