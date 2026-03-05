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
  const words = sector.name.split(" ");
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(" ");
  const line2 = words.slice(mid).join(" ");

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
      <text
        textAnchor="middle"
        fill={isHovered ? "white" : `${sector.color}cc`}
        fontSize="22"
        fontFamily="var(--font-cinzel), serif"
        fontWeight="600"
        style={{ pointerEvents: "none" }}
      >
        <tspan x={cx} y={cy - 6}>{line1}</tspan>
        {line2 && <tspan x={cx} dy="26">{line2}</tspan>}
      </text>
    </g>
  );
});
