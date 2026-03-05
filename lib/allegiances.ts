export interface Allegiance {
  name: string;
  color: string;
  logo: string; // path relative to /public, e.g. "/factions/ashford_logo.png"
}

export const ALLEGIANCES = {
  ashford: {
    name: "House Ashford",
    color: "#4A7FBF",
    logo: "/factions/ashford_logo.png",
  },
  fairfield: {
    name: "House Fairfield",
    color: "#F59E0B",
    logo: "/factions/fairfield_logo.png",
  },
  feyrose: {
    name: "House Feyrose",
    color: "#EC4899",
    logo: "/factions/feyrose_logo.png",
  },
  /** TODO: placeholder — needs proper color + logo */
  imperial: {
    name: "Imperial",
    color: "#EC4899",
    logo: "/factions/feyrose_logo.png",
  },
  /** TODO: placeholder — needs proper color + logo */
  lenard: {
    name: "House Lenard (L.I.I.X)",
    color: "#000000",
    logo: "/factions/feyrose_logo.png"
  },
  /** TODO: placeholder — needs proper color + logo */
  cultists: {
    name: "Cultists",
    color: "#000000",
    logo: "/factions/feyrose_logo.png"
  }
} as const satisfies Record<string, Allegiance>;

export type AllegianceKey = keyof typeof ALLEGIANCES;
