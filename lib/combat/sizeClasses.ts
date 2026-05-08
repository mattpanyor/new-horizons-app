import type { CombatSizeClass } from "@/types/game";

export interface SizeClassDef {
  id: CombatSizeClass;
  scale: number;
  displayName: string;
  // Per-axis shield radii IN LOCAL SHIP COORDS, in (bow X, dorsal Y, beam Z)
  // order. Stretched to follow each ship's elongated silhouette so the hex
  // shield reads as ship-shaped instead of a perfect sphere. World extent
  // is `shieldRadii[i] * scale` since the ship group applies `scale` to its
  // children.
  shieldRadii: readonly [number, number, number];
}

// Visual scale only — same shape across enemy classes (built from primitives in
// components/combat/ships/*). Object class is the catch-all for non-ships
// (debris, shuttles, mines, beacons, etc.) — single small size, one shape,
// label-differentiated.
export const SIZE_CLASSES: readonly SizeClassDef[] = [
  { id: "corvette",      scale: 0.7, displayName: "Corvette",      shieldRadii: [1.8, 0.8, 0.95] },
  { id: "frigate",       scale: 1.0, displayName: "Frigate",       shieldRadii: [2.2, 1.2, 1.4] },
  { id: "destroyer",     scale: 1.4, displayName: "Destroyer",     shieldRadii: [2.7, 1.5, 1.5] },
  { id: "cruiser",       scale: 1.9, displayName: "Cruiser",       shieldRadii: [2.9, 1.8, 1.9] },
  { id: "battlecruiser", scale: 2.6, displayName: "Battlecruiser", shieldRadii: [4.1, 2.2, 2.1] },
  // Object is roughly spherical — used for debris/beacons/etc.
  { id: "object",        scale: 0.4, displayName: "Object",        shieldRadii: [0.9, 0.9, 0.9] },
] as const;

export const SIZE_CLASS_BY_ID: Record<CombatSizeClass, SizeClassDef> =
  SIZE_CLASSES.reduce(
    (acc, s) => ({ ...acc, [s.id]: s }),
    {} as Record<CombatSizeClass, SizeClassDef>,
  );
