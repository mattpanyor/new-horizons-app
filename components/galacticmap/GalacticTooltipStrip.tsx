// Bottom hover tooltip bar on the galactic map.

import type { SectorMetadata } from "@/types/sector";

interface GalacticTooltipStripProps {
  sector: SectorMetadata;
  cx: number;
  h: number;
}

export function GalacticTooltipStrip({ sector, cx, h }: GalacticTooltipStripProps) {
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={cx - 130} y={h - 44} width={260} height={32}
        rx="4"
        fill="rgba(15,23,42,0.85)"
        stroke={`${sector.color}50`}
        strokeWidth="1"
      />
      <text x={cx} y={h - 24}
        textAnchor="middle"
        fill="rgba(255,255,255,0.7)" fontSize="10"
        fontFamily="var(--font-cinzel), serif"
      >
        {sector.systems.length === 0
          ? "No charted systems"
          : `${sector.systems.length} charted system${sector.systems.length > 1 ? "s" : ""}`}
        {" · Click to explore"}
      </text>
    </g>
  );
}
