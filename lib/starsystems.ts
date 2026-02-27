import fs from "fs";
import path from "path";
import { StarSystemMetadata } from "@/types/starsystem";

const sectorsDir = path.join(process.cwd(), "content/sectors");

// Read a star system by its sector slug and system slug
export function getStarSystemBySlug(sectorSlug: string, systemSlug: string): StarSystemMetadata {
  const fullPath = path.join(sectorsDir, sectorSlug, `${systemSlug}.json`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const data = JSON.parse(fileContents) as Omit<StarSystemMetadata, "slug">;
  return { ...data, slug: systemSlug };
}

// Scan all sector subdirectories and return every published star system
export function getAllStarSystems(): StarSystemMetadata[] {
  if (!fs.existsSync(sectorsDir)) return [];
  const systems: StarSystemMetadata[] = [];
  const entries = fs.readdirSync(sectorsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const files = fs.readdirSync(path.join(sectorsDir, entry.name)).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const slug = file.replace(/\.json$/, "");
      try {
        const sys = getStarSystemBySlug(entry.name, slug);
        if (sys.published !== false) systems.push(sys);
      } catch {}
    }
  }
  return systems;
}

// Return all star system slugs across all sectors (for generateStaticParams)
export function getStarSystemSlugs(): string[] {
  return getAllStarSystems().map((s) => s.slug);
}

// Find a star system by slug alone, scanning all sectors (for standalone pages)
export function findStarSystem(slug: string): StarSystemMetadata | null {
  if (!fs.existsSync(sectorsDir)) return null;
  const entries = fs.readdirSync(sectorsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      return getStarSystemBySlug(entry.name, slug);
    } catch {}
  }
  return null;
}
