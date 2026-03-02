"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SectorMetadata } from "@/types/sector";
import { GalacticSector } from "@/components/galacticmap/GalacticSector";
import { GalacticCore } from "@/components/galacticmap/GalacticCore";
import { GalacticTooltipStrip } from "@/components/galacticmap/GalacticTooltipStrip";

const W = 600;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const INNER_R = 82;
const OUTER_R = 260;
const LABEL_R = 171;
const BADGE_R = 220;
const SECTOR_OFFSET = 10;

const SECTOR_LAYOUT: Record<string, { arcStart: number; arcEnd: number }> = {
  "top-right":    { arcStart: 270, arcEnd: 360 },
  "bottom-right": { arcStart: 0,   arcEnd: 90  },
  "bottom-left":  { arcStart: 90,  arcEnd: 180 },
  "top-left":     { arcStart: 180, arcEnd: 270 },
};

const CORE_SLUG = "core";

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

  const handleHover = useCallback((slug: string | null) => setHoveredSlug(slug), []);

  return (
    <div className="relative w-full max-w-xl mx-auto aspect-square">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        style={{ userSelect: "none" }}
      >
        <defs>
          <radialGradient id="galaxyBg" cx="50%" cy="50%">
            <stop offset="0%"   stopColor="#1a0a2e" />
            <stop offset="35%"  stopColor="#0c0618" />
            <stop offset="100%" stopColor="#020108" />
          </radialGradient>

          <pattern id="inactiveHatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45 0 0)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
          </pattern>

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

          {outerSectors.filter((s) => s.published !== false).map((s) => (
            <radialGradient key={`sg-${s.slug}`} id={`sg-${s.slug}`} cx="50%" cy="50%">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.05" />
            </radialGradient>
          ))}
        </defs>

        {/* Background */}
        <circle cx={CX} cy={CY} r={OUTER_R + 50} fill="url(#galaxyBg)" opacity={0.75} />

        {/* Star field */}
        {STARS.map((star, i) => (
          <circle
            key={i}
            cx={star.x} cy={star.y} r={star.r}
            fill="white" opacity={0.35 + (i % 5) * 0.1}
          />
        ))}

        {/* Ring lines */}
        <circle cx={CX} cy={CY} r={OUTER_R + 12}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={OUTER_R + 28}
          fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />

        {/* Outer sectors */}
        {outerSectors.map((sector) => {
          const layout = SECTOR_LAYOUT[sector.slug];
          return (
            <GalacticSector
              key={sector.slug}
              sector={sector}
              layout={layout}
              cx={CX} cy={CY}
              innerR={INNER_R} outerR={OUTER_R}
              labelR={LABEL_R} badgeR={BADGE_R}
              sectorOffset={SECTOR_OFFSET}
              isHovered={sector.published !== false && hoveredSlug === sector.slug}
              onHover={handleHover}
              onClick={() => router.push(`/sectors/${sector.slug}`)}
            />
          );
        })}

        {/* Core */}
        {coreSector && (
          <GalacticCore
            sector={coreSector}
            cx={CX} cy={CY}
            innerR={INNER_R}
            isHovered={hoveredSlug === CORE_SLUG}
            onHover={handleHover}
            onClick={() => router.push(`/sectors/${CORE_SLUG}`)}
          />
        )}

        {/* Tooltip strip */}
        {hoveredSlug && hoveredSlug !== CORE_SLUG && (() => {
          const s = sectors.find((x) => x.slug === hoveredSlug);
          if (!s || s.published === false) return null;
          return <GalacticTooltipStrip sector={s} cx={CX} h={H} />;
        })()}
      </svg>
    </div>
  );
}
