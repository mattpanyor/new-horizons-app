"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SectorMetadata, VortexPin, SystemPin } from "@/types/sector";
import type { StarSystemMetadata } from "@/types/starsystem";
import { getBodyColors } from "@/lib/bodyColors";

const FULL_W = 1200;
const FULL_H = 800;

const toRad = (deg: number) => (deg * Math.PI) / 180;

const SECTOR_TERRITORY: Record<string, { cx: number; cy: number; arcStart: number; arcEnd: number }> = {
  "top-right":    { cx: 80,   cy: 720, arcStart: 270, arcEnd: 360 },
  "bottom-right": { cx: 80,   cy: 80,  arcStart: 0,   arcEnd: 90  },
  "bottom-left":  { cx: 1120, cy: 80,  arcStart: 90,  arcEnd: 180 },
  "top-left":     { cx: 1120, cy: 720, arcStart: 180, arcEnd: 270 },
};

const TERRITORY_INNER_R = 260;
const TERRITORY_OUTER_R = 920;

function wedgePath(cx: number, cy: number, r1: number, r2: number, startDeg: number, endDeg: number) {
  const s = toRad(startDeg), e = toRad(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const x1 = cx + r1 * Math.cos(s), y1 = cy + r1 * Math.sin(s);
  const x2 = cx + r2 * Math.cos(s), y2 = cy + r2 * Math.sin(s);
  const x3 = cx + r2 * Math.cos(e), y3 = cy + r2 * Math.sin(e);
  const x4 = cx + r1 * Math.cos(e), y4 = cy + r1 * Math.sin(e);
  return `M ${x1} ${y1} L ${x2} ${y2} A ${r2} ${r2} 0 ${large} 1 ${x3} ${y3} L ${x4} ${y4} A ${r1} ${r1} 0 ${large} 0 ${x1} ${y1} Z`;
}

function wavyCloudPath(cx: number, cy: number, r: number, ratio?: [number, number]): string {
  const [rw, rh] = ratio ?? [1, 1];
  const maxR = Math.max(rw, rh);
  const scaleX = rw / maxR;
  const scaleY = rh / maxR;
  const N = 22;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wave =
      Math.sin(3 * a) * r * 0.14 +
      Math.sin(5 * a + 1.1) * r * 0.08 +
      Math.sin(7 * a + 2.3) * r * 0.04;
    const rad = r + wave;
    pts.push([cx + rad * scaleX * Math.cos(a), cy + rad * scaleY * Math.sin(a)]);
  }
  const n = pts.length;
  const mid = (i: number): [number, number] => {
    const a = pts[i], b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const start = mid(n - 1);
  const parts = [`M ${start[0].toFixed(2)} ${start[1].toFixed(2)}`];
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    parts.push(`Q ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} ${m[0].toFixed(2)} ${m[1].toFixed(2)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

function arcStroke(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = toRad(startDeg), e = toRad(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.15;
const FOCUS_ZOOM = 5.5; // zoom level when a system is clicked

const SYS_SCALE = 0.28;
const SYS_MAX_R = 250;

interface ViewBox { x: number; y: number; w: number; h: number }
const DEFAULT_VB: ViewBox = { x: 0, y: 0, w: FULL_W, h: FULL_H };

const BG_STARS = [
  { x: 80,   y: 60  }, { x: 200,  y: 35  }, { x: 380,  y: 20  }, { x: 550,  y: 55  },
  { x: 720,  y: 30  }, { x: 900,  y: 50  }, { x: 1050, y: 25  }, { x: 1150, y: 80  },
  { x: 30,   y: 180 }, { x: 140,  y: 250 }, { x: 310,  y: 200 }, { x: 460,  y: 170 },
  { x: 640,  y: 210 }, { x: 820,  y: 180 }, { x: 980,  y: 220 }, { x: 1120, y: 190 },
  { x: 50,   y: 380 }, { x: 230,  y: 420 }, { x: 430,  y: 390 }, { x: 600,  y: 440 },
  { x: 780,  y: 400 }, { x: 960,  y: 430 }, { x: 1100, y: 370 }, { x: 70,   y: 570 },
  { x: 270,  y: 610 }, { x: 480,  y: 580 }, { x: 700,  y: 620 }, { x: 880,  y: 590 },
  { x: 1050, y: 640 }, { x: 1170, y: 560 }, { x: 160,  y: 740 }, { x: 380,  y: 760 },
  { x: 600,  y: 775 }, { x: 820,  y: 750 }, { x: 1000, y: 770 },
];

// Triangle pointing upward, centered at (cx, cy) with half-height r
const tri = (cx: number, cy: number, r: number) =>
  `${cx},${cy - r} ${cx - r * 0.7},${cy + r * 0.6} ${cx + r * 0.7},${cy + r * 0.6}`;

// Fleet formation: lead (large) + left-medium + right-small
const FLEET_SHIPS = [
  { dx: 0,   dy:  0, r: 14 },
  { dx: -18, dy: 10, r: 10 },
  { dx:  14, dy: 12, r:  7 },
];

// Deterministic dot cluster for asteroid fields — seed from body id
function asteroidDots(seed: string): { x: number; y: number; r: number }[] {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) | 0;
  const COUNT = 8;
  return Array.from({ length: COUNT }, (_, i) => {
    // Golden angle spiral for even base distribution
    const angle = i * 2.399963;
    const radius = Math.sqrt((i + 0.5) / COUNT) * 14;
    // Seed-based jitter so each field looks unique
    h = (Math.imul(h, 1664525) + 1013904223) | 0;
    const jx = ((h >>> 8) & 0xff) / 255 * 6 - 3;
    h = (Math.imul(h, 1664525) + 1013904223) | 0;
    const jy = ((h >>> 8) & 0xff) / 255 * 6 - 3;
    h = (Math.imul(h, 1664525) + 1013904223) | 0;
    const r = Math.round((1.5 + ((h >>> 8) & 0xf) / 15 * 2) * 1e2) / 1e2;
    return {
      x: Math.round((radius * Math.cos(angle) + jx) * 1e4) / 1e4,
      y: Math.round((radius * Math.sin(angle) + jy) * 1e4) / 1e4,
      r,
    };
  });
}

function getBodyPos(orbitPos: number, orbitDist: number) {
  const rad = ((orbitPos - 90) * Math.PI) / 180;
  const r = orbitDist * SYS_MAX_R;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { x: round(r * Math.cos(rad)), y: round(r * Math.sin(rad)) };
}

interface SectorMapProps {
  sector: SectorMetadata;
  systemsData?: Record<string, StarSystemMetadata>;
  onSystemChange?: (slug: string | null) => void;
}

export default function SectorMap({ sector, systemsData = {}, onSystemChange }: SectorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState<ViewBox>(DEFAULT_VB);
  const [cursorGrab, setCursorGrab] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [activeSystemSlug, setActiveSystemSlug] = useState<string | null>(null);
  const [activeBodyId, setActiveBodyId] = useState<string | null>(null);

  useEffect(() => {
    onSystemChange?.(activeSystemSlug);
  }, [activeSystemSlug, onSystemChange]);
  const panStart = useRef<{ x: number; y: number; vbX: number; vbY: number } | null>(null);
  const pinchStart = useRef<{ dist: number; vb: ViewBox } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});

  const zoom = FULL_W / vb.w;
  const nebulaColor = sector.nebulaColor ?? sector.color;

  const screenToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x: FULL_W / 2, y: FULL_H / 2 };
      const rect = el.getBoundingClientRect();
      return {
        x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
        y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
      };
    },
    [vb]
  );

  const zoomAt = useCallback((svgX: number, svgY: number, factor: number) => {
    setVb((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (FULL_W / prev.w) * factor));
      const newW = FULL_W / newZoom;
      const newH = FULL_H / newZoom;
      const ratio = newW / prev.w;
      return {
        x: svgX - (svgX - prev.x) * ratio,
        y: svgY - (svgY - prev.y) * ratio,
        w: newW, h: newH,
      };
    });
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const pt = screenToSvg(e.clientX, e.clientY);
      zoomAt(pt.x, pt.y, e.deltaY < 0 ? 1 + ZOOM_STEP : 1 / (1 + ZOOM_STEP));
    },
    [screenToSvg, zoomAt]
  );
  wheelHandlerRef.current = handleWheel;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setCursorGrab(true);
      panStart.current = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y };
    },
    [vb.x, vb.y]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pan = panStart.current;
    if (!pan || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setVb((prev) => ({
      ...prev,
      x: pan.vbX - ((e.clientX - pan.x) / rect.width) * prev.w,
      y: pan.vbY - ((e.clientY - pan.y) / rect.height) * prev.h,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    setCursorGrab(false);
    panStart.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        panStart.current = { x: t.clientX, y: t.clientY, vbX: vb.x, vbY: vb.y };
        pinchStart.current = null;
      } else if (e.touches.length === 2) {
        panStart.current = null;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStart.current = { dist: Math.sqrt(dx * dx + dy * dy), vb: { ...vb } };
      }
    },
    [vb]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && panStart.current && containerRef.current) {
      const t = e.touches[0];
      const pan = panStart.current;
      const rect = containerRef.current.getBoundingClientRect();
      setVb((prev) => ({
        ...prev,
        x: pan.vbX - ((t.clientX - pan.x) / rect.width) * prev.w,
        y: pan.vbY - ((t.clientY - pan.y) / rect.height) * prev.h,
      }));
    } else if (e.touches.length === 2 && pinchStart.current && containerRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchStart.current.dist;
      const rect = containerRef.current.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const svgX = pinchStart.current.vb.x + ((midX - rect.left) / rect.width) * pinchStart.current.vb.w;
      const svgY = pinchStart.current.vb.y + ((midY - rect.top) / rect.height) * pinchStart.current.vb.h;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (FULL_W / pinchStart.current.vb.w) * scale));
      const newW = FULL_W / newZoom;
      const newH = FULL_H / newZoom;
      const ratio = newW / pinchStart.current.vb.w;
      setVb({
        x: svgX - (svgX - pinchStart.current.vb.x) * ratio,
        y: svgY - (svgY - pinchStart.current.vb.y) * ratio,
        w: newW, h: newH,
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    panStart.current = null;
    pinchStart.current = null;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => wheelHandlerRef.current(e);
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", prevent);
    };
  }, []);

  const resetView = useCallback(() => {
    setActiveSystemSlug(null);
    setActiveBodyId(null);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVb(DEFAULT_VB);
  }, []);

  const zoomIn  = useCallback(() => zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 + ZOOM_STEP * 2), [vb, zoomAt]);
  const zoomOut = useCallback(() => zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 / (1 + ZOOM_STEP * 2)), [vb, zoomAt]);

  // Focus a system: zoom the viewBox to centre on it
  const focusSystem = useCallback((pin: SystemPin) => {
    setActiveSystemSlug(pin.slug);
    setActiveBodyId(null);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const w = FULL_W / FOCUS_ZOOM;
    const h = FULL_H / FOCUS_ZOOM;
    setVb({ x: pin.x - w / 2, y: pin.y - h / 2, w, h });
  }, []);

  // Exit system view, return to sector overview
  const exitSystem = useCallback(() => {
    setActiveSystemSlug(null);
    setActiveBodyId(null);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVb(DEFAULT_VB);
  }, []);

  // Escape key exits system zoom
  useEffect(() => {
    if (!activeSystemSlug) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitSystem(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSystemSlug, exitSystem]);

  // Body hover/tap helpers (700ms gap tolerance)
  const showBody = useCallback((id: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setActiveBodyId(id);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setActiveBodyId(null), 700);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden rounded-lg border border-indigo-500/20"
        style={{
          cursor: cursorGrab ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={resetView}
      >
        {/* ── Layer 1: Fixed nebula background (CSS, never zooms) ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              `radial-gradient(ellipse 70% 60% at 38% 38%, ${nebulaColor}2e 0%, transparent 100%)`,
              `radial-gradient(ellipse 55% 50% at 68% 65%, ${nebulaColor}1e 0%, transparent 100%)`,
              `radial-gradient(ellipse 45% 40% at 18% 72%, ${sector.color}14 0%, transparent 100%)`,
              "#030712",
            ].join(", "),
          }}
        />

        {/* ── Layer 2: Fixed stars + grid (non-zooming SVG) ── */}
        <svg
          viewBox={`0 0 ${FULL_W} ${FULL_H}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ userSelect: "none" }}
        >
          {[1,2,3,4,5,6,7,8,9].map((i) => (
            <line key={`gx-${i}`}
              x1={i * (FULL_W / 10)} y1={0} x2={i * (FULL_W / 10)} y2={FULL_H}
              stroke="rgba(99,102,241,0.045)" strokeWidth="1" />
          ))}
          {[1,2,3,4,5,6,7,8,9].map((i) => (
            <line key={`gy-${i}`}
              x1={0} y1={i * (FULL_H / 10)} x2={FULL_W} y2={i * (FULL_H / 10)}
              stroke="rgba(99,102,241,0.045)" strokeWidth="1" />
          ))}
          {BG_STARS.map((star, i) => (
            <circle key={i} cx={star.x} cy={star.y}
              r={i % 3 === 0 ? 1 : 0.7} fill="white" opacity={0.25 + (i % 5) * 0.07} />
          ))}
        </svg>

        {/* ── Layer 3: Zooming SVG ── */}
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="absolute inset-0 w-full h-full"
          style={{ userSelect: "none" }}
          onClick={() => { if (activeSystemSlug) exitSystem(); else if (activeBodyId) setActiveBodyId(null); }}
        >
          {/* Gradient defs for every system */}
          <defs>
            {sector.systems.flatMap((pin) => {
              const sys = systemsData[pin.slug];
              if (!sys) return [];
              return [
                <radialGradient key={`starGlow-${pin.slug}`} id={`starGlow-${pin.slug}`}>
                  <stop offset="0%"   stopColor={sys.star.color} stopOpacity="1"   />
                  <stop offset="30%"  stopColor={sys.star.color} stopOpacity="0.8" />
                  <stop offset="60%"  stopColor={sys.star.secondaryColor ?? sys.star.color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={sys.star.secondaryColor ?? sys.star.color} stopOpacity="0"   />
                </radialGradient>,
                <radialGradient key={`starCorona-${pin.slug}`} id={`starCorona-${pin.slug}`}>
                  <stop offset="0%"   stopColor={sys.star.color} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={sys.star.color} stopOpacity="0"    />
                </radialGradient>,
                ...sys.bodies.map((b) => {
                  const { color, secondaryColor } = getBodyColors(b);
                  return (
                    <radialGradient key={`body-${pin.slug}-${b.id}`} id={`body-${pin.slug}-${b.id}`}>
                      <stop offset="0%"   stopColor={color} stopOpacity="1"   />
                      <stop offset="70%"  stopColor={secondaryColor} stopOpacity="0.9" />
                      <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.7" />
                    </radialGradient>
                  );
                }),
              ];
            })}
          </defs>

          {/* ── Sector territory ── */}
          {(() => {
            const t = SECTOR_TERRITORY[sector.slug];
            if (!t) return null;
            const { cx, cy, arcStart, arcEnd } = t;

            // Arc path for the sector name label, placed just outside the outer ring.
            // bottom-right and bottom-left sweep in a direction that would render text
            // upside-down, so reverse the path for those sectors.
            const labelR = TERRITORY_OUTER_R + 30;
            const ls = toRad(arcStart), le = toRad(arcEnd);
            const lxs = cx + labelR * Math.cos(ls), lys = cy + labelR * Math.sin(ls);
            const lxe = cx + labelR * Math.cos(le), lye = cy + labelR * Math.sin(le);
            const needsReverse = sector.slug === "bottom-right" || sector.slug === "bottom-left";
            const labelPathD = needsReverse
              ? `M ${lxe} ${lye} A ${labelR} ${labelR} 0 0 0 ${lxs} ${lys}`
              : `M ${lxs} ${lys} A ${labelR} ${labelR} 0 0 1 ${lxe} ${lye}`;
            const labelPathId = `sector-label-${sector.slug}`;

            return (
              <g style={{ pointerEvents: "none" }}>
                <defs>
                  <path id={labelPathId} d={labelPathD} />
                </defs>
                <path d={wedgePath(cx, cy, TERRITORY_INNER_R, TERRITORY_OUTER_R, arcStart, arcEnd)}
                  fill={sector.color} fillOpacity={0.07} />
                <path d={arcStroke(cx, cy, TERRITORY_OUTER_R, arcStart, arcEnd)}
                  fill="none" stroke={sector.color} strokeOpacity={0.25} strokeWidth={1.5} />
                <path d={arcStroke(cx, cy, TERRITORY_INNER_R, arcStart, arcEnd)}
                  fill="none" stroke={sector.color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="4 8" />
                {[arcStart, arcEnd].map((deg) => {
                  const r = toRad(deg);
                  return (
                    <line key={deg}
                      x1={cx + TERRITORY_INNER_R * Math.cos(r)} y1={cy + TERRITORY_INNER_R * Math.sin(r)}
                      x2={cx + TERRITORY_OUTER_R * Math.cos(r)} y2={cy + TERRITORY_OUTER_R * Math.sin(r)}
                      stroke={sector.color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="6 10" />
                  );
                })}
                <text
                  fontFamily="var(--font-cinzel), serif"
                  fontSize="32"
                  fontWeight="600"
                  fill={sector.color}
                  fillOpacity={0.3}
                  letterSpacing="14"
                >
                  <textPath href={`#${labelPathId}`} startOffset="50%" textAnchor="middle">
                    {sector.name.toUpperCase()}
                  </textPath>
                </text>
              </g>
            );
          })()}

          {/* ── Vortexes ── */}
          {(sector.vortexes ?? []).map((v: VortexPin) => {
            const color = v.color ?? sector.color;
            const r = v.radius ?? 80;
            const [rw, rh] = v.ratio ?? [1, 1];
            const ry = r * (rh / Math.max(rw, rh));
            return (
              <g key={v.slug} style={{ pointerEvents: "none" }}>
                <path d={wavyCloudPath(v.x, v.y, r, v.ratio)}
                  fill={color} fillOpacity={0.12}
                  stroke={color} strokeOpacity={0.35} strokeWidth={1.5} />
                <text x={v.x} y={v.y + ry + 18} textAnchor="middle"
                  fill={color} fillOpacity={0.75} fontSize="11"
                  fontFamily="var(--font-cinzel), serif">
                  {v.name}
                </text>
              </g>
            );
          })}

          {/* ── Star systems ── */}
          {sector.systems.map((pin) => {
            const sys = systemsData[pin.slug];
            const isActive = activeSystemSlug === pin.slug;
            const isDimmed = activeSystemSlug !== null && !isActive;

            const orbitDistances = sys
              ? [...new Set(sys.bodies.map((b) => b.orbitDistance))].sort()
              : [];
            const maxOrbit = sys
              ? Math.max(...sys.bodies.map((b) => b.orbitDistance), 0.3) * SYS_MAX_R
              : 40;
            const labelY = pin.y + (maxOrbit + 30) * SYS_SCALE + 14;

            return (
              <g
                key={pin.slug}
                style={{
                  cursor: activeSystemSlug === null ? "pointer" : "default",
                  opacity: isDimmed ? 0.2 : 1,
                  transition: "opacity 0.3s",
                }}
                onClick={isActive ? (e) => e.stopPropagation() : activeSystemSlug === null ? () => focusSystem(pin) : undefined}
                onMouseEnter={activeSystemSlug === null ? () => setHoveredSlug(pin.slug) : undefined}
                onMouseLeave={activeSystemSlug === null ? () => setHoveredSlug(null) : undefined}
              >
                {/* Hit area — only when no system is focused */}
                {activeSystemSlug === null && (
                  <circle cx={pin.x} cy={pin.y} r={(maxOrbit + 20) * SYS_SCALE} fill="transparent" />
                )}

                {sys ? (
                  <g transform={`translate(${pin.x}, ${pin.y}) scale(${SYS_SCALE})`}>
                    {/* Orbit rings */}
                    {orbitDistances.map((dist) => (
                      <circle key={dist} cx={0} cy={0} r={dist * SYS_MAX_R}
                        fill="none" stroke="rgba(99,102,241,0.15)"
                        strokeWidth="1" strokeDasharray="6 10" />
                    ))}

                    {/* Star */}
                    <circle cx={0} cy={0} r={80} fill={`url(#starCorona-${pin.slug})`}
                      style={{ animation: "starPulse 4s ease-in-out infinite" }} />
                    <circle cx={0} cy={0} r={40} fill={`url(#starGlow-${pin.slug})`} />
                    <circle cx={0} cy={0} r={22} fill={sys.star.color}
                      style={{ filter: `drop-shadow(0 0 12px ${sys.star.color})` }} />
                    <text x={0} y={55} textAnchor="middle"
                      fill={sys.star.color} fontSize="15"
                      fontFamily="var(--font-cinzel), serif" fontWeight="600">
                      {sys.star.name}
                    </text>
                    {isActive && sys.star.kankaUrl && (
                      <a href={sys.star.kankaUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <text x={0} y={74} textAnchor="middle"
                          fill="rgba(165,180,252,0.6)" fontSize="11"
                          fontFamily="var(--font-cinzel), serif"
                          style={{ cursor: "pointer" }}>
                          ↗ Kanka
                        </text>
                      </a>
                    )}

                    {/* Celestial bodies */}
                    {sys.bodies.map((body) => {
                      const pos = getBodyPos(body.orbitPosition, body.orbitDistance);
                      const isBodyActive = isActive && activeBodyId === body.id;
                      const { color: bodyColor } = getBodyColors(body);
                      const fillId = `url(#body-${pin.slug}-${body.id})`;
                      const activeStroke = isBodyActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)";
                      const glowStyle = isBodyActive ? { filter: `drop-shadow(0 0 8px ${bodyColor})` } : undefined;

                      // Label offset: how far below/above the visual bounding box
                      const labelR =
                        body.type === "fleet" ? 22 :
                        body.type === "asteroid-field" ? 32 :
                        body.type === "station" ? 10 : 12;

                      return (
                        <g
                          key={body.id}
                          style={{ cursor: isActive ? "pointer" : "default" }}
                          onMouseEnter={isActive ? () => showBody(body.id) : undefined}
                          onMouseLeave={isActive ? scheduleHide : undefined}
                          onClick={isActive ? (e) => { e.stopPropagation(); showBody(body.id); } : undefined}
                        >
                          {/* Large hit area when active */}
                          {isActive && (
                            <circle cx={pos.x} cy={pos.y} r={36} fill="transparent" />
                          )}

                          {/* ── Shape by type ── */}
                          {body.type === "station" && (
                            <polygon
                              points={`${pos.x},${pos.y - 10} ${pos.x + 9},${pos.y} ${pos.x},${pos.y + 10} ${pos.x - 9},${pos.y}`}
                              fill={fillId}
                              stroke={isBodyActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)"}
                              strokeWidth={isBodyActive ? "2" : "1"}
                              style={glowStyle}
                            />
                          )}

                          {body.type === "ship" && (
                            <polygon
                              points={tri(pos.x, pos.y, 10)}
                              fill={fillId}
                              stroke={activeStroke}
                              strokeWidth={isBodyActive ? "2" : "0.8"}
                              style={glowStyle}
                            />
                          )}

                          {body.type === "fleet" && (
                            <g style={glowStyle}>
                              {FLEET_SHIPS.map(({ dx, dy, r }, i) => (
                                <polygon
                                  key={i}
                                  points={tri(pos.x + dx, pos.y + dy, r)}
                                  fill={bodyColor}
                                  fillOpacity={0.9}
                                  stroke={activeStroke}
                                  strokeWidth={isBodyActive ? "1.5" : "0.6"}
                                />
                              ))}
                            </g>
                          )}

                          {body.type === "asteroid-field" && (
                            <g style={glowStyle}>
                              {asteroidDots(body.id).map((d, i) => (
                                <circle
                                  key={i}
                                  cx={pos.x + d.x} cy={pos.y + d.y} r={d.r}
                                  fill={bodyColor}
                                  fillOpacity={0.55 + (i % 5) * 0.08}
                                />
                              ))}
                            </g>
                          )}

                          {body.type !== "station" && body.type !== "ship" && body.type !== "fleet" && body.type !== "asteroid-field" && (
                            <circle cx={pos.x} cy={pos.y} r={12}
                              fill={fillId}
                              stroke={activeStroke}
                              strokeWidth={isBodyActive ? "2" : "0.5"}
                              style={glowStyle}
                            />
                          )}

                          {/* Lathanium indicator — small intense blue diamond, top-right */}
                          {body.lathanium && (() => {
                            const dx = pos.x + labelR * 0.85;
                            const dy = pos.y - labelR * 0.85;
                            const s = 5;
                            return (
                              <polygon
                                points={`${dx},${dy - s} ${dx + s},${dy} ${dx},${dy + s} ${dx - s},${dy}`}
                                fill="#1D4ED8"
                                stroke="#93C5FD"
                                strokeWidth="1.2"
                                style={{ filter: "drop-shadow(0 0 4px #3B82F6)" }}
                              />
                            );
                          })()}

                          {/* Nobility restriction — hollow inverted golden triangle, top-right */}
                          {body.nobility && (() => {
                            const dx = pos.x + labelR * 0.85;
                            const dy = pos.y - labelR * 0.85;
                            const s = 6;
                            return (
                              <polygon
                                points={`${dx - s},${dy - s * 0.6} ${dx + s},${dy - s * 0.6} ${dx},${dy + s * 0.8}`}
                                fill="none"
                                stroke="#FDE047"
                                strokeWidth="2"
                                style={{ filter: "drop-shadow(0 0 6px #FDE047)" }}
                              />
                            );
                          })()}

                          <text x={pos.x} y={body.labelPosition === "top" ? pos.y - labelR - 6 : pos.y + labelR + 18} textAnchor="middle"
                            fill={isBodyActive ? "white" : "rgba(255,255,255,0.6)"} fontSize="14"
                            fontFamily="var(--font-cinzel), serif">
                            {body.name}
                          </text>

                          {/* Info card — shown on hover/tap when system is active */}
                          {isBodyActive && (
                            <foreignObject
                              x={pos.x - 100} y={pos.y - 130}
                              width={200} height={130}
                              style={{ pointerEvents: "auto", overflow: "visible" }}
                              onMouseEnter={cancelHide}
                              onMouseLeave={scheduleHide}
                            >
                              <div style={{
                                background: "rgba(10,10,30,0.92)",
                                border: `1px solid ${bodyColor}55`,
                                borderRadius: "6px",
                                padding: "8px 10px",
                                fontFamily: "var(--font-cinzel), serif",
                                width: "200px",
                                boxSizing: "border-box",
                                boxShadow: `0 0 20px ${bodyColor}30`,
                              }}>
                                <div style={{ color: bodyColor, fontSize: "11px", fontWeight: 600, marginBottom: "3px" }}>
                                  {body.name}
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "9px", marginBottom: body.lathanium ? "6px" : "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  {body.type}{body.biome ? ` · ${body.biome}` : ""}
                                </div>
                                {body.lathanium && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: body.nobility ? "4px" : undefined }}>
                                    <span style={{ display: "inline-block", width: "7px", height: "7px", background: "#1D4ED8", transform: "rotate(45deg)", boxShadow: "0 0 4px #3B82F6", flexShrink: 0 }} />
                                    <span style={{ color: "#93C5FD", fontSize: "9px", letterSpacing: "0.05em" }}>This planet has Lathanium</span>
                                  </div>
                                )}
                                {body.nobility && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                    <svg width="9" height="9" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                                      <polygon points="0,1 10,1 5,9" fill="none" stroke="#FDE047" strokeWidth="1.5" />
                                    </svg>
                                    <span style={{ color: "#FDE047", fontSize: "9px", letterSpacing: "0.05em" }}>Restricted to nobility only</span>
                                  </div>
                                )}
                                {body.kankaUrl && (
                                  <a href={body.kankaUrl} target="_blank" rel="noopener noreferrer" style={{
                                    display: "block",
                                    marginTop: "8px",
                                    padding: "4px 8px",
                                    background: "rgba(99,102,241,0.15)",
                                    border: "1px solid rgba(99,102,241,0.3)",
                                    borderRadius: "4px",
                                    color: "rgba(165,180,252,0.9)",
                                    fontSize: "9px",
                                    textAlign: "center",
                                    letterSpacing: "0.08em",
                                    textDecoration: "none",
                                    textTransform: "uppercase",
                                  }}>
                                    View on Kanka ↗
                                  </a>
                                )}
                              </div>
                            </foreignObject>
                          )}
                        </g>
                      );
                    })}
                  </g>
                ) : (
                  <circle cx={pin.x} cy={pin.y} r={8}
                    fill={sector.color}
                    style={{ filter: `drop-shadow(0 0 8px ${sector.color})` }}
                  />
                )}

                {/* System name label — hidden while system is active (replaced by star name inside) */}
                {!isActive && (
                  <>
                    <text
                      x={pin.x} y={labelY} textAnchor="middle"
                      fill={hoveredSlug === pin.slug ? "white" : "rgba(255,255,255,0.55)"}
                      fontSize="11" fontFamily="var(--font-cinzel), serif"
                      style={{ pointerEvents: "none" }}
                    >
                      {sys?.name ?? pin.slug}
                    </text>
                    {sys?.kankaUrl && (
                      <a href={sys.kankaUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <text x={pin.x} y={labelY + 16} textAnchor="middle"
                          fill="rgba(165,180,252,0.5)" fontSize="9"
                          fontFamily="var(--font-cinzel), serif"
                          style={{ cursor: "pointer" }}>
                          ↗ Kanka
                        </text>
                      </a>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Empty state */}
          {sector.systems.length === 0 && (
            <g style={{ pointerEvents: "none" }}>
              <text x={FULL_W / 2} y={FULL_H / 2 - 10}
                textAnchor="middle" dominantBaseline="middle"
                fill="rgba(255,255,255,0.18)" fontSize="18"
                fontFamily="var(--font-cinzel), serif">
                No charted systems in this sector
              </text>
              <text x={FULL_W / 2} y={FULL_H / 2 + 18}
                textAnchor="middle"
                fill="rgba(255,255,255,0.1)" fontSize="12"
                fontFamily="var(--font-cinzel), serif">
                This region awaits exploration
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ── Controls ── */}

      {/* Back to sector — shown while a system is focused */}
      {activeSystemSlug && (
        <button
          onClick={exitSystem}
          className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded scifi-card text-xs text-slate-300 hover:text-white transition-colors"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          <span>&#x2190;</span>
          <span>Sector</span>
        </button>
      )}

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button onClick={zoomIn} aria-label="Zoom in"
          className="w-8 h-8 rounded scifi-card flex items-center justify-center text-white/70 hover:text-white text-lg leading-none transition-colors">
          +
        </button>
        <button onClick={zoomOut} aria-label="Zoom out"
          className="w-8 h-8 rounded scifi-card flex items-center justify-center text-white/70 hover:text-white text-lg leading-none transition-colors">
          &#x2212;
        </button>
        <button onClick={resetView} aria-label="Reset view"
          className="w-8 h-8 rounded scifi-card flex items-center justify-center text-white/70 hover:text-white text-xs leading-none transition-colors">
          &#x21BB;
        </button>
      </div>

      <div className="absolute bottom-3 left-3 text-[10px] text-slate-500 select-none pointer-events-none">
        {zoom.toFixed(1)}x
      </div>
    </div>
  );
}
