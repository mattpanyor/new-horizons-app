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

export interface ShipData {
  name: string;
  class: string;
  description: string;
  layers: ShipLayer[];
}
