// Runtime enums for fixed-vocabulary fields wired to SVG render branches.
// Each value below has a matching CHECK constraint in lib/db/schema.sql AND a
// render branch in components/. Adding a new value requires updating all three.
// See map-migration.md §3.4 for the type-to-render bindings catalog.

export const BODY_TYPES = [
  "planet",
  "station",
  "moon",
  "ship",
  "fleet",
  "asteroid-field",
  "black-hole",
] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const MARKER_TYPES = [
  "ship",
  "fleet",
  "anomaly",
  "poi",
  "black-hole",
] as const;
export type MarkerType = (typeof MARKER_TYPES)[number];

export const LAYERS = ["movement", "story", "conflict", "invasion"] as const;
export type Layer = (typeof LAYERS)[number];

export const CENTER_KINDS = [
  "single",
  "binary",
  "pulsar",
  "neutron",
  "black-hole",
] as const;
export type CenterKind = (typeof CENTER_KINDS)[number];

export const LABEL_POSITIONS = ["top", "bottom"] as const;
export type LabelPosition = (typeof LABEL_POSITIONS)[number];

export const STAR_ROLES = ["primary", "secondary"] as const;
export type StarRole = (typeof STAR_ROLES)[number];

export const SPECIAL_ATTRIBUTE_KEYS = [
  "lathanium",
  "nobility",
  "purified",
  "lightbringer",
  "cult",
  "alien_int",
] as const;
export type SpecialAttribute = (typeof SPECIAL_ATTRIBUTE_KEYS)[number];

// Default colors per center_kind — used by the editor to pre-fill the color
// picker on system creation or kind change. Matches today's render palette.
export const CENTER_KIND_DEFAULT_COLOR: Record<CenterKind, string> = {
  single: "#FFE87A",
  binary: "#FFE87A",
  pulsar: "#7DD3FC",
  neutron: "#B0C4FF",
  "black-hole": "#A78BFA",
};

export const CENTER_KIND_DEFAULT_SECONDARY: Record<CenterKind, string | null> = {
  single: "#7C5F00",
  binary: "#7C5F00",
  pulsar: null,
  neutron: null,
  "black-hole": "#2E1065",
};
