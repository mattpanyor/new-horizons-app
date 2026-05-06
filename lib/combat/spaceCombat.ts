import type {
  CombatEnemyShip,
  CombatFace,
  CombatRangeBand,
  CombatSizeClass,
  SpaceCombatConfig,
  SpaceCombatState,
} from "@/types/game";

export function getDefaultConfig(): SpaceCombatConfig {
  return {
    commanderUsername: "",
    label: undefined,
    opponentEntityId: null,
  };
}

export function getDefaultState(): SpaceCombatState {
  return {
    phase: "gm",
    enemies: [],
    weaponHighlights: {},
    moveCount: 0,
  };
}

const VALID_RANGES: ReadonlySet<CombatRangeBand> = new Set([
  "up-close", "close", "medium", "far", "very-far",
]);
const VALID_FACES: ReadonlySet<CombatFace> = new Set([
  "bow", "stern", "port", "starboard", "dorsal", "ventral",
]);
const VALID_SIZES: ReadonlySet<CombatSizeClass> = new Set([
  "corvette", "frigate", "destroyer", "cruiser", "battlecruiser", "object",
]);

export function validateEnemy(input: unknown): CombatEnemyShip | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return null;
  if (typeof o.label !== "string") return null;
  if (
    o.factionId !== null &&
    typeof o.factionId !== "string"
  ) return null;
  if (typeof o.sizeClass !== "string" || !VALID_SIZES.has(o.sizeClass as CombatSizeClass)) return null;
  if (typeof o.range !== "string" || !VALID_RANGES.has(o.range as CombatRangeBand)) return null;
  if (typeof o.facing !== "string" || !VALID_FACES.has(o.facing as CombatFace)) return null;
  if (typeof o.azimuthDeg !== "number" || !Number.isFinite(o.azimuthDeg)) return null;
  if (typeof o.elevationDeg !== "number" || !Number.isFinite(o.elevationDeg)) return null;
  return {
    id: o.id,
    label: o.label,
    factionId: (o.factionId as string | null) ?? null,
    sizeClass: o.sizeClass as CombatSizeClass,
    range: o.range as CombatRangeBand,
    facing: o.facing as CombatFace,
    azimuthDeg: ((o.azimuthDeg as number) % 360 + 360) % 360,
    elevationDeg: Math.max(-90, Math.min(90, o.elevationDeg as number)),
  };
}

export function validateEnemyList(input: unknown): CombatEnemyShip[] | null {
  if (!Array.isArray(input)) return null;
  const out: CombatEnemyShip[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const valid = validateEnemy(item);
    if (!valid) return null;
    if (seen.has(valid.id)) return null; // duplicate id
    seen.add(valid.id);
    out.push(valid);
  }
  return out;
}
