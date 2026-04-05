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

export interface ShipItem {
  id: number;
  category: "cargo" | "isolation";
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
