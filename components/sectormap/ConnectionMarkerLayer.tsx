/**
 * Renders interactive ship/fleet markers along connection lines,
 * plus their info card tooltips.
 *
 * Static connection paths + labels are rendered server-side in SectorMapSvgLayer.
 * This component only handles the interactive marker layer.
 */
import type { ConnectionLine, SystemPin, VortexPin } from "@/types/sector";
import type { SvgViewBox } from "@/components/SvgTooltip";
import { SvgTooltip } from "@/components/SvgTooltip";
import { ALLEGIANCES } from "@/lib/allegiances";
import { SHIP_COLORS, FLEET_GRAD_TIP } from "@/lib/bodyColors";
import {
  SYS_SCALE, FLEET_SHIPS, triLeft,
  computeConnectionCurve, bezierAt, bezierTangent, endpointRadius,
} from "@/lib/sectorMapHelpers";

interface ConnectionMarkerLayerProps {
  connections: ConnectionLine[];
  systems: SystemPin[];
  vortexes: VortexPin[];
  sectorSlug: string;
  orbitDataMap: Map<string, { orbitDistances: number[]; maxOrbit: number }>;
  activeMarkerId: string | null;
  showMarker: (id: string) => void;
  scheduleHideMarker: () => void;
  markerCardEnter: () => void;
  markerCardLeave: () => void;
  vb: SvgViewBox;
}

export function ConnectionMarkerLayer({
  connections, systems, vortexes, sectorSlug, orbitDataMap,
  activeMarkerId, showMarker, scheduleHideMarker,
  markerCardEnter, markerCardLeave, vb,
}: ConnectionMarkerLayerProps) {
  return (
    <>
      {/* ── Markers (ship / fleet) along connection lines ── */}
      {connections.map((conn, connIdx) => {
        if (!conn.marker) return null;

        const fromObj = systems.find(s => s.slug === conn.from) ?? vortexes.find(v => v.slug === conn.from);
        const toObj = systems.find(s => s.slug === conn.to) ?? vortexes.find(v => v.slug === conn.to);
        if (!fromObj || !toObj) return null;

        const fromRadius = endpointRadius(conn.from, systems, vortexes, orbitDataMap);
        const toRadius = endpointRadius(conn.to, systems, vortexes, orbitDataMap);

        const { p0t, p1, p2t } = computeConnectionCurve(
          fromObj, toObj, conn.curvature ?? 0, fromRadius, toRadius,
        );

        const marker = conn.marker;
        const isActive = activeMarkerId === String(connIdx);
        const t = Math.max(0, Math.min(1, marker.position));
        const mp = bezierAt(p0t, p1, p2t, t);
        const tan = bezierTangent(p0t, p1, p2t, t);
        const angle = Math.atan2(tan.y, tan.x) * 180 / Math.PI;
        const rotAngle = marker.type === "ship" ? angle + 90 : angle - 180;
        const shipGradId = `conn-ship-${connIdx}`;
        const allegiance = marker.allegiance ? ALLEGIANCES[marker.allegiance] : undefined;
        const shipSecondary = allegiance?.color ?? SHIP_COLORS.secondaryColor;

        return (
          <g key={`marker-${connIdx}`}
            transform={`translate(${mp.x.toFixed(1)},${mp.y.toFixed(1)}) rotate(${rotAngle.toFixed(1)})`}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onClick={(e) => { e.stopPropagation(); showMarker(String(connIdx)); }}
            onMouseEnter={() => showMarker(String(connIdx))}
            onMouseLeave={scheduleHideMarker}>

            {marker.type === "ship" && (
              <>
                <defs>
                  <radialGradient id={shipGradId}>
                    <stop offset="0%" stopColor={SHIP_COLORS.color} stopOpacity="1" />
                    <stop offset="70%" stopColor={shipSecondary} stopOpacity="0.9" />
                    <stop offset="100%" stopColor={shipSecondary} stopOpacity="0.7" />
                  </radialGradient>
                </defs>
                <polygon points="0,-9 -6,5 6,5"
                  fill={`url(#${shipGradId})`}
                  stroke={isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)"}
                  strokeWidth={isActive ? "1.5" : "0.5"}
                  style={{ filter: `drop-shadow(0 0 ${isActive ? 8 : 3}px ${SHIP_COLORS.color})` }} />
              </>
            )}

            {marker.type === "fleet" && (
              <g style={{ filter: isActive ? `drop-shadow(0 0 8px ${FLEET_GRAD_TIP})` : undefined }}>
                {FLEET_SHIPS.map(({ dx, dy, r }, i) => (
                  <polygon key={i} points={triLeft(dx * 0.5, dy * 0.5, r * 0.5)}
                    fill={`url(#fleetGrad-${sectorSlug})`} fillOpacity={0.9}
                    stroke={isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)"}
                    strokeWidth={isActive ? "1" : "0.4"} />
                ))}
              </g>
            )}
          </g>
        );
      })}

      {/* ── Connection marker info card — top layer ── */}
      {activeMarkerId !== null && (() => {
        const connIdx = parseInt(activeMarkerId);
        const conn = connections[connIdx];
        const marker = conn?.marker;
        if (!conn || !marker) return null;

        const fromObj = systems.find(s => s.slug === conn.from) ?? vortexes.find(v => v.slug === conn.from);
        const toObj = systems.find(s => s.slug === conn.to) ?? vortexes.find(v => v.slug === conn.to);
        if (!fromObj || !toObj) return null;

        const fromRadius = endpointRadius(conn.from, systems, vortexes, orbitDataMap);
        const toRadius = endpointRadius(conn.to, systems, vortexes, orbitDataMap);

        const { p0t, p1, p2t } = computeConnectionCurve(
          fromObj, toObj, conn.curvature ?? 0, fromRadius, toRadius,
        );

        const t = Math.max(0, Math.min(1, marker.position));
        const mp = bezierAt(p0t, p1, p2t, t);

        const allegiance = marker.allegiance ? ALLEGIANCES[marker.allegiance] : undefined;
        const cardAccent = allegiance?.color ?? SHIP_COLORS.color;
        const cardW = 220;
        const cardH = 50 + (marker.kankaUrl ? 34 : 0);

        return (
          <g transform={`translate(${mp.x.toFixed(1)},${mp.y.toFixed(1)}) scale(${SYS_SCALE * 2})`}>
            <SvgTooltip
              anchorX={0} anchorY={0}
              cardW={cardW} cardH={cardH}
              color={cardAccent} clearance={42}
              viewBox={vb}
              parentOffsetX={mp.x} parentOffsetY={mp.y}
              scale={SYS_SCALE * 2}
              onMouseEnter={markerCardEnter} onMouseLeave={markerCardLeave}>
              <div style={{ display: "flex", alignItems: "stretch", gap: "6px", marginBottom: "5px" }}>
                <div style={{ flex: "0 0 70%" }}>
                  <div style={{ color: cardAccent, fontSize: "11px", fontWeight: 600, marginBottom: "3px" }}>
                    {marker.name}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {marker.type}
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
