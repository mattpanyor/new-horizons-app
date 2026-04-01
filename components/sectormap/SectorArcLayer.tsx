import { memo } from "react";
import { toRad, annularSectorPath, arcStrokePath } from "@/lib/svgGeometry";
import {
  SECTOR_TERRITORY, TERRITORY_INNER_R, TERRITORY_OUTER_R,
  LABEL_PAD, LABEL_PAD_REVERSED,
} from "@/lib/sectorMapHelpers";

interface SectorArcLayerProps {
  sectorSlug: string;
  sectorName: string;
  sectorColor: string;
}

export const SectorArcLayer = memo(function SectorArcLayer({ sectorSlug, sectorName, sectorColor }: SectorArcLayerProps) {
  const t = SECTOR_TERRITORY[sectorSlug];
  if (!t) return null;

  const { cx, cy, arcStart, arcEnd } = t;
  const isFullCircle = arcEnd - arcStart >= 360;
  const labelPathId = `sector-label-${sectorSlug}`;

  if (isFullCircle) {
    const labelR = TERRITORY_OUTER_R + LABEL_PAD;
    return (
      <g style={{ pointerEvents: "none" }}>
        <defs>
          <path id={labelPathId} d={`M ${cx - labelR} ${cy} A ${labelR} ${labelR} 0 1 1 ${cx + labelR} ${cy} A ${labelR} ${labelR} 0 1 1 ${cx - labelR} ${cy}`} />
        </defs>
        <circle cx={cx} cy={cy} r={TERRITORY_OUTER_R}
          fill={sectorColor} fillOpacity={0.03} />
        <circle cx={cx} cy={cy} r={TERRITORY_OUTER_R}
          fill="none" stroke={sectorColor} strokeOpacity={0.25} strokeWidth={1.5} />
        <text
          fontFamily="var(--font-cinzel), serif" fontSize="32" fontWeight="600"
          fill={sectorColor} fillOpacity={0.3} letterSpacing="14">
          <textPath href={`#${labelPathId}`} startOffset="50%" textAnchor="middle">
            {sectorName.toUpperCase()}
          </textPath>
        </text>
      </g>
    );
  }

  const needsReverse = sectorSlug === "denerum-sector" || sectorSlug === "castell-sector";
  const labelR = TERRITORY_OUTER_R + (needsReverse ? LABEL_PAD_REVERSED : LABEL_PAD);
  const ls = toRad(arcStart), le = toRad(arcEnd);
  const lxs = cx + labelR * Math.cos(ls), lys = cy + labelR * Math.sin(ls);
  const lxe = cx + labelR * Math.cos(le), lye = cy + labelR * Math.sin(le);
  const labelPathD = needsReverse
    ? `M ${lxe} ${lye} A ${labelR} ${labelR} 0 0 0 ${lxs} ${lys}`
    : `M ${lxs} ${lys} A ${labelR} ${labelR} 0 0 1 ${lxe} ${lye}`;

  return (
    <g style={{ pointerEvents: "none" }}>
      <defs>
        <path id={labelPathId} d={labelPathD} />
      </defs>
      <path d={annularSectorPath(cx, cy, TERRITORY_INNER_R, TERRITORY_OUTER_R, arcStart, arcEnd)}
        fill={sectorColor} fillOpacity={0.03} />
      <path d={arcStrokePath(cx, cy, TERRITORY_OUTER_R, arcStart, arcEnd)}
        fill="none" stroke={sectorColor} strokeOpacity={0.25} strokeWidth={1.5} />
      <path d={arcStrokePath(cx, cy, TERRITORY_INNER_R, arcStart, arcEnd)}
        fill="none" stroke={sectorColor} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="4 8" />
      {[arcStart, arcEnd].map((deg) => {
        const r = toRad(deg);
        return (
          <line key={deg}
            x1={cx + TERRITORY_INNER_R * Math.cos(r)} y1={cy + TERRITORY_INNER_R * Math.sin(r)}
            x2={cx + TERRITORY_OUTER_R * Math.cos(r)} y2={cy + TERRITORY_OUTER_R * Math.sin(r)}
            stroke={sectorColor} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="6 10" />
        );
      })}
      <text
        fontFamily="var(--font-cinzel), serif" fontSize="32" fontWeight="600"
        fill={sectorColor} fillOpacity={0.3} letterSpacing="14">
        <textPath href={`#${labelPathId}`} startOffset="50%" textAnchor="middle">
          {sectorName.toUpperCase()}
        </textPath>
      </text>
    </g>
  );
});
