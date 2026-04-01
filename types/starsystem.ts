export type CelestialBodyType = "planet" | "station" | "moon" | "ship" | "fleet" | "asteroid-field" | "black-hole";

export type PlanetBiome =
  | "desert"
  | "jungle"
  | "molten"
  | "barren"
  | "irradiated"
  | "arctic"
  | "ocean"
  | "gas-giant"
  | "tropical"
  | "savanna"
  | "continental"
  | "alpine"
  | "mining"
  | "toxic"
  | "arid"
  | "ash";

export interface CelestialBody {
  id: string;
  name: string;
  type: CelestialBodyType;
  biome?: PlanetBiome;
  lore?: string;
  orbitPosition: number; // degrees 0-360
  orbitDistance: number; // 0-1 normalized distance from star
  labelPosition?: "top" | "bottom"; // default "bottom"
  special_attribute?: "lathanium" | "nobility" | "purified" | "lightbringer" | "cult" | "alien_int";
  allegiance?: import("@/lib/allegiances").AllegianceKey;
  kankaUrl?: string;
  image?: string;
  published?: boolean;
}

export interface Star {
  name: string;
  type: string;
  color: string;
  secondaryColor?: string;
  kankaUrl?: string;
}

export interface StarSystemMetadata {
  slug: string;
  name: string;
  star: Star;
  secondaryStar?: Star;
  binaryAngle?: number; // degrees 0-360, angle of primary star on shared orbit (secondary is opposite). Default 0 = primary right
  bodies: CelestialBody[];
  published?: boolean;
  kankaUrl?: string;
}
