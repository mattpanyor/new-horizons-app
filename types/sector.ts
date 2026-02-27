export interface SystemPin {
  slug: string;
  x: number;  // canvas coordinate 0–1200
  y: number;  // canvas coordinate 0–800
}

export interface VortexPin {
  slug: string;
  name: string;
  x: number;
  y: number;
  color?: string;           // defaults to sector color
  radius?: number;          // base radius in canvas units, default 80
  ratio?: [number, number]; // [width, height] aspect ratio, e.g. [6, 3]
}

export interface SectorMetadata {
  slug: string;
  name: string;
  description: string;
  color: string;         // primary accent hex color
  nebulaColor?: string;  // dark background tint color
  systems: SystemPin[];
  vortexes?: VortexPin[];
  published?: boolean;
}
