export interface ShipBay {
  id: string;
  name: string;
  description: string;
  image: string;
}

export interface ShipLayer {
  id: string;
  name: string;
  zIndex: number;
  color: string;
  bays: ShipBay[];
}

export interface ShipAbility {
  name: string;
  description: string;
}

export type CargoItemType = "general" | "ordnance" | "precious" | "contraband" | "mission";
export type IsolationItemType = "biogenic-seed" | "live-specimen" | "cadaver" | "excised-tissue" | "phytosample";
export type ShipItemType = CargoItemType | IsolationItemType;

export const CARGO_TYPES: { slug: CargoItemType; label: string }[] = [
  { slug: "general", label: "General" },
  { slug: "ordnance", label: "Ordnance" },
  { slug: "precious", label: "Precious" },
  { slug: "contraband", label: "Contraband" },
  { slug: "mission", label: "Mission" },
];

export const ISOLATION_TYPES: { slug: IsolationItemType; label: string }[] = [
  { slug: "biogenic-seed", label: "Biogenic Seed" },
  { slug: "live-specimen", label: "Live Specimen" },
  { slug: "cadaver", label: "Cadaver" },
  { slug: "excised-tissue", label: "Excised Tissue" },
  { slug: "phytosample", label: "Phytosample" },
];

export interface ShipItem {
  id: number;
  category: "cargo" | "isolation";
  itemType: ShipItemType;
  name: string;
  quantity: number;
  imageUrl: string | null;
  description: string | null;
}

export interface ShipData {
  name: string;
  class: string;
  description: string;
  layers: ShipLayer[];
  abilities?: ShipAbility[];
}
