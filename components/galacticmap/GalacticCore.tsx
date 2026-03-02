// Core circle on the galactic map — glow, body, label.

import React from "react";
import type { SectorMetadata } from "@/types/sector";

interface GalacticCoreProps {
  sector: SectorMetadata;
  cx: number;
  cy: number;
  innerR: number;
  isHovered: boolean;
  onHover: (slug: string | null) => void;
  onClick: () => void;
}

export const GalacticCore = React.memo(function GalacticCore({
  sector, cx, cy, innerR, isHovered, onHover, onClick,
}: GalacticCoreProps) {
  return (
    <g
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover(sector.slug)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      <circle
        cx={cx} cy={cy} r={innerR}
        fill={isHovered ? `${sector.color}50` : `${sector.color}28`}
        style={isHovered ? { filter: `drop-shadow(0 0 14px ${sector.color}90)` } : undefined}
      />
      <circle
        cx={cx} cy={cy} r={innerR * 0.55}
        fill={sector.color}
        style={{ filter: `drop-shadow(0 0 10px ${sector.color})` }}
      />
      <text
        x={cx} y={cy + innerR + 14}
        textAnchor="middle"
        fill={isHovered ? "white" : `${sector.color}cc`}
        fontSize="11"
        fontFamily="var(--font-cinzel), serif"
        fontWeight="600"
        style={{ pointerEvents: "none" }}
      >
        {sector.name}
      </text>
    </g>
  );
});
