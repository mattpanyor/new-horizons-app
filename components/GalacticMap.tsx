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
  "atlas-sector":   { arcStart: 270, arcEnd: 360 },
  "denerum-sector": { arcStart: 0,   arcEnd: 90  },
  "castell-sector": { arcStart: 90,  arcEnd: 180 },
  "vintar-sector":  { arcStart: 180, arcEnd: 270 },
};

const CORE_SLUG = "imperial-core";

interface GalacticMapProps {
  sectors: SectorMetadata[];
  children?: React.ReactNode;
}

export default function GalacticMap({ sectors, children }: GalacticMapProps) {
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
        {/* Server-rendered: defs, background, stars, rings */}
        {children}

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
