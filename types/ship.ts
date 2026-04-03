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
  name: string;
  quantity: number;
}

export interface ShipData {
  name: string;
  class: string;
  description: string;
  layers: ShipLayer[];
  abilities?: ShipAbility[];
  cargo?: ShipItem[];
  isolation?: ShipItem[];
}
