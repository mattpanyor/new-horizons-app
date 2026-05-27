// Centralized center-kind derivation. The DB stores systems.center_kind as
// an enum; JSON-loaded Imperial Core systems keep their pre-migration shape
// with `star.type` as a free-text descriptor, so we substring-match it to
// pick a kind. See map-migration.md §3.4.4 and the Phase 1 seed mapping in §7.

import type { CenterKind } from "@/lib/mapEnums";

export function deriveCenterKindFromStarType(starType: string | undefined, hasSecondary: boolean): CenterKind {
  if (hasSecondary) return "binary";
  const t = (starType ?? "").toLowerCase();
  if (t.includes("pulsar")) return "pulsar";
  if (t.includes("neutron")) return "neutron";
  if (t.includes("black hole") || t.includes("blackhole")) return "black-hole";
  return "single";
}
