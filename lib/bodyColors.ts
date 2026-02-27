export interface BodyColors {
  color: string;
  secondaryColor: string;
}

// All stations share one color palette
export const STATION_COLORS: BodyColors = {
  color: "#22D3EE",
  secondaryColor: "#0E7490",
};

export const MOON_COLORS: BodyColors = {
  color: "#94A3B8",
  secondaryColor: "#475569",
};


// Add new biomes here — key must match the biome value in JSON
export const BIOME_COLORS: Record<string, BodyColors> = {
  desert: { color: "#D97706", secondaryColor: "#92400E" },
  jungle: { color: "#22C55E", secondaryColor: "#14532D" },
  molten: { color: "#DC2626", secondaryColor: "#450A0A" },
  barren: { color: "#78716C", secondaryColor: "#292524" },
  irradiated: { color: "#A3E635", secondaryColor: "#365314" },
  arctic: { color: "#BAE6FD", secondaryColor: "#0369A1" },
  tropical: { color: "#2DD4BF", secondaryColor: "#0F766E" },
  savanna: { color: "#FCD34D", secondaryColor: "#78350F" },
  continental: { color: "#60A5FA", secondaryColor: "#1D4ED8" },
  alpine: { color: "#A8D8B0", secondaryColor: "#4A8C5C" },
  mining: { color: "#57534E", secondaryColor: "#292524" },
  toxic: { color: "#84CC16", secondaryColor: "#3F6212" },
  arid:  { color: "#CA8A04", secondaryColor: "#713F12" },
  ash:   { color: "#9CA3AF", secondaryColor: "#374151" },
  ocean: { color: "#0EA5E9", secondaryColor: "#0C4A6E" },
  "gas-giant": { color: "#FB923C", secondaryColor: "#C2410C" },
};

const DEFAULT_PLANET_COLORS: BodyColors = {
  color: "#94A3B8",
  secondaryColor: "#475569",
};

export const SHIP_COLORS: BodyColors = {
  color: "#7DD3FC",
  secondaryColor: "#0369A1",
};

export const ASTEROID_FIELD_COLORS: BodyColors = {
  color: "#A8A29E",
  secondaryColor: "#57534E",
};

export function getBodyColors(body: { type: string; biome?: string }): BodyColors {
  switch (body.type) {
    case "station": return STATION_COLORS;
    case "moon": return MOON_COLORS;

    case "ship": return SHIP_COLORS;
    case "fleet": return SHIP_COLORS;
    case "asteroid-field": return ASTEROID_FIELD_COLORS;
    default:
      return body.biome ? (BIOME_COLORS[body.biome] ?? DEFAULT_PLANET_COLORS) : DEFAULT_PLANET_COLORS;
  }
}
