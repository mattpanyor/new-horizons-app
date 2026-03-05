import { memo } from "react";
import type { SystemPin } from "@/types/sector";
import type { AllegianceKey } from "@/lib/allegiances";
import { ALLEGIANCES } from "@/lib/allegiances";
import { annularSectorPath } from "@/lib/svgGeometry";
import {
  SECTOR_TERRITORY, TERRITORY_INNER_R, TERRITORY_OUTER_R,
  TERRITORY_RADIUS, wavyCloudPath,
} from "@/lib/sectorMapHelpers";

interface TerritoryLayerProps {
  systems: SystemPin[];
  sectorSlug: string;
}

export const TerritoryLayer = memo(function TerritoryLayer({ systems, sectorSlug }: TerritoryLayerProps) {
  const allegianceSystems = systems.filter(
    (p): p is SystemPin & { allegiance: AllegianceKey } => !!p.allegiance,
  );
  if (!allegianceSystems.length) return null;

  const t = SECTOR_TERRITORY[sectorSlug];
  const clipId = `sys-territory-clip-${sectorSlug}`;

  return (
    <g style={{ pointerEvents: "none" }}>
      {t && (
        <defs>
          <clipPath id={clipId}>
            <path d={annularSectorPath(t.cx, t.cy, TERRITORY_INNER_R, TERRITORY_OUTER_R, t.arcStart, t.arcEnd)} />
          </clipPath>
        </defs>
      )}
      <g clipPath={t ? `url(#${clipId})` : undefined}>
        {allegianceSystems.map(pin => {
          const allegiance = ALLEGIANCES[pin.allegiance];
          return (
            <path
              key={pin.slug}
              d={wavyCloudPath(pin.x, pin.y, pin.territoryRadius ?? TERRITORY_RADIUS, { seed: `${pin.x}_${pin.y}` })}
              fill={allegiance.color}
              fillOpacity={0.04}
              stroke={allegiance.color}
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          );
        })}
      </g>
    </g>
  );
});
