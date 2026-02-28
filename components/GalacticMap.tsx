"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SectorMetadata } from "@/types/sector";
import { toRad, annularSectorPath } from "@/lib/svgGeometry";

const W = 600;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const INNER_R = 82;   // inner edge of sector arcs (gap around core)
const OUTER_R = 260;  // outer edge of sector arcs
const LABEL_R = 171;  // radius for sector name labels (midpoint)
const BADGE_R = 220;  // radius for system-count badges

// Angular layout for each sector slug (SVG degrees: 0°=right, clockwise, y-down)
// Upper-right = ~315°, lower-right = ~45°, lower-left = ~135°, upper-left = ~225°
const SECTOR_OFFSET = 10; // px each sector is pushed outward along its diagonal

const SECTOR_LAYOUT: Record<string, { arcStart: number; arcEnd: number }> = {
  "top-right":    { arcStart: 270, arcEnd: 360 },
  "bottom-right": { arcStart: 0,   arcEnd: 90  },
  "bottom-left":  { arcStart: 90,  arcEnd: 180 },
  "top-left":     { arcStart: 180, arcEnd: 270 },
};

const CORE_SLUG = "core";

// Static star field — deterministic positions for visual texture
const STARS = [
  { x: 60,  y: 80,  r: 0.8 }, { x: 540, y: 70,  r: 1.0 }, { x: 150, y: 45,  r: 0.6 },
  { x: 480, y: 120, r: 0.9 }, { x: 380, y: 30,  r: 0.7 }, { x: 80,  y: 200, r: 1.1 },
  { x: 30,  y: 310, r: 0.8 }, { x: 55,  y: 430, r: 0.6 }, { x: 100, y: 520, r: 1.0 },
  { x: 200, y: 560, r: 0.7 }, { x: 370, y: 575, r: 0.9 }, { x: 500, y: 555, r: 0.8 },
  { x: 555, y: 450, r: 1.1 }, { x: 575, y: 320, r: 0.6 }, { x: 560, y: 190, r: 0.9 },
  { x: 460, y: 50,  r: 0.7 }, { x: 290, y: 25,  r: 1.0 }, { x: 120, y: 160, r: 0.8 },
  { x: 40,  y: 380, r: 0.7 }, { x: 130, y: 495, r: 0.9 }, { x: 430, y: 530, r: 0.6 },
  { x: 520, y: 400, r: 1.0 }, { x: 490, y: 250, r: 0.8 }, { x: 440, y: 170, r: 0.7 },
  { x: 340, y: 560, r: 1.1 }, { x: 165, y: 540, r: 0.6 }, { x: 65,  y: 145, r: 0.9 },
  { x: 580, y: 145, r: 0.7 }, { x: 20,  y: 250, r: 0.8 }, { x: 585, y: 260, r: 1.0 },
];

interface GalacticMapProps {
  sectors: SectorMetadata[];
}

export default function GalacticMap({ sectors }: GalacticMapProps) {
  const router = useRouter();
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const coreSector = sectors.find((s) => s.slug === CORE_SLUG);
  const outerSectors = sectors.filter((s) => s.slug !== CORE_SLUG && SECTOR_LAYOUT[s.slug]);

  return (
    <div className="relative w-full max-w-xl mx-auto aspect-square">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        style={{ userSelect: "none" }}
      >
        <defs>
          {/* Galaxy background gradient */}
          <radialGradient id="galaxyBg" cx="50%" cy="50%">
            <stop offset="0%"   stopColor="#1a0a2e" />
            <stop offset="35%"  stopColor="#0c0618" />
            <stop offset="100%" stopColor="#020108" />
          </radialGradient>

          {/* Diagonal hatch for inactive sectors */}
          <pattern id="inactiveHatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45 0 0)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
          </pattern>

          {/* Core glow layers */}
          {coreSector && (
            <>
              <radialGradient id="coreGlow" cx="50%" cy="50%">
                <stop offset="0%"   stopColor={coreSector.color} stopOpacity="1"   />
                <stop offset="30%"  stopColor={coreSector.color} stopOpacity="0.8" />
                <stop offset="60%"  stopColor={coreSector.color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={coreSector.color} stopOpacity="0"   />
              </radialGradient>
              <radialGradient id="coreCorona" cx="50%" cy="50%">
                <stop offset="0%"   stopColor={coreSector.color} stopOpacity="0.12" />
                <stop offset="100%" stopColor={coreSector.color} stopOpacity="0"    />
              </radialGradient>
            </>
          )}

          {/* Per-sector gradients for hover glow (active sectors only) */}
          {outerSectors.filter((s) => s.published !== false).map((s) => (
            <radialGradient key={`sg-${s.slug}`} id={`sg-${s.slug}`} cx="50%" cy="50%">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.05" />
            </radialGradient>
          ))}
        </defs>

        {/* ── Background — soft radial disk, blends into page starfield ── */}
        <circle cx={CX} cy={CY} r={OUTER_R + 50} fill="url(#galaxyBg)" opacity={0.75} />

        {/* Static star field */}
        {STARS.map((star, i) => (
          <circle
            key={i}
            cx={star.x} cy={star.y} r={star.r}
            fill="white" opacity={0.35 + (i % 5) * 0.1}
          />
        ))}

        {/* Faint concentric ring at outer edge for galaxy feel */}
        <circle cx={CX} cy={CY} r={OUTER_R + 12}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={OUTER_R + 28}
          fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />

        {/* ── Outer sectors ── */}
        {outerSectors.map((sector) => {
          const layout = SECTOR_LAYOUT[sector.slug];
          const isInactive = sector.published === false;
          const isHovered = !isInactive && hoveredSlug === sector.slug;
          const midDeg = (layout.arcStart + layout.arcEnd) / 2;
          const midRad = toRad(midDeg);
          const labelX = CX + LABEL_R * Math.cos(midRad);
          const labelY = CY + LABEL_R * Math.sin(midRad);
          const badgeX = CX + BADGE_R * Math.cos(midRad);
          const badgeY = CY + BADGE_R * Math.sin(midRad);
          const dx = Math.cos(midRad) * SECTOR_OFFSET;
          const dy = Math.sin(midRad) * SECTOR_OFFSET;
          const sectorPath = annularSectorPath(CX, CY, INNER_R, OUTER_R, layout.arcStart, layout.arcEnd);

          if (isInactive) {
            return (
              <g
                key={sector.slug}
                transform={`translate(${dx}, ${dy})`}
                style={{ cursor: "not-allowed" }}
              >
                {/* Gray base fill */}
                <path
                  d={sectorPath}
                  fill="#2a2a3a"
                  stroke="#3a3a4e"
                  strokeWidth="0.5"
                />
                {/* Diagonal hatch overlay */}
                <path
                  d={sectorPath}
                  fill="url(#inactiveHatch)"
                  stroke="none"
                />
                {/* Sector name — muted */}
                <text
                  x={labelX} y={labelY}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(255,255,255,0.2)"
                  fontSize="13"
                  fontFamily="var(--font-cinzel), serif"
                  fontWeight="400"
                  style={{ pointerEvents: "none" }}
                >
                  {sector.name}
                </text>
              </g>
            );
          }

          return (
            <g
              key={sector.slug}
              transform={`translate(${dx}, ${dy})`}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredSlug(sector.slug)}
              onMouseLeave={() => setHoveredSlug(null)}
              onClick={() => router.push(`/sectors/${sector.slug}`)}
            >
              {/* Sector fill */}
              <path
                d={sectorPath}
                fill={isHovered ? `${sector.color}45` : `${sector.color}22`}
                stroke={isHovered ? sector.color : `${sector.color}55`}
                strokeWidth={isHovered ? 1.5 : 0.5}
                style={
                  isHovered
                    ? { filter: `drop-shadow(0 0 10px ${sector.color}60)` }
                    : undefined
                }
              />

              {/* Outer arc highlight (rim glow on hover) */}
              {isHovered && (
                <path
                  d={annularSectorPath(CX, CY, OUTER_R - 6, OUTER_R, layout.arcStart, layout.arcEnd)}
                  fill={`${sector.color}30`}
                  stroke="none"
                />
              )}

              {/* Sector name */}
              <text
                x={labelX} y={labelY}
                textAnchor="middle" dominantBaseline="middle"
                fill={isHovered ? "white" : `${sector.color}cc`}
                fontSize="13"
                fontFamily="var(--font-cinzel), serif"
                fontWeight={isHovered ? "600" : "400"}
                style={{ pointerEvents: "none" }}
              >
                {sector.name}
              </text>

              {/* System count badge */}
              {sector.systems.length > 0 && (
                <>
                  <circle
                    cx={badgeX} cy={badgeY} r={12}
                    fill={`${sector.color}30`}
                    stroke={`${sector.color}80`}
                    strokeWidth="1"
                    style={{ pointerEvents: "none" }}
                  />
                  <text
                    x={badgeX} y={badgeY}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={sector.color}
                    fontSize="9"
                    fontFamily="var(--font-cinzel), serif"
                    style={{ pointerEvents: "none" }}
                  >
                    {sector.systems.length}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* ── Galactic Core ── */}
        {coreSector && (() => {
          const isCoreHovered = hoveredSlug === CORE_SLUG;
          return (
            <g
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredSlug(CORE_SLUG)}
              onMouseLeave={() => setHoveredSlug(null)}
              onClick={() => router.push(`/sectors/${CORE_SLUG}`)}
            >
              {/* Soft glow */}
              <circle
                cx={CX} cy={CY} r={INNER_R}
                fill={isCoreHovered ? `${coreSector.color}50` : `${coreSector.color}28`}
                style={isCoreHovered ? { filter: `drop-shadow(0 0 14px ${coreSector.color}90)` } : undefined}
              />
              {/* Sun body */}
              <circle
                cx={CX} cy={CY} r={INNER_R * 0.55}
                fill={coreSector.color}
                style={{ filter: `drop-shadow(0 0 10px ${coreSector.color})` }}
              />
              {/* Label */}
              <text
                x={CX} y={CY + INNER_R + 14}
                textAnchor="middle"
                fill={isCoreHovered ? "white" : `${coreSector.color}cc`}
                fontSize="11"
                fontFamily="var(--font-cinzel), serif"
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                {coreSector.name}
              </text>
            </g>
          );
        })()}

        {/* ── Hover tooltip strip ── */}
        {hoveredSlug && hoveredSlug !== CORE_SLUG && (() => {
          const s = sectors.find((x) => x.slug === hoveredSlug);
          if (!s || s.published === false) return null;
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={CX - 130} y={H - 44} width={260} height={32}
                rx="4"
                fill="rgba(15,23,42,0.85)"
                stroke={`${s.color}50`}
                strokeWidth="1"
              />
              <text x={CX} y={H - 24}
                textAnchor="middle"
                fill="rgba(255,255,255,0.7)" fontSize="10"
                fontFamily="var(--font-cinzel), serif"
              >
                {s.systems.length === 0
                  ? "No charted systems"
                  : `${s.systems.length} charted system${s.systems.length > 1 ? "s" : ""}`}
                {" · Click to explore"}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
