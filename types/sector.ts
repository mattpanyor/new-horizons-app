import type { AllegianceKey } from "@/lib/allegiances";

export interface SystemPin {
  id?: number;               // DB id when loaded from DB; absent for JSON-loaded entities
  slug: string;
  /** Display name (system name). Optional so older JSON content that didn't
   *  carry a name on the pin still works — fall back to slug when absent. */
  name?: string;
  x: number;  // canvas coordinate 0–1200
  y: number;  // canvas coordinate 0–800
  allegiance?: AllegianceKey;       // key into ALLEGIANCES registry
  territoryRadius?: number;  // overrides TERRITORY_RADIUS default (120)
  hidden?: boolean;          // if true, omitted by the loader
}

export interface VortexPin {
  id?: number;
  slug: string;
  name: string;
  x: number;
  y: number;
  color?: string;           // defaults to sector color
  radius?: number;          // base radius in canvas units, default 80
  ratio?: [number, number]; // [width, height] aspect ratio, e.g. [6, 3]
  layer?: LayerSlug;        // only visible when this layer is selected
  hidden?: boolean;         // if true, omitted by the loader
}

export type MarkerType = "ship" | "fleet" | "anomaly" | "poi" | "black-hole";

// Keys MUST match the .slug values 1:1 so `LayerSlug = keyof typeof MAP_LAYERS`
// matches the DB enum (lib/db/schema.sql + lib/mapEnums.ts). The earlier
// `war` key was an aliasing trap — typed values stored `"conflict"` in the
// DB but the keyof-derived union claimed `"war"`, causing silent
// type-vs-runtime divergence that hid the Conflict layer in the selector.
export const MAP_LAYERS = {
  movement: { slug: "movement", label: "Movement" },
  story: { slug: "story", label: "Story" },
  conflict: { slug: "conflict", label: "Conflict" },
  invasion: { slug: "invasion", label: "Invasion" },
} as const;

export type LayerSlug = keyof typeof MAP_LAYERS;

export interface MapMarker {
  id?: number;
  /** DB connection_id when this marker is attached to a connection. Undefined for free-floating markers. */
  connectionId?: number;
  type: MarkerType;
  name: string;
  slug?: string;      // unique id, required for use as connection line endpoint
  allegiance?: AllegianceKey;
  externalUrl?: string;
  // Connection-line placement (used inside ConnectionLine.marker)
  position?: number;  // 0–1 along the visible (trimmed) line
  // Free-floating placement (used inside SectorMetadata.markers)
  x?: number;         // canvas coordinate 0–1200
  y?: number;         // canvas coordinate 0–800
  angle?: number;     // rotation in degrees (default 0)
  // Optional territory blob
  territoryRadius?: number;  // wavy cloud radius around the marker
  layer?: LayerSlug;        // only visible when this layer is selected
  hidden?: boolean;         // if true, omitted by the loader (route lines stay)
}

/** @deprecated Use MapMarker instead */
export type ConnectionMarker = MapMarker;

export interface ConnectionLine {
  id?: number;
  from: string;       // slug of a system or vortex
  to: string;         // slug of a system or vortex
  curvature?: number; // perpendicular offset of the bezier control point (default 0, positive = left of from→to)
  label?: string;     // optional label at the midpoint, follows the curve
  color?: string;     // defaults to sector color
  dashes?: string;    // stroke-dasharray (default "4 6")
  opacity?: number;   // line + label opacity (default 0.35)
  marker?: MapMarker;
  layer?: LayerSlug;        // only visible when this layer is selected
  hidden?: boolean;         // if true, omitted by the loader (line + marker)
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
