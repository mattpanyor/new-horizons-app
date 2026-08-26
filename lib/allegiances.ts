/**
 * Which section of the standing board a faction is dealt into.
 *
 * A property of the faction rather than of the page: the same three groupings
 * name what a faction *is*, so anything else that needs to sort factions can
 * read them here instead of keeping its own list.
 */
export type FactionCategory = "external" | "nobility" | "imperial";

/** Section order and headings, hostile-to-Imperium reading left to right. */
export const FACTION_CATEGORIES: { key: FactionCategory; label: string }[] = [
  { key: "external", label: "External" },
  { key: "nobility", label: "Nobility" },
  { key: "imperial", label: "Imperial" },
];

export interface Allegiance {
  name: string;
  color: string;
  logo: string; // Vercel Blob URL
  category: FactionCategory;
}

export const ALLEGIANCES = {
  ashford: {
    name: "House Ashford",
    color: "#4A7FBF",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/ashford_logo.png",
    category: "nobility",
  },
  fairfield: {
    name: "House Fairfield",
    color: "#F59E0B",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/fairfield_logo.png",
    category: "nobility",
  },
  feyrose: {
    name: "House Feyrose",
    color: "#EC4899",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/feyrose_logo.png",
    category: "nobility",
  },
  imperial: {
    name: "Imperatorium",
    color: "#FFE87A",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/imperatorium_logo.png",
    category: "imperial",
  },
  lenard: {
    name: "House Lenard",
    color: "#4169E1",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/lenard_logo.png",
    category: "nobility",
  },
  liix: {
    name: "Lenard Institute of Interspecies and Xenosciences",
    color: "#F59E0B",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/liix_logo.png",
    category: "nobility",
  },
  cultists: {
    name: "Crimson Dusk",
    color: "#B91C1C",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/crimson_dusk_logo.png",
    category: "external",
  },
  exploratorium: {
    name: "Exploratorium",
    color: "#1E3A5F",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/exploratorium_logo.png",
    category: "imperial",
  },
  inquisitorium: {
    name: "Inquisitorium",
    color: "#FFD700",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/inquisitorium_logo.png",
    category: "imperial",
  },
  cathedral: {
    name: "Cathedral of Solis Invictus",
    color: "#E8DCC0",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/cathedral_logo.png",
    category: "imperial",
  },
  society: {
    name: "Grand Society of Imperial Grandeur and Excellence",
    color: "#C7CDD6",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/society_logo.png",
    category: "imperial",
  },
  sanctum_arcanum: {
    name: "Sanctum Arcanum",
    color: "#7C3AED",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/sanctum_arcanum_logo.png",
    category: "imperial",
  },
  alien_feral: {
    name: "Unkown Alien - feral",
    color: "#c600bc",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/karnix_logo.png",
    category: "external",
  },
  alien_int: {
    name: "Hessian",
    color: "#2c59fa",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/hessian_logo.png",
    category: "external",
  },
  alien_ai: {
    name: "Unkown Alien - intelligent",
    color: "#8B5CF6",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/alien_ai_logo.png",
    category: "external",
  },
} as const satisfies Record<string, Allegiance>;

export type AllegianceKey = keyof typeof ALLEGIANCES;
