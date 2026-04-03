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
    name: "Imperial",
    color: "#EC4899",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/feyrose_logo.png",
  },
  lenard: {
    name: "House Lenard",
    color: "#4169E1",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/lenard_logo.png",
  },
  liix: {
    name: "Lenard Institute of Interspecies and Xenosciences",
    color: "#F59E0B",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/liix_logo.jpeg",
  },
  cultists: {
    name: "Crimson Dusk",
    color: "#B91C1C",
    logo: "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/cultist_logo.png",
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
  }
} as const satisfies Record<string, Allegiance>;

export type AllegianceKey = keyof typeof ALLEGIANCES;
