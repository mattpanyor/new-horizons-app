"use client";

import type { ShipLayer, ShipBay } from "@/types/ship";

interface ShipSvgLayerProps {
  layer: ShipLayer;
  layerIndex: number;
  totalLayers: number;
  onBayClick: (bay: ShipBay, layer: ShipLayer) => void;
  hoveredBay: string | null;
  onBayHover: (bayId: string | null) => void;
}

type Point = [number, number];

/** Hull edge points for interpolating edge-aligned bay boundaries. */
function getHullEdges(layerIndex: number, W: number, H: number) {
  const edges: Record<number, { top: Point[]; bot: Point[] }> = {
    0: {
      top: [[W*.06,H*.5],[W*.1,H*.28],[W*.3,H*.3],[W*.5,H*.2],[W*.72,H*.28],[W*.84,H*.32],[W*.92,H*.42],[W*.95,H*.5]],
      bot: [[W*.06,H*.5],[W*.1,H*.72],[W*.3,H*.7],[W*.5,H*.8],[W*.72,H*.72],[W*.84,H*.68],[W*.92,H*.58],[W*.95,H*.5]],
    },
    1: {
      top: [[W*.04,H*.5],[W*.07,H*.2],[W*.27,H*.22],[W*.47,H*.1],[W*.7,H*.18],[W*.83,H*.22],[W*.94,H*.38],[W*.97,H*.5]],
      bot: [[W*.04,H*.5],[W*.07,H*.8],[W*.27,H*.78],[W*.47,H*.9],[W*.7,H*.82],[W*.83,H*.78],[W*.94,H*.62],[W*.97,H*.5]],
    },
    2: {
      top: [[W*.02,H*.5],[W*.05,H*.15],[W*.25,H*.18],[W*.45,H*.05],[W*.7,H*.15],[W*.85,H*.2],[W*.95,H*.35],[W*.98,H*.5]],
      bot: [[W*.02,H*.5],[W*.05,H*.85],[W*.25,H*.82],[W*.45,H*.95],[W*.7,H*.85],[W*.85,H*.8],[W*.95,H*.65],[W*.98,H*.5]],
    },
    3: {
      top: [[W*.1,H*.5],[W*.13,H*.3],[W*.3,H*.32],[W*.48,H*.22],[W*.65,H*.3],[W*.76,H*.34],[W*.85,H*.43],[W*.88,H*.5]],
      bot: [[W*.1,H*.5],[W*.13,H*.7],[W*.3,H*.68],[W*.48,H*.78],[W*.65,H*.7],[W*.76,H*.66],[W*.85,H*.57],[W*.88,H*.5]],
    },
  };
  return edges[layerIndex] ?? edges[3];
}

function interpEdge(edge: Point[], x: number): number {
  if (x <= edge[0][0]) return edge[0][1];
  if (x >= edge[edge.length - 1][0]) return edge[edge.length - 1][1];
  for (let i = 0; i < edge.length - 1; i++) {
    const [x0, y0] = edge[i];
    const [x1, y1] = edge[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return edge[edge.length - 1][1];
}

/** Trace hull edge from x0 to x1 with N sample points. */
function traceEdge(edge: Point[], x0: number, x1: number, steps = 8): Point[] {
  const pts: Point[] = [];
  for (let s = 0; s <= steps; s++) {
    const x = x0 + (x1 - x0) * (s / steps);
    pts.push([x, interpEdge(edge, x)]);
  }
  return pts;
}

function ptsToPath(pts: Point[]): string {
  return `M ${pts.map(([x, y]) => `${x},${y}`).join(" L ")} Z`;
}

/**
 * Evenly divide the hull into equal slices for each bay.
 * Each slice runs from hull top edge to hull bottom edge.
 */
function getBayZones(layerIndex: number, W: number, H: number, bays: ShipBay[]) {
  const { top, bot } = getHullEdges(layerIndex, W, H);
  const zones: Record<string, { path: string; lx: number; ly: number }> = {};

  // Find hull x extent
  const hullLeft = top[0][0];
  const hullRight = top[top.length - 1][0];
  const hullWidth = hullRight - hullLeft;
  const n = bays.length;

  bays.forEach((bay, i) => {
    const x0 = hullLeft + (i / n) * hullWidth;
    const x1 = hullLeft + ((i + 1) / n) * hullWidth;
    const midX = (x0 + x1) / 2;

    const topPts = traceEdge(top, x0, x1);
    const botPts = traceEdge(bot, x1, x0);
    zones[bay.id] = {
      path: ptsToPath([...topPts, ...botPts]),
      lx: midX,
      ly: H * 0.5,
    };
  });

  return zones;
}

function getHullGeometry(layerIndex: number, W: number, H: number) {
  switch (layerIndex) {
    case 0: {
      const yMid = H * 0.5;
      return {
        hull: `M ${W*.06} ${yMid} Q ${W*.1} ${H*.28}, ${W*.3} ${H*.3} Q ${W*.5} ${H*.2}, ${W*.72} ${H*.28} Q ${W*.84} ${H*.32}, ${W*.92} ${H*.42} L ${W*.95} ${yMid} L ${W*.92} ${H*.58} Q ${W*.84} ${H*.68}, ${W*.72} ${H*.72} Q ${W*.5} ${H*.8}, ${W*.3} ${H*.7} Q ${W*.1} ${H*.72}, ${W*.06} ${yMid} Z`,
        wingTop: `M ${W*.22} ${H*.34} Q ${W*.18} ${H*.2}, ${W*.14} ${H*.18} L ${W*.17} ${H*.3} Z`,
        wingBot: `M ${W*.22} ${H*.66} Q ${W*.18} ${H*.8}, ${W*.14} ${H*.82} L ${W*.17} ${H*.7} Z`,
        extras: [{ type: "line" as const, x1: W*.75, y1: yMid, x2: W*.93, y2: yMid }],
      };
    }
    case 1:
      return {
        hull: `M ${W*.04} ${H*.5} Q ${W*.07} ${H*.2}, ${W*.27} ${H*.22} Q ${W*.47} ${H*.1}, ${W*.7} ${H*.18} Q ${W*.83} ${H*.22}, ${W*.94} ${H*.38} L ${W*.97} ${H*.5} L ${W*.94} ${H*.62} Q ${W*.83} ${H*.78}, ${W*.7} ${H*.82} Q ${W*.47} ${H*.9}, ${W*.27} ${H*.78} Q ${W*.07} ${H*.8}, ${W*.04} ${H*.5} Z`,
        wingTop: `M ${W*.2} ${H*.26} Q ${W*.14} ${H*.06}, ${W*.08} ${H*.02} L ${W*.12} ${H*.18} Z`,
        wingBot: `M ${W*.2} ${H*.74} Q ${W*.14} ${H*.94}, ${W*.08} ${H*.98} L ${W*.12} ${H*.82} Z`,
        extras: [],
      };
    case 2:
      return {
        hull: `M ${W*.02} ${H*.5} Q ${W*.05} ${H*.15}, ${W*.25} ${H*.18} Q ${W*.45} ${H*.05}, ${W*.7} ${H*.15} Q ${W*.85} ${H*.2}, ${W*.95} ${H*.35} L ${W*.98} ${H*.5} L ${W*.95} ${H*.65} Q ${W*.85} ${H*.8}, ${W*.7} ${H*.85} Q ${W*.45} ${H*.95}, ${W*.25} ${H*.82} Q ${W*.05} ${H*.85}, ${W*.02} ${H*.5} Z`,
        wingTop: `M ${W*.2} ${H*.22} Q ${W*.15} ${H*.02}, ${W*.08} ${H*.0} L ${W*.12} ${H*.15} Z`,
        wingBot: `M ${W*.2} ${H*.78} Q ${W*.15} ${H*.98}, ${W*.08} ${H*1.0} L ${W*.12} ${H*.85} Z`,
        extras: [],
      };
    case 3:
    default:
      return {
        hull: `M ${W*.1} ${H*.5} Q ${W*.13} ${H*.3}, ${W*.3} ${H*.32} Q ${W*.48} ${H*.22}, ${W*.65} ${H*.3} Q ${W*.76} ${H*.34}, ${W*.85} ${H*.43} L ${W*.88} ${H*.5} L ${W*.85} ${H*.57} Q ${W*.76} ${H*.66}, ${W*.65} ${H*.7} Q ${W*.48} ${H*.78}, ${W*.3} ${H*.68} Q ${W*.13} ${H*.7}, ${W*.1} ${H*.5} Z`,
        wingTop: `M ${W*.23} ${H*.35} Q ${W*.2} ${H*.24}, ${W*.16} ${H*.22} L ${W*.19} ${H*.31} Z`,
        wingBot: `M ${W*.23} ${H*.65} Q ${W*.2} ${H*.76}, ${W*.16} ${H*.78} L ${W*.19} ${H*.69} Z`,
        extras: [{ type: "line" as const, x1: W*.3, y1: H*.5, x2: W*.88, y2: H*.5 }],
      };
  }
}

export default function ShipSvgLayer({
  layer,
  layerIndex,
  onBayClick,
  hoveredBay,
  onBayHover,
}: ShipSvgLayerProps) {
  const W = 800;
  const H = 200;

  const { hull: hullPath, wingTop, wingBot, extras } = getHullGeometry(layerIndex, W, H);
  const bayZones = getBayZones(layerIndex, W, H, layer.bays);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ filter: `drop-shadow(0 0 8px ${layer.color}30)` }}
    >
      <defs>
        <linearGradient id={`hull-${layer.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={layer.color} stopOpacity="0.15" />
          <stop offset="50%" stopColor={layer.color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={layer.color} stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`hull-stroke-${layer.id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={layer.color} stopOpacity="0.3" />
          <stop offset="50%" stopColor={layer.color} stopOpacity="0.7" />
          <stop offset="100%" stopColor={layer.color} stopOpacity="0.3" />
        </linearGradient>
        <pattern id={`grid-${layer.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={layer.color} strokeWidth="0.3" strokeOpacity="0.15" />
        </pattern>
        <clipPath id={`hull-clip-${layer.id}`}>
          <path d={hullPath} />
        </clipPath>
      </defs>

      {/* Hull fill */}
      <path d={hullPath} fill={`url(#hull-${layer.id})`} stroke={`url(#hull-stroke-${layer.id})`} strokeWidth="1.5" />

      {/* Grid overlay */}
      <rect x="0" y="0" width={W} height={H} fill={`url(#grid-${layer.id})`} clipPath={`url(#hull-clip-${layer.id})`} />

      {/* Wings */}
      <path d={wingTop} fill={layer.color} fillOpacity="0.1" stroke={layer.color} strokeWidth="0.8" strokeOpacity="0.4" />
      <path d={wingBot} fill={layer.color} fillOpacity="0.1" stroke={layer.color} strokeWidth="0.8" strokeOpacity="0.4" />

      {/* Extra detail lines */}
      {extras.map((ex, i) =>
        ex.type === "line" ? (
          <line key={i} x1={ex.x1} y1={ex.y1} x2={ex.x2} y2={ex.y2}
            stroke={layer.color} strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="6 4" />
        ) : null
      )}

      {/* Center line */}
      <line x1={W*.05} y1={H*.5} x2={W*.95} y2={H*.5}
        stroke={layer.color} strokeWidth="0.5" strokeOpacity="0.12" strokeDasharray="4 8" />

      {/* Bay zones */}
      {layer.bays.map((bay) => {
        const zone = bayZones[bay.id];
        if (!zone) return null;
        const isHovered = hoveredBay === bay.id;

        return (
          <g
            key={bay.id}
            className="cursor-pointer"
            onClick={() => onBayClick(bay, layer)}
            onMouseEnter={() => onBayHover(bay.id)}
            onMouseLeave={() => onBayHover(null)}
          >
            <path
              d={zone.path}
              fill={layer.color}
              fillOpacity={isHovered ? 0.28 : 0.06}
              stroke={layer.color}
              strokeWidth={isHovered ? 1.2 : 0.6}
              strokeOpacity={isHovered ? 0.8 : 0.3}
              strokeDasharray={isHovered ? "none" : "3 3"}
              style={{ transition: "all 0.2s ease" }}
            />
            <text
              x={zone.lx}
              y={zone.ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fillOpacity={isHovered ? 0.9 : 0.45}
              fontSize="8"
              fontFamily="var(--font-cinzel), serif"
              letterSpacing="0.08em"
              style={{ textTransform: "uppercase", transition: "all 0.2s ease", pointerEvents: "none" }}
            >
              {bay.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
