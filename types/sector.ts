import type { AllegianceKey } from "@/lib/allegiances";

export interface SystemPin {
  slug: string;
  x: number;  // canvas coordinate 0–1200
  y: number;  // canvas coordinate 0–800
  allegiance?: AllegianceKey;       // key into ALLEGIANCES registry
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
  layer?: LayerSlug;        // only visible when this layer is selected
}

export type MarkerType = "ship" | "fleet" | "anomaly" | "poi";

export const MAP_LAYERS = {
  movement: { slug: "movement", label: "Movement" },
  story: { slug: "story", label: "Story" },
  war: { slug: "conflict", label: "Conflict" },
  invasion: { slug: "invasion", label: "Invasion" },
} as const;

export type LayerSlug = keyof typeof MAP_LAYERS;

export interface MapMarker {
  type: MarkerType;
  name: string;
  slug?: string;      // unique id, required for use as connection line endpoint
  allegiance?: AllegianceKey;
  kankaUrl?: string;
  // Connection-line placement (used inside ConnectionLine.marker)
  position?: number;  // 0–1 along the visible (trimmed) line
  // Free-floating placement (used inside SectorMetadata.markers)
  x?: number;         // canvas coordinate 0–1200
  y?: number;         // canvas coordinate 0–800
  angle?: number;     // rotation in degrees (default 0)
  // Optional territory blob
  territoryRadius?: number;  // wavy cloud radius around the marker
  layer?: LayerSlug;        // only visible when this layer is selected
}

/** @deprecated Use MapMarker instead */
export type ConnectionMarker = MapMarker;

export interface ConnectionLine {
  from: string;       // slug of a system or vortex
  to: string;         // slug of a system or vortex
  curvature?: number; // perpendicular offset of the bezier control point (default 0, positive = left of from→to)
  label?: string;     // optional label at the midpoint, follows the curve
  color?: string;     // defaults to sector color
  dashes?: string;    // stroke-dasharray (default "4 6")
  opacity?: number;   // line + label opacity (default 0.35)
  marker?: MapMarker;
  layer?: LayerSlug;        // only visible when this layer is selected
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
  markers?: MapMarker[];  // free-floating markers not attached to connection lines
  published?: boolean;
}
