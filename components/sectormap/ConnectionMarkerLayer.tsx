/**
 * Renders interactive ship/fleet markers along connection lines,
 * plus their info card tooltips.
 *
 * Static connection paths + labels are rendered server-side in SectorMapSvgLayer.
 * This component only handles the interactive marker layer.
 */
import type { ConnectionLine, SystemPin, VortexPin, MapMarker } from "@/types/sector";
import type { SvgViewBox } from "@/components/SvgTooltip";
import { SvgTooltip } from "@/components/SvgTooltip";
import { ALLEGIANCES } from "@/lib/allegiances";
import { SHIP_COLORS, FLEET_GRAD_TIP, MARKER_COLORS } from "@/lib/bodyColors";
import {
  SYS_SCALE, FLEET_SHIPS, triLeft,
  computeConnectionCurve, bezierAt, bezierTangent, endpointRadius,
} from "@/lib/sectorMapHelpers";

function findEndpoint(slug: string, systems: SystemPin[], vortexes: VortexPin[], markers: MapMarker[]): { x: number; y: number } | undefined {
  return systems.find(s => s.slug === slug)
    ?? vortexes.find(v => v.slug === slug)
    ?? markers.find(m => m.slug === slug && m.x != null && m.y != null) as { x: number; y: number } | undefined;
}

interface ConnectionMarkerLayerProps {
  connections: ConnectionLine[];
  systems: SystemPin[];
  vortexes: VortexPin[];
  markers: MapMarker[];
  sectorSlug: string;
  orbitDataMap: Map<string, { orbitDistances: number[]; maxOrbit: number }>;
  activeMarkerId: string | null;
  showMarker: (id: string) => void;
  scheduleHideMarker: () => void;
  markerCardEnter: () => void;
  markerCardLeave: () => void;
  vb: SvgViewBox;
  // Edit-mode passthroughs. When isEditing, the visible marker click no
  // longer pops the tooltip card — instead it calls editPick so the right-
  // rail Selection panel opens with this marker's form (and its Move button).
  isEditing?: boolean;
  editPick?: (m: MapMarker) => void;
  selectedMarkerId?: number | null;
}

export function ConnectionMarkerLayer({
  connections, systems, vortexes, markers, sectorSlug, orbitDataMap,
  activeMarkerId, showMarker, scheduleHideMarker,
  markerCardEnter, markerCardLeave, vb,
  isEditing, editPick, selectedMarkerId,
}: ConnectionMarkerLayerProps) {
  return (
    <>
      {/* ── Markers (ship / fleet / anomaly / poi) along connection lines ── */}
      {connections.map((conn, connIdx) => {
        if (!conn.marker) return null;

        const fromObj = findEndpoint(conn.from, systems, vortexes, markers);
        const toObj = findEndpoint(conn.to, systems, vortexes, markers);
        if (!fromObj || !toObj) return null;

        const fromRadius = endpointRadius(conn.from, systems, vortexes, orbitDataMap, markers);
        const toRadius = endpointRadius(conn.to, systems, vortexes, orbitDataMap, markers);

        const { p0t, p1, p2t } = computeConnectionCurve(
          fromObj, toObj, conn.curvature ?? 0, fromRadius, toRadius,
        );

        const marker = conn.marker;
        // Tooltip identity keyed by marker.id when present so reordering the
        // connections array (layer filter change, etc.) doesn't swap the
        // active tooltip onto a different marker. Falls back to connIdx for
        // pending-create markers that don't have a DB id yet.
        const tooltipKey = marker.id !== undefined ? `m${marker.id}` : `c${connIdx}`;
        const isActive = activeMarkerId === tooltipKey;
        const t = Math.max(0, Math.min(1, marker.position ?? 0.5));
        const mp = bezierAt(p0t, p1, p2t, t);
        const tan = bezierTangent(p0t, p1, p2t, t);
        const angle = Math.atan2(tan.y, tan.x) * 180 / Math.PI;
        const rotAngle = marker.type === "ship" ? angle + 90 : angle - 180;
        const markerGradId = `conn-marker-${connIdx}`;
        const allegiance = marker.allegiance ? ALLEGIANCES[marker.allegiance] : undefined;
        const shipSecondary = allegiance?.color ?? SHIP_COLORS.secondaryColor;

        const isSelectedInEdit = isEditing && selectedMarkerId !== undefined && selectedMarkerId === marker.id;
        return (
          <g key={`marker-${connIdx}`}
            transform={`translate(${mp.x.toFixed(1)},${mp.y.toFixed(1)}) rotate(${rotAngle.toFixed(1)})`}
            style={{
              cursor: isEditing ? "pointer" : "pointer",
              pointerEvents: "all",
              filter: isSelectedInEdit ? "drop-shadow(0 0 6px rgba(251,191,36,0.8))" : undefined,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isEditing && editPick) editPick(marker);
              else showMarker(tooltipKey);
            }}
            onMouseEnter={() => { if (!isEditing) showMarker(tooltipKey); }}
            onMouseLeave={scheduleHideMarker}>
            {/* Fat invisible hit target in edit mode — ships/fleets are small
                and the line they sit on grabs nearby clicks. This gives a
                reliable selection area. */}
            {isEditing && <circle cx={0} cy={0} r={16} fill="transparent" />}

            {marker.type === "ship" && (
              <>
                <defs>
                  <radialGradient id={markerGradId}>
                    <stop offset="0%" stopColor={SHIP_COLORS.color} stopOpacity="1" />
                    <stop offset="70%" stopColor={shipSecondary} stopOpacity="0.9" />
                    <stop offset="100%" stopColor={shipSecondary} stopOpacity="0.7" />
                  </radialGradient>
                </defs>
                <polygon points="0,-9 -6,5 6,5"
                  fill={`url(#${markerGradId})`}
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
      {activeMarkerId !== null && !activeMarkerId.startsWith("free-") && (() => {
        // tooltipKey is `m<markerId>` for DB-backed markers or `c<connIdx>`
        // for pending-create markers (see the producer above). parseInt on
        // those prefixed keys yields NaN, so resolve the connection per scheme.
        const conn = activeMarkerId.startsWith("m")
          ? connections.find((c) => c.marker?.id === Number(activeMarkerId.slice(1)))
          : connections[parseInt(activeMarkerId.slice(1))];
        const marker = conn?.marker;
        if (!conn || !marker) return null;

        const fromObj = findEndpoint(conn.from, systems, vortexes, markers);
        const toObj = findEndpoint(conn.to, systems, vortexes, markers);
        if (!fromObj || !toObj) return null;

        const fromRadius = endpointRadius(conn.from, systems, vortexes, orbitDataMap, markers);
        const toRadius = endpointRadius(conn.to, systems, vortexes, orbitDataMap, markers);

        const { p0t, p1, p2t } = computeConnectionCurve(
          fromObj, toObj, conn.curvature ?? 0, fromRadius, toRadius,
        );

        const t = Math.max(0, Math.min(1, marker.position ?? 0.5));
        const mp = bezierAt(p0t, p1, p2t, t);

        const allegiance = marker.allegiance ? ALLEGIANCES[marker.allegiance] : undefined;
        const connColors = MARKER_COLORS[marker.type] ?? SHIP_COLORS;
        const cardAccent = allegiance?.color ?? connColors.color;
        const cardW = 220;
        const cardH = 50 + (marker.externalUrl ? 34 : 0);

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
                    {marker.type === "ship" ? "Ship" : marker.type === "fleet" ? "Fleet" : marker.type}
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
              {marker.externalUrl && (
                <a href={marker.externalUrl} target="_blank" rel="noopener noreferrer" style={{
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
