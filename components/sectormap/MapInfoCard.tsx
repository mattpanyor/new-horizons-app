// Shared hover-card body for every map and system object (bodies, connection
// markers, free markers). Rendered inside SvgTooltip, which sizes to content:
// text never wraps, so a long title widens the card rather than adding lines.

import type { ReactNode } from "react";
import type { Allegiance } from "@/lib/allegiances";

export const OBJECT_TYPE_LABELS: Record<string, string> = {
  ship: "Ship",
  fleet: "Fleet",
  lightbringer: "Lightbringer",
  anomaly: "Anomaly",
  poi: "Point of Interest",
  "black-hole": "Black Hole",
};

interface MapInfoCardProps {
  name: string;
  color: string;
  /** Small uppercase line under the name (type, biome, allegiance name…) */
  subtitle: ReactNode;
  /** Shows the allegiance logo in a fixed-size column */
  allegiance?: Allegiance;
  externalUrl?: string;
  /** Extra rows between the header and the Kanka link (e.g. special attribute) */
  children?: ReactNode;
}

const LOGO = 28;

export function MapInfoCard({ name, color, subtitle, allegiance, externalUrl, children }: MapInfoCardProps) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
        <div style={{ flex: "1 1 auto", whiteSpace: "nowrap" }}>
          <div style={{ color, fontSize: "11px", fontWeight: 600, marginBottom: "3px", lineHeight: 1.25 }}>
            {name}
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {subtitle}
          </div>
        </div>
        {allegiance && (
          <img src={allegiance.logo} alt={allegiance.name} width={LOGO} height={LOGO}
            style={{ width: LOGO, height: LOGO, flex: `0 0 ${LOGO}px`, objectFit: "contain" }} />
        )}
      </div>
      {children}
      {externalUrl && (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer" style={{
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
