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
      return data;
    }
  }
  throw new Error(`Sector not found: ${slug}`);
}

export function getAllSectors(): SectorMetadata[] {
  const slugs = getSectorSlugs();
  return slugs.map((slug) => getSectorBySlug(slug));
}
