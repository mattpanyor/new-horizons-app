import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface Biome {
  slug: string;
  label: string;
  color: string;
  secondaryColor: string;
}

function rowToBiome(row: Record<string, unknown>): Biome {
  return {
    slug: row.slug as string,
    label: row.label as string,
    color: row.color as string,
    secondaryColor: row.secondary_color as string,
  };
}

export async function getAllBiomes(): Promise<Biome[]> {
  const rows = await sql`
    SELECT slug, label, color, secondary_color FROM biomes ORDER BY label
  `;
  return rows.map(rowToBiome);
}

export async function getBiomeBySlug(slug: string): Promise<Biome | null> {
  const rows = await sql`
    SELECT slug, label, color, secondary_color FROM biomes WHERE slug = ${slug}
  `;
  return rows.length > 0 ? rowToBiome(rows[0]) : null;
}

export async function upsertBiome(b: Biome): Promise<void> {
  await sql`
    INSERT INTO biomes (slug, label, color, secondary_color)
    VALUES (${b.slug}, ${b.label}, ${b.color}, ${b.secondaryColor})
    ON CONFLICT (slug) DO UPDATE SET
      label = EXCLUDED.label,
      color = EXCLUDED.color,
      secondary_color = EXCLUDED.secondary_color
  `;
}
