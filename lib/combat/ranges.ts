import type { CombatRangeBand } from "@/types/game";

export interface RangeDef {
  id: CombatRangeBand;
  radius: number;          // world-space units from origin
  label: string;           // for status text composition
}

export const RANGES: readonly RangeDef[] = [
  { id: "up-close", radius: 6,  label: "up-close range" },
  { id: "close",    radius: 12, label: "close range" },
  { id: "medium",   radius: 24, label: "medium range" },
  { id: "far",      radius: 48, label: "far range" },
  { id: "very-far", radius: 96, label: "very far range" },
] as const;

export const RANGE_BY_ID: Record<CombatRangeBand, RangeDef> = RANGES.reduce(
  (acc, r) => ({ ...acc, [r.id]: r }),
  {} as Record<CombatRangeBand, RangeDef>,
);

// Dot-count multiplier per range, anchored at "close" (= 1.0). Each step
// outward multiplies by 2 so the apparent density on the larger spheres
// stays comparable to "close"; each step inward divides by 2.
const CLOSE_INDEX = 1;
export const RANGE_DOT_COUNT_MULTIPLIER: Record<CombatRangeBand, number> = RANGES.reduce(
  (acc, r, i) => ({ ...acc, [r.id]: Math.pow(2, i - CLOSE_INDEX) }),
  {} as Record<CombatRangeBand, number>,
);

// Camera zoom limits.
export const CAMERA_MIN_DISTANCE = 2;
// Generous buffer past the outermost shell so the user can pull back and see
// the whole field with margin around very-far.
export const CAMERA_MAX_DISTANCE = RANGES[RANGES.length - 1].radius * 1.8;
// Start at a tight framing that shows the player ship clearly while still
// exposing the inner shells. Decoupled from the far-shell radius (which now
// doubles outward), so the initial view stays comfortable regardless of how
// the band radii are tuned.
export const CAMERA_INITIAL_DISTANCE = 25;
