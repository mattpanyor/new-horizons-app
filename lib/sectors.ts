import fs from "fs";
import path from "path";
import { SectorMetadata } from "@/types/sector";
import { ALLEGIANCES } from "@/lib/allegiances";

const sectorsDirectory = path.join(process.cwd(), "content/sectors");

const validAllegiances = new Set(Object.keys(ALLEGIANCES));

/** Validate allegiance keys in a parsed sector against the ALLEGIANCES registry */
function validateSector(data: SectorMetadata, file: string): void {
  for (const sys of data.systems) {
    if (sys.allegiance && !validAllegiances.has(sys.allegiance)) {
      console.warn(`[sectors] Unknown allegiance "${sys.allegiance}" for system "${sys.slug}" in ${file}`);
    }
  }
  for (const conn of data.connections ?? []) {
    if (conn.marker?.allegiance && !validAllegiances.has(conn.marker.allegiance)) {
      console.warn(`[sectors] Unknown marker allegiance "${conn.marker.allegiance}" in connection ${conn.from}→${conn.to} in ${file}`);
    }
  }
}


/**
 * Strip every item flagged `hidden: true` so consumers (SectorMap, GalacticMap,
 * etc.) never have to know about the flag. Filtering at the loader keeps the
 * rendering layer ignorant of which items are deliberately suppressed.
 *
 * Connection-marker hides drop just the marker — the connection line stays.
 * Connection hides drop the whole entry (line + marker). Mirrors the rules
 * documented in `.claude/skills/content-authoring/SKILL.md`.
 */
function stripHidden(data: SectorMetadata): SectorMetadata {
  const next: SectorMetadata = {
    ...data,
    systems: data.systems.filter((s) => !s.hidden),
  };
  if (data.vortexes) next.vortexes = data.vortexes.filter((v) => !v.hidden);
  if (data.markers) next.markers = data.markers.filter((m) => !m.hidden);
  if (data.connections) {
    next.connections = data.connections
      .filter((c) => !c.hidden)
      .map((c) => {
        if (c.marker?.hidden) {
          // Spread without the hidden marker.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { marker, ...rest } = c;
          return rest;
        }
        return c;
      });
  }
  return next;
}

export function getSectorSlugs(): string[] {
  if (!fs.existsSync(sectorsDirectory)) return [];
  return fs
    .readdirSync(sectorsDirectory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(sectorsDirectory, file);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8")) as SectorMetadata;
      return data.slug;
    });
}

export function getSectorBySlug(slug: string): SectorMetadata {
  if (!fs.existsSync(sectorsDirectory)) throw new Error(`Sector not found: ${slug}`);
  const files = fs.readdirSync(sectorsDirectory).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const fullPath = path.join(sectorsDirectory, file);
    const data = JSON.parse(fs.readFileSync(fullPath, "utf8")) as SectorMetadata;
    if (data.slug === slug) {
      validateSector(data, file);
      return stripHidden(data);
    }
  }
  throw new Error(`Sector not found: ${slug}`);
}

export function getAllSectors(): SectorMetadata[] {
  const slugs = getSectorSlugs();
  return slugs.map((slug) => getSectorBySlug(slug));
}
