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
  // The in-system stable slug (e.g. "leo-1"). Note this is NOT the DB primary
  // key — that's `dbId`. Pre-DB JSON content used `id` for the slug and the
  // type kept the name for back-compat with renderers.
  id: string;
  // DB primary key. Set by the DB loader; absent for JSON-loaded bodies.
  dbId?: number;
  name: string;
  type: CelestialBodyType;
  biome?: PlanetBiome;
  lore?: string;
  orbitPosition: number; // degrees 0-360
  orbitDistance: number; // 0-1 normalized distance from star
  labelPosition?: "top" | "bottom"; // default "bottom"
  special_attribute?: "lathanium" | "nobility" | "purified" | "lightbringer" | "cult" | "alien_int";
  allegiance?: import("@/lib/allegiances").AllegianceKey;
  externalUrl?: string;
  image?: string;
  published?: boolean;
  hidden?: boolean;      // if true, omitted by the loader
}

export interface Star {
  name: string;
  type: string;
  color: string;
  secondaryColor?: string;
  externalUrl?: string;
}

export interface StarSystemMetadata {
  slug: string;
  name: string;
  // Renderer key for the system's central object. Loaded straight from
  // systems.center_kind in DB; for JSON-loaded Imperial Core systems it's
  // derived from star.type substrings at load time. See lib/centerKind.ts.
  centerKind?: "single" | "binary" | "pulsar" | "neutron" | "black-hole";
  star: Star;
  secondaryStar?: Star;
  binaryAngle?: number; // degrees 0-360, angle of primary star on shared orbit (secondary is opposite). Default 0 = primary right
  bodies: CelestialBody[];
  published?: boolean;
  externalUrl?: string;
}
