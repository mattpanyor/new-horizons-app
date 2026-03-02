// Server Component — static SVG defs, background, stars, and ring lines for GalacticMap.
// No "use client" directive.

import type { SectorMetadata } from "@/types/sector";
import {
  GALAXY_BG_ID, CORE_GLOW_ID, CORE_CORONA_ID, INACTIVE_HATCH_ID,
  galacticGradientId,
} from "@/lib/galacticMapIds";

const OUTER_R = 260;
const CX = 300;
const CY = 300;

const STARS = [
  { x: 60,  y: 80,  r: 0.8 }, { x: 540, y: 70,  r: 1.0 }, { x: 150, y: 45,  r: 0.6 },
  { x: 480, y: 120, r: 0.9 }, { x: 380, y: 30,  r: 0.7 }, { x: 80,  y: 200, r: 1.1 },
  { x: 30,  y: 310, r: 0.8 }, { x: 55,  y: 430, r: 0.6 }, { x: 100, y: 520, r: 1.0 },
  { x: 200, y: 560, r: 0.7 }, { x: 370, y: 575, r: 0.9 }, { x: 500, y: 555, r: 0.8 },
  { x: 555, y: 450, r: 1.1 }, { x: 575, y: 320, r: 0.6 }, { x: 560, y: 190, r: 0.9 },
  { x: 460, y: 50,  r: 0.7 }, { x: 290, y: 25,  r: 1.0 }, { x: 120, y: 160, r: 0.8 },
  { x: 40,  y: 380, r: 0.7 }, { x: 130, y: 495, r: 0.9 }, { x: 430, y: 530, r: 0.6 },
  { x: 520, y: 400, r: 1.0 }, { x: 490, y: 250, r: 0.8 }, { x: 440, y: 170, r: 0.7 },
  { x: 340, y: 560, r: 1.1 }, { x: 165, y: 540, r: 0.6 }, { x: 65,  y: 145, r: 0.9 },
  { x: 580, y: 145, r: 0.7 }, { x: 20,  y: 250, r: 0.8 }, { x: 585, y: 260, r: 1.0 },
];

interface GalacticMapBackgroundProps {
  coreSector: SectorMetadata | undefined;
  outerSectors: SectorMetadata[];
}

export function GalacticMapBackground({ coreSector, outerSectors }: GalacticMapBackgroundProps) {
  return (
    <>
      <defs>
        <radialGradient id={GALAXY_BG_ID} cx="50%" cy="50%">
          <stop offset="0%"   stopColor="#1a0a2e" />
          <stop offset="35%"  stopColor="#0c0618" />
          <stop offset="100%" stopColor="#020108" />
        </radialGradient>

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

      {/* Background */}
      <circle cx={CX} cy={CY} r={OUTER_R + 50} fill={`url(#${GALAXY_BG_ID})`} opacity={0.75} />

      {/* Star field */}
      {STARS.map((star, i) => (
        <circle
          key={i}
          cx={star.x} cy={star.y} r={star.r}
          fill="white" opacity={0.35 + (i % 5) * 0.1}
        />
      ))}

      {/* Ring lines */}
      <circle cx={CX} cy={CY} r={OUTER_R + 12}
        fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={OUTER_R + 28}
        fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
    </>
  );
}
