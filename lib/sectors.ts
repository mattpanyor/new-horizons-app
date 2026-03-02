import fs from "fs";
import path from "path";
import { SectorMetadata } from "@/types/sector";

const sectorsDirectory = path.join(process.cwd(), "content/sectors");

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
    if (data.slug === slug) return data;
  }
  throw new Error(`Sector not found: ${slug}`);
}

export function getAllSectors(): SectorMetadata[] {
  const slugs = getSectorSlugs();
  return slugs.map((slug) => getSectorBySlug(slug));
}
