import fs from "fs";
import path from "path";
import { SectorMetadata } from "@/types/sector";

const sectorsDirectory = path.join(process.cwd(), "content/sectors");

export function getSectorSlugs(): string[] {
  if (!fs.existsSync(sectorsDirectory)) {
    return [];
  }
  const files = fs.readdirSync(sectorsDirectory);
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));
}

export function getSectorBySlug(slug: string): SectorMetadata {
  const fullPath = path.join(sectorsDirectory, `${slug}.json`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const data = JSON.parse(fileContents) as Omit<SectorMetadata, "slug">;
  return { ...data, slug };
}

export function getAllSectors(): SectorMetadata[] {
  const slugs = getSectorSlugs();
  return slugs.map((slug) => getSectorBySlug(slug));
}
