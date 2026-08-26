"use client";

import {
  INTEGRITY_CELLS,
  countIntact,
  integrityTier,
  isCellIntact,
} from "@/lib/campaign/integrity";

// Libra's integrity, drawn as a ten-cell honeycomb in rows of 3-4-3.
//
// Geometry: pointy-top hexes on a horizontal pitch of P, which fixes the row
// pitch at 0.75 × the hex height for the rows to interlock. Everything below
// derives from P, so changing the size is a one-constant edit.

const P = 60; // horizontal centre-to-centre spacing
const HEX_W = 54; // rendered width, leaving a 6px gutter between neighbours
const HEX_H = (HEX_W * 2) / Math.sqrt(3);
const ROW_Y = 0.75 * ((P * 2) / Math.sqrt(3));

const ORIGIN_Y = 40;

/** Row layout 3-4-3. Order matters: the index is the cell's identity below. */
const CELLS: { x: number; y: number }[] = [
  { x: P, y: ORIGIN_Y }, // 0
  { x: 2 * P, y: ORIGIN_Y }, // 1
  { x: 3 * P, y: ORIGIN_Y }, // 2
  { x: P / 2, y: ORIGIN_Y + ROW_Y }, // 3
  { x: 1.5 * P, y: ORIGIN_Y + ROW_Y }, // 4
  { x: 2.5 * P, y: ORIGIN_Y + ROW_Y }, // 5
  { x: 3.5 * P, y: ORIGIN_Y + ROW_Y }, // 6
  { x: P, y: ORIGIN_Y + 2 * ROW_Y }, // 7
  { x: 2 * P, y: ORIGIN_Y + 2 * ROW_Y }, // 8
  { x: 3 * P, y: ORIGIN_Y + 2 * ROW_Y }, // 9
];

const VIEW_W = 4 * P;
const VIEW_H = ORIGIN_Y * 2 + 2 * ROW_Y;

/** `scale` shrinks the hex about its own centre, for the inner facet line. */
function hexPoints(cx: number, cy: number, scale = 1): string {
  const a = (HEX_W / 2) * scale;
  const q = (HEX_H / 4) * scale;
  const half = (HEX_H / 2) * scale;
  return [
    [cx, cy - half],
    [cx + a, cy - q],
    [cx + a, cy + q],
    [cx, cy + half],
    [cx - a, cy + q],
    [cx - a, cy - q],
  ]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

interface Props {
  /** 10-bit mask; bit i set means cell i is intact. */
  cells: number;
  /** Superadmin only. Clicking a cell toggles exactly that cell. */
  onToggle?: (index: number, intact: boolean) => void;
}

export default function IntegrityHexCluster({ cells, onToggle }: Props) {
  const intact = countIntact(cells);
  const tier = integrityTier(intact);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full max-w-[340px] overflow-visible"
      role="img"
      aria-label={`Integrity ${intact} of ${INTEGRITY_CELLS} — ${tier.label}`}
    >
      <defs>
        <radialGradient id="ct-hex-live" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={tier.color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={tier.color} stopOpacity="0.16" />
        </radialGradient>
        <filter id="ct-hex-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {CELLS.map((cell, i) => {
        const alive = isCellIntact(cells, i);
        const isFailed = !alive;
        const points = hexPoints(cell.x, cell.y);
        const interactive = Boolean(onToggle);

        return (
          <g
            key={i}
            className={alive && tier.alarm ? "ct-hex-critical" : undefined}
            style={{ animationDelay: `${i * 120}ms` }}
            onClick={onToggle ? () => onToggle(i, !alive) : undefined}
          >
            <polygon
              points={points}
              fill={isFailed ? "rgba(148,163,184,0.05)" : "url(#ct-hex-live)"}
              stroke={isFailed ? "rgba(148,163,184,0.22)" : tier.color}
              strokeWidth={isFailed ? 1 : 1.6}
              filter={isFailed ? undefined : "url(#ct-hex-glow)"}
              className={`transition-all duration-300 ${
                interactive ? "cursor-pointer" : ""
              }`}
            />
            {/* Inner facet — catches the eye on live cells, absent on dead ones */}
            {!isFailed && (
              <polygon
                points={hexPoints(cell.x, cell.y, 0.55)}
                fill="none"
                stroke={tier.color}
                strokeOpacity="0.4"
                strokeWidth="0.9"
              />
            )}
            {interactive && (
              <>
                {/* Full-hex hit target: without it only the stroke and the
                    translucent fill respond, and a dead cell is nearly
                    transparent — the hardest one to click back on. */}
                <polygon points={points} fill="transparent" className="cursor-pointer" />
                <title>{`${alive ? "Damage" : "Repair"} cell ${i + 1}`}</title>
              </>
            )}
            {/* A struck-out cross marks a lost cell */}
            {isFailed && (
              <g stroke="rgba(148,163,184,0.28)" strokeWidth="1.1">
                <line x1={cell.x - 9} y1={cell.y - 9} x2={cell.x + 9} y2={cell.y + 9} />
                <line x1={cell.x + 9} y1={cell.y - 9} x2={cell.x - 9} y2={cell.y + 9} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
