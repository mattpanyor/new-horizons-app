import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface SectorRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  color: string;
  nebulaColor: string | null;
  published: boolean;
}

function rowToSector(row: Record<string, unknown>): SectorRow {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string,
    color: row.color as string,
    nebulaColor: (row.nebula_color as string) ?? null,
    published: row.published as boolean,
  };
}

export async function getAllSectorRows(): Promise<SectorRow[]> {
  const rows = await sql`
    SELECT id, slug, name, description, color, nebula_color, published
    FROM sectors ORDER BY id
  `;
  return rows.map(rowToSector);
}

export async function getSectorRowBySlug(slug: string): Promise<SectorRow | null> {
  const rows = await sql`
    SELECT id, slug, name, description, color, nebula_color, published
    FROM sectors WHERE slug = ${slug}
  `;
  return rows.length > 0 ? rowToSector(rows[0]) : null;
}

export async function upsertSector(s: {
  slug: string;
  name: string;
  description: string;
  color: string;
  nebulaColor: string | null;
  published: boolean;
}): Promise<SectorRow> {
  const rows = await sql`
    INSERT INTO sectors (slug, name, description, color, nebula_color, published)
    VALUES (${s.slug}, ${s.name}, ${s.description}, ${s.color}, ${s.nebulaColor}, ${s.published})
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      color = EXCLUDED.color,
      nebula_color = EXCLUDED.nebula_color,
      published = EXCLUDED.published,
      updated_at = NOW()
    RETURNING id, slug, name, description, color, nebula_color, published
  `;
  return rowToSector(rows[0]);
}
