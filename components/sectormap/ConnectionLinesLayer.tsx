"use client";

// Client component since edit mode needs click handlers on each connection
// path. Interactive markers stay in ConnectionMarkerLayer.

import type { ConnectionLine, SystemPin, VortexPin, MapMarker } from "@/types/sector";
import {
  computeConnectionCurve, perpNorm, endpointRadius,
} from "@/lib/sectorMapHelpers";

function findEndpoint(slug: string, systems: SystemPin[], vortexes: VortexPin[], markers: MapMarker[]): { x: number; y: number } | undefined {
  return systems.find(s => s.slug === slug)
    ?? vortexes.find(v => v.slug === slug)
    ?? markers.find(m => m.slug === slug && m.x != null && m.y != null) as { x: number; y: number } | undefined;
}

interface ConnectionLinesLayerProps {
  connections: ConnectionLine[];
  systems: SystemPin[];
  vortexes: VortexPin[];
  markers: MapMarker[];
  sectorColor: string;
  orbitDataMap: Map<string, { maxOrbit: number }>;
  // Edit-mode passthroughs: when isEditing, each path gets a fat invisible
  // hit-target overlay; selectedConnectionId draws the line accentuated.
  isEditing?: boolean;
  onPick?: (c: ConnectionLine) => void;
  selectedConnectionId?: number | null;
  selectedConnectionTempId?: string | null;
}

export function ConnectionLinesLayer({
  connections, systems, vortexes, markers, sectorColor, orbitDataMap,
  isEditing, onPick, selectedConnectionId, selectedConnectionTempId,
}: ConnectionLinesLayerProps) {
  return (
    <>
      {connections.map((conn, connIdx) => {
        const fromObj = findEndpoint(conn.from, systems, vortexes, markers);
        const toObj = findEndpoint(conn.to, systems, vortexes, markers);
        if (!fromObj || !toObj) return null;

        const fromRadius = endpointRadius(conn.from, systems, vortexes, orbitDataMap, markers);
        const toRadius = endpointRadius(conn.to, systems, vortexes, orbitDataMap, markers);

        const { p0t, p1, p2t } = computeConnectionCurve(
          fromObj, toObj, conn.curvature ?? 0, fromRadius, toRadius,
        );

        const pathD = `M ${p0t.x.toFixed(1)} ${p0t.y.toFixed(1)} Q ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${p2t.x.toFixed(1)} ${p2t.y.toFixed(1)}`;
        const color = conn.color ?? sectorColor;
        const opacity = conn.opacity ?? 0.35;
        const dashes = conn.dashes ?? "4 6";

        // Offset path for label text
        const LABEL_GAP = 15;
        const n0 = perpNorm(p1.x - p0t.x, p1.y - p0t.y);
        const n1 = perpNorm(p2t.x - p0t.x, p2t.y - p0t.y);
        const n2 = perpNorm(p2t.x - p1.x, p2t.y - p1.y);
        const op0 = { x: p0t.x + n0.x * LABEL_GAP, y: p0t.y + n0.y * LABEL_GAP };
        const op1 = { x: p1.x + n1.x * LABEL_GAP, y: p1.y + n1.y * LABEL_GAP };
        const op2 = { x: p2t.x + n2.x * LABEL_GAP, y: p2t.y + n2.y * LABEL_GAP };
        const ltr = op2.x >= op0.x;
        const labelPathD = ltr
          ? `M ${op0.x.toFixed(1)} ${op0.y.toFixed(1)} Q ${op1.x.toFixed(1)} ${op1.y.toFixed(1)} ${op2.x.toFixed(1)} ${op2.y.toFixed(1)}`
          : `M ${op2.x.toFixed(1)} ${op2.y.toFixed(1)} Q ${op1.x.toFixed(1)} ${op1.y.toFixed(1)} ${op0.x.toFixed(1)} ${op0.y.toFixed(1)}`;
        const labelPathId = `conn-label-${connIdx}`;

        const tempId = (conn as ConnectionLine & { tempId?: string }).tempId;
        const isSelected = isEditing && (
          (conn.id !== undefined && selectedConnectionId === conn.id) ||
          (tempId !== undefined && selectedConnectionTempId === tempId)
        );
        return (
          <g key={`conn-${connIdx}`} style={{ pointerEvents: isEditing ? "auto" : "none" }}>
            {conn.label && (
              <defs>
                <path id={labelPathId} d={labelPathD} />
              </defs>
            )}
            {/* Visible line */}
            <path
              d={pathD} fill="none"
              stroke={color} strokeOpacity={isSelected ? 1 : opacity}
              strokeWidth={isSelected ? 2 : 0.8} strokeDasharray={dashes} strokeLinecap="round"
              style={isSelected ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
            />
            {/* Fat invisible hit target — only in edit mode, so view-mode panning isn't disrupted */}
            {isEditing && onPick && (
              <path
                d={pathD} fill="none"
                stroke="transparent" strokeWidth={14}
                style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); onPick(conn); }}
              />
            )}
            {conn.label && (
              <text
                fill={color} fillOpacity={Math.min(opacity + 0.25, 1)}
                fontSize="11" fontFamily="var(--font-cinzel), serif"
                textAnchor="middle"
                style={{ pointerEvents: "none" }}>
                <textPath href={`#${labelPathId}`} startOffset="50%">
                  {conn.label}
                </textPath>
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
