export interface Allegiance {
  name: string;
  color: string;
  logo: string; // Vercel Blob URL
}

export const ALLEGIANCES = {
  ashford: {
    name: "House Ashford",
    color: "#4A7FBF",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/ashford_logo.png",
  },
  fairfield: {
    name: "House Fairfield",
    color: "#F59E0B",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/fairfield_logo.png",
  },
  feyrose: {
    name: "House Feyrose",
    color: "#EC4899",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/feyrose_logo.png",
  },
  imperial: {
    name: "Imperatorium",
    color: "#FFE87A",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/imperatorium_logo.png",
  },
  lenard: {
    name: "House Lenard",
    color: "#4169E1",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/lenard_logo.png",
  },
  liix: {
    name: "Lenard Institute of Interspecies and Xenosciences",
    color: "#F59E0B",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/liix_logo.png",
  },
  cultists: {
    name: "Crimson Dusk",
    color: "#B91C1C",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/crimson_dusk_logo.png",
  },
  exploratorium: {
    name: "Exploratorium",
    color: "#1E3A5F",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/exploratorium_logo.png",
  },
  inquisitorium: {
    name: "Inquisitorium",
    color: "#FFD700",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/inquisitorium_logo.png",
  },
  cathedral: {
    name: "Cathedral of Solis Invictus",
    color: "#E8DCC0",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/cathedral_logo.png",
  },
  society: {
    name: "Grand Society of Imperial Grandeur and Excellence",
    color: "#C7CDD6",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/society_logo.png",
  },
  sanctum_arcanum: {
    name: "Sanctum Arcanum",
    color: "#7C3AED",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/sanctum_arcanum_logo.png",
  },
  alien_feral: {
    name: "Unkown Alien - feral",
    color: "#c600bc",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/karnix_logo.png"
  },
  alien_int: {
    name: "Hessian",
    color: "#2c59fa",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/hessian_logo.png"
  },
  alien_ai: {
    name: "Unkown Alien - intelligent",
    color: "#8B5CF6",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/alien_ai_logo.png"
  }
} as const satisfies Record<string, Allegiance>;

export type AllegianceKey = keyof typeof ALLEGIANCES;
