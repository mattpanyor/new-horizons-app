// Server Component — static SVG defs and ring lines for GalacticMap.
// No "use client" directive.
//
// Deliberately transparent. This used to paint its own dark disc and star field
// behind the wheel, which made sense against a flat background but now sits on
// top of the planet — a dark circle with a second, non-matching set of stars in
// it. The page background shows through instead.

import type { SectorMetadata } from "@/types/sector";
import {
  CORE_GLOW_ID, CORE_CORONA_ID, INACTIVE_HATCH_ID,
  galacticGradientId,
} from "@/lib/galacticMapIds";

const OUTER_R = 260;
const CX = 300;
const CY = 300;

interface GalacticMapBackgroundProps {
  coreSector: SectorMetadata | undefined;
  outerSectors: SectorMetadata[];
}

export function GalacticMapBackground({ coreSector, outerSectors }: GalacticMapBackgroundProps) {
  return (
    <>
      <defs>
        <pattern id={INACTIVE_HATCH_ID} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45 0 0)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
        </pattern>

        {coreSector && (
          <>
            <radialGradient id={CORE_GLOW_ID} cx="50%" cy="50%">
              <stop offset="0%"   stopColor={coreSector.color} stopOpacity="1"   />
              <stop offset="30%"  stopColor={coreSector.color} stopOpacity="0.8" />
              <stop offset="60%"  stopColor={coreSector.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={coreSector.color} stopOpacity="0"   />
            </radialGradient>
            <radialGradient id={CORE_CORONA_ID} cx="50%" cy="50%">
              <stop offset="0%"   stopColor={coreSector.color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={coreSector.color} stopOpacity="0"    />
            </radialGradient>
          </>
        )}

        {outerSectors.filter((s) => s.published !== false).map((s) => (
          <radialGradient key={galacticGradientId(s.slug)} id={galacticGradientId(s.slug)} cx="50%" cy="50%">
            <stop offset="0%"   stopColor={s.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.05" />
          </radialGradient>
        ))}
      </defs>

      {/* Ring lines */}
      <circle cx={CX} cy={CY} r={OUTER_R + 12}
        fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={OUTER_R + 28}
        fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
    </>
  );
}
