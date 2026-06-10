// Hybrid star system loader: same slug-routing rule as lib/sectors.ts.
//   - sectorSlug "imperial-core" → read from JSON (the bespoke cluster)
// Everything else queries the DB. See map-migration.md §4.

import fs from "fs";
import path from "path";
import type {
  StarSystemMetadata,
  CelestialBody,
  CelestialBodyType,
  PlanetBiome,
  Star,
} from "@/types/starsystem";
import type { AllegianceKey } from "@/lib/allegiances";
import { migrateKankaToExternal } from "@/lib/jsonMigrate";
import { deriveCenterKindFromStarType } from "@/lib/centerKind";
import { getSectorRowBySlug } from "@/lib/db/sectors";
import { getSystemBySlug } from "@/lib/db/systems";
import { getStarsBySystem } from "@/lib/db/stars";
import { getBodiesBySystem } from "@/lib/db/bodies";

const sectorsDir = path.join(process.cwd(), "content/sectors");

// ── JSON path (Imperial Core only) ──

function loadStarSystemFromJson(
  sectorSlugForFs: string,
  systemSlug: string
): StarSystemMetadata {
  const fullPath = path.join(sectorsDir, sectorSlugForFs, `${systemSlug}.json`);
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
  migrateKankaToExternal(raw);
  const data = raw as Omit<StarSystemMetadata, "slug">;
  const bodies = data.bodies.filter((b) => !b.hidden);
  // JSON shape pre-dates center_kind; derive from star.type substrings.
  const centerKind = deriveCenterKindFromStarType(data.star?.type, !!data.secondaryStar);
  return { ...data, bodies, slug: systemSlug, centerKind };
}

// ── DB path: assemble StarSystemMetadata shape from rows ──

async function loadStarSystemFromDb(
  sectorSlug: string,
  systemSlug: string
): Promise<StarSystemMetadata> {
  const sectorRow = await getSectorRowBySlug(sectorSlug);
  if (!sectorRow) {
    throw new Error(`Sector not found in DB: ${sectorSlug}`);
  }
  const systemRow = await getSystemBySlug(sectorRow.id, systemSlug);
  if (!systemRow) {
    throw new Error(`System not found in DB: ${sectorSlug}/${systemSlug}`);
  }

  const [stars, bodyRows] = await Promise.all([
    getStarsBySystem(systemRow.id),
    getBodiesBySystem(systemRow.id),
  ]);

  const primaryRow = stars.find((s) => s.role === "primary");
  const secondaryRow = stars.find((s) => s.role === "secondary");
  // A system created via the editor without a primary star row used to throw
  // here, which the page's catch swallows — the pin then renders as a dead
  // placeholder and can't be drilled into. Synthesize a default star using
  // the centerKind-appropriate palette so the system is at least loadable.
  // (Users authoring via the editor still see + can fix the missing data.)
  const effectivePrimary = primaryRow ?? {
    id: -1,
    systemId: systemRow.id,
    role: "primary" as const,
    name: systemRow.name,
    fantasyLabel: null,
    color: "#FFE87A",
    secondaryColor: "#7C5F00",
    externalUrl: null,
  };

  // Build Star objects. The renderer still uses `star.type` (substring matcher),
  // so we revive it from the DB's fantasy_label column. New systems created via
  // the future editor will have fantasy_label optional; renderer migration to
  // center_kind happens in a later phase (map-migration.md §3.4.4).
  // The function signature uses NonNullable so callers don't have to null-
  // check; effectivePrimary above is the always-defined shim.
  const buildStar = (row: NonNullable<typeof primaryRow>): Star => {
    const star: Star = {
      name: row.name,
      type: row.fantasyLabel ?? "",
      color: row.color,
    };
    if (row.secondaryColor) star.secondaryColor = row.secondaryColor;
    if (row.externalUrl) star.externalUrl = row.externalUrl;
    return star;
  };

  const bodies: CelestialBody[] = bodyRows
    .filter((b) => b.published !== false)
    .map((b) => {
    const body: CelestialBody = {
      id: b.bodyId,
      dbId: b.id,
      name: b.name,
      type: b.type as CelestialBodyType,
      orbitPosition: b.orbitPosition,
      orbitDistance: b.orbitDistance,
    };
    if (b.biomeSlug) body.biome = b.biomeSlug as PlanetBiome;
    if (b.lore) body.lore = b.lore;
    if (b.labelPosition) body.labelPosition = b.labelPosition;
    if (b.specialAttribute) body.special_attribute = b.specialAttribute;
    if (b.allegianceSlug) body.allegiance = b.allegianceSlug as AllegianceKey;
    if (b.externalUrl) body.externalUrl = b.externalUrl;
    if (!b.published) body.published = false;
    return body;
  });

  const result: StarSystemMetadata = {
    slug: systemRow.slug,
    name: systemRow.name,
    centerKind: systemRow.centerKind,
    star: buildStar(effectivePrimary),
    bodies,
  };
  if (secondaryRow) result.secondaryStar = buildStar(secondaryRow);
  if (systemRow.binaryAngle !== null) result.binaryAngle = systemRow.binaryAngle;
  if (systemRow.externalUrl) result.externalUrl = systemRow.externalUrl;
  if (!systemRow.published) result.published = false;
  return result;
}

// ── Public API ──

export async function getStarSystemBySlug(
  sectorSlug: string,
  systemSlug: string
): Promise<StarSystemMetadata> {
  // Imperial Core stays JSON
  if (sectorSlug === "imperial-core") {
    return loadStarSystemFromJson("imperial-core", systemSlug);
  }
  // Everything else: DB
  return loadStarSystemFromDb(sectorSlug, systemSlug);
}
