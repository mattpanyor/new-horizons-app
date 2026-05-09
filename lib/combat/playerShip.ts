import type { CombatRangeBand } from "@/types/game";

export type WeaponShape = "cone" | "cylinder" | "wide-cone";

export interface WeaponDef {
  id: string;
  displayName: string;
  shape: WeaponShape;
  // For cone / wide-cone: half-angle of the cone in degrees.
  coneHalfAngleDeg?: number;
  // For cylinder: radius around the axis.
  cylinderRadius?: number;
  // The farthest range band the volume reaches. Length of the volume = RANGES[maxRange].radius.
  maxRange: CombatRangeBand;
  // 0..1 effectiveness per band, drives the gradient stops along the volume.
  effectiveness: Record<CombatRangeBand, number>;
}

export interface PlayerShipDef {
  color: string;          // base hull color
  accentColor: string;    // cone tips, panel details
  engineColor: string;    // emissive engine glow
  weapons: readonly WeaponDef[];
}

export const PLAYER_SHIP: PlayerShipDef = {
  color: "#5a8fb0",
  accentColor: "#1a2030",
  engineColor: "#4488ff",
  weapons: [
    {
      id: "pulsar-swarm",
      displayName: "Pulsar Swarm",
      shape: "cone",
      coneHalfAngleDeg: 25,
      maxRange: "far",
      effectiveness: {
        "up-close": 1.0,
        "close":    0.85,
        "medium":   0.6,
        "far":      0.3,
        "very-far": 0,
      },
    },
    {
      id: "graviton-lance",
      displayName: "Graviton Lance",
      shape: "cylinder",
      cylinderRadius: 0.5,
      maxRange: "far",
      effectiveness: {
        "up-close": 1.0,
        "close":    1.0,
        "medium":   1.0,
        "far":      1.0,
        "very-far": 0,
      },
    },
    {
      id: "torpedoes",
      displayName: "Torpedoes",
      shape: "wide-cone",
      coneHalfAngleDeg: 55,
      maxRange: "very-far",
      effectiveness: {
        "up-close": 0.2,
        "close":    0.85,
        "medium":   1.0,
        "far":      0.9,
        "very-far": 0.5,
      },
    },
  ],
};

export function getWeaponById(id: string): WeaponDef | undefined {
  return PLAYER_SHIP.weapons.find((w) => w.id === id);
}
