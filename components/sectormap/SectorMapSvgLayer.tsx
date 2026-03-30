// Server Component — static SVG defs, territory arcs, allegiance blobs,
// connection line paths, and vortex shapes.
// No "use client" directive. Rendered inside the client <svg> via the staticSvgLayers prop.

import type { SectorMetadata, VortexPin } from "@/types/sector";
import type { StarSystemMetadata } from "@/types/starsystem";
import { getBodyColors, FLEET_GRAD_TIP, FLEET_GRAD_BASE } from "@/lib/bodyColors";
import { SYS_MAX_R, wavyCloudPath } from "@/lib/sectorMapHelpers";
import { SectorArcLayer } from "./SectorArcLayer";
import { TerritoryLayer } from "./TerritoryLayer";
import { ConnectionLinesLayer } from "./ConnectionLinesLayer";

interface SectorMapSvgLayerProps {
  sector: SectorMetadata;
  systemsData: Record<string, StarSystemMetadata>;
}

export function SectorMapSvgLayer({ sector, systemsData }: SectorMapSvgLayerProps) {
  // Compute orbit data server-side for connection endpoint trimming
  const orbitDataMap = new Map<string, { maxOrbit: number }>();
  for (const pin of sector.systems) {
    const sys = systemsData[pin.slug];
    const maxOrbit = sys
      ? Math.max(...sys.bodies.map(b => b.orbitDistance), 0.3) * SYS_MAX_R
      : 40;
    orbitDataMap.set(pin.slug, { maxOrbit });
  }

  const vortexes = sector.vortexes ?? [];

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
          return [
            <radialGradient key={`starGlow-${pin.slug}`} id={`starGlow-${pin.slug}`}>
              <stop offset="0%" stopColor={sys.star.color} stopOpacity="1" />
              <stop offset="30%" stopColor={sys.star.color} stopOpacity="0.8" />
              <stop offset="60%" stopColor={sys.star.secondaryColor ?? sys.star.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={sys.star.secondaryColor ?? sys.star.color} stopOpacity="0" />
            </radialGradient>,
            <radialGradient key={`starCorona-${pin.slug}`} id={`starCorona-${pin.slug}`}>
              <stop offset="0%" stopColor={sys.star.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={sys.star.color} stopOpacity="0" />
            </radialGradient>,
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

      {/* ── Connection line paths + labels ── */}
      <ConnectionLinesLayer
        connections={sector.connections ?? []}
        systems={sector.systems}
        vortexes={vortexes}
        markers={sector.markers ?? []}
        sectorColor={sector.color}
        orbitDataMap={orbitDataMap}
      />

      {/* ── Vortex shapes ── */}
      {vortexes.map((v: VortexPin) => {
        const color = v.color ?? sector.color;
        const r = v.radius ?? 80;
        const [rw, rh] = v.ratio ?? [1, 1];
        const ry = r * (rh / Math.max(rw, rh));
        return (
          <g key={v.slug} style={{ pointerEvents: "none" }}>
            <path d={wavyCloudPath(v.x, v.y, r, { ratio: v.ratio })}
              fill={color} fillOpacity={0.12}
              stroke={color} strokeOpacity={0.35} strokeWidth={1.5} />
            <text x={v.x} y={v.y + ry + 18} textAnchor="middle"
              fill={color} fillOpacity={0.75} fontSize="11"
              fontFamily="var(--font-cinzel), serif">
              {v.name}
            </text>
          </g>
        );
      })}
    </>
  );
}
