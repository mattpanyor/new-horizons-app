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
  imperial: {
    name: "Imperial",
    color: "#EC4899",
    logo: "/factions/feyrose_logo.png",
  },
  lenard: {
    name: "House Lenard",
    color: "#4169E1",
    logo: "/factions/lenard_logo.png",
  },
  liix: {
    name: "Lenard Institute of Interspecies and Xenosciences",
    color: "#F59E0B",
    logo: "/factions/liix_logo.jpeg",
  },
  cultists: {
    name: "Crimson Dusk",
    color: "#B91C1C",
    logo: "/factions/cultist_logo.png",
  },
  exploratorium: {
    name: "Exploratorium",
    color: "#1E3A5F",
    logo: "/factions/exploratorium_logo.png",
  },
  inquisitorium: {
    name: "Inquisitorium",
    color: "#FFD700",
    logo: "/factions/inquisitorium_logo.png",
  }
} as const satisfies Record<string, Allegiance>;

export type AllegianceKey = keyof typeof ALLEGIANCES;
