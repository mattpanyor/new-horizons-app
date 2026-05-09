import type { CombatFace } from "@/types/game";

export interface FaceDef {
  id: CombatFace;
  axis: readonly [number, number, number]; // unit vector in player frame, three.js Y-up
  label: string;                            // for status text composition
}

// Player frame uses Three.js Y-up: bow = +X (north on the screen-space top-down view).
//   bow      = +X
//   stern    = -X
//   port     = -Z   (left side when looking from above)
//   starboard= +Z   (right side)
//   dorsal   = +Y   (top)
//   ventral  = -Y   (bottom)
export const FACES: readonly FaceDef[] = [
  { id: "bow",       axis: [ 1,  0,  0], label: "bow" },
  { id: "stern",     axis: [-1,  0,  0], label: "stern" },
  { id: "port",      axis: [ 0,  0, -1], label: "portside" },
  { id: "starboard", axis: [ 0,  0,  1], label: "starboard" },
  { id: "dorsal",    axis: [ 0,  1,  0], label: "dorsal" },
  { id: "ventral",   axis: [ 0, -1,  0], label: "ventral" },
] as const;

export const FACE_BY_ID: Record<CombatFace, FaceDef> = FACES.reduce(
  (acc, f) => ({ ...acc, [f.id]: f }),
  {} as Record<CombatFace, FaceDef>,
);
