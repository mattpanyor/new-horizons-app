// Server Component — static grid lines and background stars for SectorMap.
// No "use client" directive.

import { FULL_W, FULL_H, BG_STARS } from "@/lib/sectorMapHelpers";

export function SectorMapGrid() {
  return (
    <svg
      viewBox={`0 0 ${FULL_W} ${FULL_H}`}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ userSelect: "none" }}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <line key={`gx-${i}`}
          x1={i * (FULL_W / 10)} y1={0} x2={i * (FULL_W / 10)} y2={FULL_H}
          stroke="rgba(99,102,241,0.045)" strokeWidth="1" />
      ))}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <line key={`gy-${i}`}
          x1={0} y1={i * (FULL_H / 10)} x2={FULL_W} y2={i * (FULL_H / 10)}
          stroke="rgba(99,102,241,0.045)" strokeWidth="1" />
      ))}
      {BG_STARS.map((star, i) => (
        <circle key={i} cx={star.x} cy={star.y}
          r={i % 3 === 0 ? 1 : 0.7} fill="white" opacity={0.25 + (i % 5) * 0.07} />
      ))}
    </svg>
  );
}
