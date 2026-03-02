// Tooltip card content for a celestial body — name, type/biome, special attribute, kanka link.

import { SpecialAttributeCardLine } from "@/components/specialAttributes/SpecialAttributeCardLine";

interface BodyInfoCardProps {
  name: string;
  type: string;
  biome?: string;
  specialAttribute?: string;
  kankaUrl?: string;
  bodyColor: string;
}

export function BodyInfoCard({ name, type, biome, specialAttribute, kankaUrl, bodyColor }: BodyInfoCardProps) {
  return (
    <>
      <div style={{ color: bodyColor, fontSize: "11px", fontWeight: 600, marginBottom: "3px" }}>
        {name}
      </div>
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "9px", marginBottom: specialAttribute ? "6px" : "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {type}{biome ? ` · ${biome}` : ""}
      </div>
      <SpecialAttributeCardLine type={specialAttribute} />
      {kankaUrl && (
        <a href={kankaUrl} target="_blank" rel="noopener noreferrer" style={{
          display: "block", marginTop: "8px", padding: "4px 8px",
          background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: "4px", color: "rgba(165,180,252,0.9)", fontSize: "9px",
          textAlign: "center", letterSpacing: "0.08em", textDecoration: "none",
          textTransform: "uppercase", pointerEvents: "auto",
        }}>
          View on Kanka ↗
        </a>
      )}
    </>
  );
}

/** Compute the card height based on body properties */
export function bodyCardHeight(specialAttribute?: string, kankaUrl?: string): number {
  return 50
    + (specialAttribute ? 20 : 0)
    + (kankaUrl ? 34 : 0);
}
