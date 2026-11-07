// Tooltip card content for a celestial body — name, type/biome, special attribute, kanka link.

import { SpecialAttributeCardLine } from "@/components/specialAttributes/SpecialAttributeCardLine";
import type { Allegiance } from "@/lib/allegiances";
import { MapInfoCard } from "@/components/sectormap/MapInfoCard";

interface BodyInfoCardProps {
  name: string;
  type: string;
  biome?: string;
  specialAttribute?: string;
  externalUrl?: string;
  bodyColor: string;
  allegiance?: Allegiance;
}

export function BodyInfoCard({ name, type, biome, specialAttribute, externalUrl, bodyColor, allegiance }: BodyInfoCardProps) {
  return (
    <MapInfoCard name={name} color={bodyColor} subtitle={`${type}${biome ? ` · ${biome}` : ""}`}
      allegiance={allegiance} externalUrl={externalUrl}>
      <SpecialAttributeCardLine type={specialAttribute} />
    </MapInfoCard>
  );
}

/** First-frame height estimate; SvgTooltip measures the real height after mount */
export function bodyCardHeight(specialAttribute?: string, externalUrl?: string, allegiance?: string): number {
  return 50
    + (allegiance ? 6 : 0)
    + (specialAttribute ? 20 : 0)
    + (externalUrl ? 34 : 0);
}
