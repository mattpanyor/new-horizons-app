import type { CombatSizeClass } from "@/types/game";

export interface SizeClassDef {
  id: CombatSizeClass;
  scale: number;
  displayName: string;
}

// Visual scale only — same shape across enemy classes (built from primitives in
// components/combat/ships/*). Object class is the catch-all for non-ships
// (debris, shuttles, mines, beacons, etc.) — single small size, one shape,
// label-differentiated.
export const SIZE_CLASSES: readonly SizeClassDef[] = [
  { id: "corvette",      scale: 0.7, displayName: "Corvette" },
  { id: "frigate",       scale: 1.0, displayName: "Frigate" },
  { id: "destroyer",     scale: 1.4, displayName: "Destroyer" },
  { id: "cruiser",       scale: 1.9, displayName: "Cruiser" },
  { id: "battlecruiser", scale: 2.6, displayName: "Battlecruiser" },
  { id: "object",        scale: 0.4, displayName: "Object" },
] as const;

export const SIZE_CLASS_BY_ID: Record<CombatSizeClass, SizeClassDef> =
  SIZE_CLASSES.reduce(
    (acc, s) => ({ ...acc, [s.id]: s }),
    {} as Record<CombatSizeClass, SizeClassDef>,
  );
