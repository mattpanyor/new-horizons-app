import type { CombatFace, CombatRangeBand } from "@/types/game";
import { FACE_BY_ID } from "./faces";
import { RANGE_BY_ID } from "./ranges";
import { getWeaponById } from "./playerShip";

export interface ActiveWeapon {
  weaponId: string;
  phase: "aiming" | "locked";
}

export function composeStatusLines(
  face: CombatFace | null,
  range: CombatRangeBand | null,
  weapon: ActiveWeapon | null,
): string[] {
  const lines: string[] = [];
  const faceLabel = face ? FACE_BY_ID[face].label : null;
  const rangeLabel = range ? RANGE_BY_ID[range].label : null;

  if (faceLabel && rangeLabel) {
    lines.push(`Looking at ${faceLabel} at ${rangeLabel}`);
  } else if (faceLabel) {
    lines.push(`Looking at ${faceLabel}`);
  } else if (rangeLabel) {
    lines.push(`Looking at ${rangeLabel}`);
  }

  if (weapon) {
    const def = getWeaponById(weapon.weaponId);
    if (def) {
      lines.push(weapon.phase === "aiming"
        ? `Aiming ${def.displayName}`
        : `${def.displayName} locked in`);
    }
  }
  return lines;
}
