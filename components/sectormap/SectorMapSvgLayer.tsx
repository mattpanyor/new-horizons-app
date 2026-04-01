// Server Component — static SVG defs, territory arcs, allegiance blobs,
// connection line paths, and vortex shapes.
// No "use client" directive. Rendered inside the client <svg> via the staticSvgLayers prop.

import type { SectorMetadata } from "@/types/sector";
import type { StarSystemMetadata } from "@/types/starsystem";
import { getBodyColors, FLEET_GRAD_TIP, FLEET_GRAD_BASE } from "@/lib/bodyColors";
import { SYS_MAX_R } from "@/lib/sectorMapHelpers";
import { SectorArcLayer } from "./SectorArcLayer";
import { TerritoryLayer } from "./TerritoryLayer";

interface SectorMapSvgLayerProps {
  sector: SectorMetadata;
  systemsData: Record<string, StarSystemMetadata>;
}

export function SectorMapSvgLayer({ sector, systemsData }: SectorMapSvgLayerProps) {
  return (
    <>
      {/* ── Gradient defs ── */}
      <defs>
        <linearGradient id={`fleetGrad-${sector.slug}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={FLEET_GRAD_TIP} />
          <stop offset="100%" stopColor={FLEET_GRAD_BASE} />
        </linearGradient>
        {sector.systems.flatMap((pin) => {
          const sys = systemsData[pin.slug];
          if (!sys) return [];
          const stars = [sys.star, ...(sys.secondaryStar ? [sys.secondaryStar] : [])];
          return [
            ...stars.map((star, i) => {
              const suffix = i === 0 ? pin.slug : `${pin.slug}-secondary`;
              return [
                <radialGradient key={`starGlow-${suffix}`} id={`starGlow-${suffix}`}>
                  <stop offset="0%" stopColor={star.color} stopOpacity="1" />
                  <stop offset="30%" stopColor={star.color} stopOpacity="0.8" />
                  <stop offset="60%" stopColor={star.secondaryColor ?? star.color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={star.secondaryColor ?? star.color} stopOpacity="0" />
                </radialGradient>,
                <radialGradient key={`starCorona-${suffix}`} id={`starCorona-${suffix}`}>
                  <stop offset="0%" stopColor={star.color} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={star.color} stopOpacity="0" />
                </radialGradient>,
              ];
            }).flat(),
            ...sys.bodies.map((b) => {
              const { color, secondaryColor } = getBodyColors(b);
              return (
                <radialGradient key={`body-${pin.slug}-${b.id}`} id={`body-${pin.slug}-${b.id}`}>
                  <stop offset="0%" stopColor={color} stopOpacity="1" />
                  <stop offset="70%" stopColor={secondaryColor} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.7" />
                </radialGradient>
              );
            }),
          ];
        })}
      </defs>

      {/* ── Sector territory arcs ── */}
      <SectorArcLayer sectorSlug={sector.slug} sectorName={sector.name} sectorColor={sector.color} />

      {/* ── Allegiance territories ── */}
      <TerritoryLayer systems={sector.systems} sectorSlug={sector.slug} />

      {/* Connection lines, vortexes, and markers are rendered client-side in SectorMap
          to support layer filtering */}
    </>
  );
}
