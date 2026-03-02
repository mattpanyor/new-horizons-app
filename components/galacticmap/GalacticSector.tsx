// Single outer sector arc on the galactic map (active/inactive states, hover, click).

import React from "react";
import { toRad, annularSectorPath } from "@/lib/svgGeometry";
import type { SectorMetadata } from "@/types/sector";

interface GalacticSectorProps {
  sector: SectorMetadata;
  layout: { arcStart: number; arcEnd: number };
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  labelR: number;
  badgeR: number;
  sectorOffset: number;
  isHovered: boolean;
  onHover: (slug: string | null) => void;
  onClick: () => void;
}

export const GalacticSector = React.memo(function GalacticSector({
  sector, layout, cx, cy, innerR, outerR, labelR, badgeR,
  sectorOffset, isHovered, onHover, onClick,
}: GalacticSectorProps) {
  const midDeg = (layout.arcStart + layout.arcEnd) / 2;
  const midRad = toRad(midDeg);
  const labelX = cx + labelR * Math.cos(midRad);
  const labelY = cy + labelR * Math.sin(midRad);
  const bX = cx + badgeR * Math.cos(midRad);
  const bY = cy + badgeR * Math.sin(midRad);
  const dx = Math.cos(midRad) * sectorOffset;
  const dy = Math.sin(midRad) * sectorOffset;
  const sectorPath = annularSectorPath(cx, cy, innerR, outerR, layout.arcStart, layout.arcEnd);
  const isInactive = sector.published === false;

  if (isInactive) {
    return (
      <g
        transform={`translate(${dx}, ${dy})`}
        style={{ cursor: "not-allowed" }}
      >
        <path d={sectorPath} fill="#2a2a3a" stroke="#3a3a4e" strokeWidth="0.5" />
        <path d={sectorPath} fill="url(#inactiveHatch)" stroke="none" />
        <text
          x={labelX} y={labelY}
          textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.2)"
          fontSize="13"
          fontFamily="var(--font-cinzel), serif"
          fontWeight="400"
          style={{ pointerEvents: "none" }}
        >
          {sector.name}
        </text>
      </g>
    );
  }

  return (
    <g
      transform={`translate(${dx}, ${dy})`}
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover(sector.slug)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      <path
        d={sectorPath}
        fill={isHovered ? `${sector.color}45` : `${sector.color}22`}
        stroke={isHovered ? sector.color : `${sector.color}55`}
        strokeWidth={isHovered ? 1.5 : 0.5}
        style={isHovered ? { filter: `drop-shadow(0 0 10px ${sector.color}60)` } : undefined}
      />

      {isHovered && (
        <path
          d={annularSectorPath(cx, cy, outerR - 6, outerR, layout.arcStart, layout.arcEnd)}
          fill={`${sector.color}30`}
          stroke="none"
        />
      )}

      <text
        x={labelX} y={labelY}
        textAnchor="middle" dominantBaseline="middle"
        fill={isHovered ? "white" : `${sector.color}cc`}
        fontSize="13"
        fontFamily="var(--font-cinzel), serif"
        fontWeight={isHovered ? "600" : "400"}
        style={{ pointerEvents: "none" }}
      >
        {sector.name}
      </text>

      {sector.systems.length > 0 && (
        <>
          <circle
            cx={bX} cy={bY} r={12}
            fill={`${sector.color}30`}
            stroke={`${sector.color}80`}
            strokeWidth="1"
            style={{ pointerEvents: "none" }}
          />
          <text
            x={bX} y={bY}
            textAnchor="middle" dominantBaseline="middle"
            fill={sector.color}
            fontSize="9"
            fontFamily="var(--font-cinzel), serif"
            style={{ pointerEvents: "none" }}
          >
            {sector.systems.length}
          </text>
        </>
      )}
    </g>
  );
});
