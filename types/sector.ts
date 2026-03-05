export interface SystemPin {
  slug: string;
  x: number;  // canvas coordinate 0–1200
  y: number;  // canvas coordinate 0–800
  allegiance?: string;       // key into ALLEGIANCES registry
  territoryRadius?: number;  // overrides TERRITORY_RADIUS default (120)
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

export interface ConnectionMarker {
  type: "ship" | "fleet";
  position: number;  // 0–1 along the visible (trimmed) line
  // Inline card data
  name: string;
  allegiance?: string; // key into ALLEGIANCES registry
  kankaUrl?: string;
}

export interface ConnectionLine {
  from: string;       // slug of a system or vortex
  to: string;         // slug of a system or vortex
  curvature?: number; // perpendicular offset of the bezier control point (default 0, positive = left of from→to)
  label?: string;     // optional label at the midpoint, follows the curve
  color?: string;     // defaults to sector color
  dashes?: string;    // stroke-dasharray (default "4 6")
  opacity?: number;   // line + label opacity (default 0.35)
  marker?: ConnectionMarker;
}

export interface SectorMetadata {
  slug: string;
  name: string;
  description: string;
  color: string;         // primary accent hex color
  nebulaColor?: string;  // dark background tint color
  systems: SystemPin[];
  vortexes?: VortexPin[];
  connections?: ConnectionLine[];
  published?: boolean;
}
