/**
 * Renders free-floating markers (not attached to connection lines)
 * on the sector map, with optional territory blobs and info card tooltips.
 */
import type { MapMarker } from "@/types/sector";
import type { SvgViewBox } from "@/components/SvgTooltip";
import { SvgTooltip } from "@/components/SvgTooltip";
import { ALLEGIANCES } from "@/lib/allegiances";
import { MARKER_COLORS, SHIP_COLORS } from "@/lib/bodyColors";
import { SYS_SCALE, FLEET_SHIPS, triLeft, wavyCloudPath } from "@/lib/sectorMapHelpers";

interface FreeMarkerLayerProps {
  markers: MapMarker[];
  sectorSlug: string;
  activeMarkerId: string | null;
  showMarker: (id: string) => void;
  scheduleHideMarker: () => void;
  markerCardEnter: () => void;
  markerCardLeave: () => void;
  vb: SvgViewBox;
}

export function FreeMarkerLayer({
  markers, sectorSlug,
  activeMarkerId, showMarker, scheduleHideMarker,
  markerCardEnter, markerCardLeave, vb,
}: FreeMarkerLayerProps) {
  return (
    <>
      {/* ── Territory blobs ── */}
      {markers.map((marker, idx) => {
        if (!marker.territoryRadius || marker.x == null || marker.y == null) return null;
        const colors = MARKER_COLORS[marker.type] ?? SHIP_COLORS;
        return (
          <path
            key={`free-territory-${idx}`}
            d={wavyCloudPath(marker.x, marker.y, marker.territoryRadius, { seed: `free_${idx}_${marker.x}_${marker.y}` })}
            fill={colors.color}
            fillOpacity={0.04}
            stroke={colors.color}
            strokeOpacity={0.1}
            strokeWidth={1}
            style={{ pointerEvents: "none" }}
          />
        );
      })}

      {/* ── Marker icons ── */}
      {markers.map((marker, idx) => {
        if (marker.x == null || marker.y == null) return null;

        const id = `free-${idx}`;
        const isActive = activeMarkerId === id;
        const angle = marker.angle ?? 0;
        const colors = MARKER_COLORS[marker.type] ?? SHIP_COLORS;
        const allegiance = marker.allegiance ? ALLEGIANCES[marker.allegiance] : undefined;
        const markerColor = allegiance?.color ?? colors.color;
        const gradId = `free-marker-grad-${sectorSlug}-${idx}`;

        return (
          <g key={id}
            transform={`translate(${marker.x.toFixed(1)},${marker.y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onClick={(e) => { e.stopPropagation(); showMarker(id); }}
            onMouseEnter={() => showMarker(id)}
            onMouseLeave={scheduleHideMarker}>

            {marker.type === "ship" && (
              <>
                <defs>
                  <radialGradient id={gradId}>
                    <stop offset="0%" stopColor={colors.color} stopOpacity="1" />
                    <stop offset="70%" stopColor={allegiance?.color ?? colors.secondaryColor} stopOpacity="0.9" />
                    <stop offset="100%" stopColor={allegiance?.color ?? colors.secondaryColor} stopOpacity="0.7" />
                  </radialGradient>
                </defs>
                <polygon points="0,-9 -6,5 6,5"
                  fill={`url(#${gradId})`}
                  stroke={isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)"}
                  strokeWidth={isActive ? "1.5" : "0.5"}
                  style={{ filter: `drop-shadow(0 0 ${isActive ? 8 : 3}px ${colors.color})` }} />
              </>
            )}

            {marker.type === "fleet" && (
              <g style={{ filter: isActive ? `drop-shadow(0 0 8px ${colors.color})` : undefined }}>
                {FLEET_SHIPS.map(({ dx, dy, r }, i) => (
                  <polygon key={i} points={triLeft(dx * 0.5, dy * 0.5, r * 0.5)}
                    fill={`url(#fleetGrad-${sectorSlug})`} fillOpacity={0.9}
                    stroke={isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)"}
                    strokeWidth={isActive ? "1" : "0.4"} />
                ))}
              </g>
            )}

            {marker.type === "anomaly" && (
              <>
                <defs>
                  <radialGradient id={gradId}>
                    <stop offset="0%" stopColor={markerColor} stopOpacity="0.8" />
                    <stop offset="60%" stopColor={markerColor} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={markerColor} stopOpacity="0" />
                  </radialGradient>
                </defs>
                {/* Outer glow */}
                <circle r="12" fill={`url(#${gradId})`}
                  style={{ filter: `drop-shadow(0 0 ${isActive ? 10 : 4}px ${markerColor})` }} />
                {/* Inner pulsing core */}
                <circle r="4" fill={markerColor} fillOpacity={isActive ? 0.9 : 0.6}
                  stroke={markerColor} strokeOpacity={0.4} strokeWidth="0.5" />
                {/* Orbiting ring */}
                <ellipse rx="8" ry="3" fill="none"
                  stroke={markerColor} strokeOpacity={isActive ? 0.6 : 0.3}
                  strokeWidth="0.6" strokeDasharray="2 3"
                  transform="rotate(30)" />
              </>
            )}

            {marker.type === "black-hole" && (
              <>
                <defs>
                  <radialGradient id={`${gradId}-lensing`}>
                    <stop offset="0%" stopColor={markerColor} stopOpacity="0" />
                    <stop offset="60%" stopColor={markerColor} stopOpacity="0" />
                    <stop offset="80%" stopColor={markerColor} stopOpacity="0.35" />
                    <stop offset="90%" stopColor="white" stopOpacity="0.15" />
                    <stop offset="100%" stopColor={markerColor} stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id={`${gradId}-disk`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={markerColor} stopOpacity="0" />
                    <stop offset="20%" stopColor={markerColor} stopOpacity="0.6" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.4" />
                    <stop offset="80%" stopColor={markerColor} stopOpacity="0.6" />
                    <stop offset="100%" stopColor={markerColor} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Lensing glow */}
                <circle r={14} fill={`url(#${gradId}-lensing)`}>
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="4s" repeatCount="indefinite" />
                </circle>
                {/* Back accretion disk */}
                <g transform="rotate(-20)">
                  <ellipse rx={20} ry={3} fill={`url(#${gradId}-disk)`} opacity="0.5" />
                </g>
                {/* Event horizon */}
                <circle r={7} fill="#000000" />
                {/* Photon ring */}
                <circle r={7.8} fill="none" stroke="white" strokeWidth={0.5} opacity="0.5">
                  <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle r={8.5} fill="none" stroke={markerColor} strokeWidth={0.7} opacity="0.4">
                  <animate attributeName="opacity" values="0.25;0.5;0.25" dur="2s" repeatCount="indefinite" />
                </circle>
                {/* Front accretion disk arc */}
                <g transform="rotate(-20)">
                  <clipPath id={`${gradId}-front`}>
                    <rect x={-25} y={0} width={50} height={8} />
                  </clipPath>
                  <ellipse rx={17} ry={2.5} fill={`url(#${gradId}-disk)`} opacity="0.7"
                    clipPath={`url(#${gradId}-front)`} />
                </g>
                {/* Lensed arc */}
                <path d="M -9,-2.5 A 9,9 0 0,1 9,-2.5"
                  fill="none" stroke={markerColor} strokeWidth={1.5} opacity="0.25">
                  <animate attributeName="opacity" values="0.15;0.35;0.15" dur="3s" repeatCount="indefinite" />
                </path>
              </>
            )}

            {marker.type === "poi" && (
              <>
                <defs>
                  <radialGradient id={gradId}>
                    <stop offset="0%" stopColor={markerColor} stopOpacity="0.6" />
                    <stop offset="100%" stopColor={markerColor} stopOpacity="0" />
                  </radialGradient>
                </defs>
                {/* Outer glow */}
                <circle r="10" fill={`url(#${gradId})`}
                  style={{ filter: `drop-shadow(0 0 ${isActive ? 8 : 3}px ${markerColor})` }} />
                {/* Diamond marker */}
                <polygon points="0,-7 5,0 0,7 -5,0"
                  fill={markerColor} fillOpacity={isActive ? 0.8 : 0.5}
                  stroke={isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)"}
                  strokeWidth={isActive ? "1" : "0.5"} />
                {/* Center dot */}
                <circle r="1.5" fill="white" fillOpacity={isActive ? 0.8 : 0.5} />
              </>
            )}
          </g>
        );
      })}

      {/* ── Free marker info cards ── */}
      {activeMarkerId?.startsWith("free-") && (() => {
        const idx = parseInt(activeMarkerId.replace("free-", ""));
        const marker = markers[idx];
        if (!marker || marker.x == null || marker.y == null) return null;

        const colors = MARKER_COLORS[marker.type] ?? SHIP_COLORS;
        const allegiance = marker.allegiance ? ALLEGIANCES[marker.allegiance] : undefined;
        const cardAccent = allegiance?.color ?? colors.color;
        const cardW = 220;
        const cardH = 50 + (marker.kankaUrl ? 34 : 0);

        const typeLabels: Record<string, string> = {
          ship: "Ship",
          fleet: "Fleet",
          anomaly: "Anomaly",
          poi: "Point of Interest",
          "black-hole": "Black Hole",
        };

        return (
          <g transform={`translate(${marker.x.toFixed(1)},${marker.y.toFixed(1)}) scale(${SYS_SCALE * 2})`}>
            <SvgTooltip
              anchorX={0} anchorY={0}
              cardW={cardW} cardH={cardH}
              color={cardAccent} clearance={42}
              viewBox={vb}
              parentOffsetX={marker.x} parentOffsetY={marker.y}
              scale={SYS_SCALE * 2}
              onMouseEnter={markerCardEnter} onMouseLeave={markerCardLeave}>
              <div style={{ display: "flex", alignItems: "stretch", gap: "6px", marginBottom: "5px" }}>
                <div style={{ flex: "0 0 70%" }}>
                  <div style={{ color: cardAccent, fontSize: "11px", fontWeight: 600, marginBottom: "3px" }}>
                    {marker.name}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {typeLabels[marker.type] ?? marker.type}
                    {allegiance && (
                      <>
                        <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
                        <span style={{ color: allegiance.color }}>{allegiance.name}</span>
                      </>
                    )}
                  </div>
                </div>
                {allegiance && (
                  <div style={{ flex: "0 0 30%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={allegiance.logo} alt={allegiance.name}
                      style={{ width: "28px", height: "28px", objectFit: "contain" }} />
                  </div>
                )}
              </div>
              {marker.kankaUrl && (
                <a href={marker.kankaUrl} target="_blank" rel="noopener noreferrer" style={{
                  display: "block", marginTop: "8px", padding: "4px 8px",
                  background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: "4px", color: "rgba(165,180,252,0.9)", fontSize: "9px",
                  textAlign: "center", letterSpacing: "0.08em", textDecoration: "none",
                  textTransform: "uppercase", pointerEvents: "auto",
                }}>
                  View on Kanka ↗
                </a>
              )}
            </SvgTooltip>
          </g>
        );
      })()}
    </>
  );
}
