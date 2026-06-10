import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface Allegiance {
  slug: string;
  name: string;
  color: string;
  logoUrl: string | null;
}

function rowToAllegiance(row: Record<string, unknown>): Allegiance {
  return {
    slug: row.slug as string,
    name: row.name as string,
    color: row.color as string,
    logoUrl: (row.logo_url as string) ?? null,
  };
}

export async function getAllAllegiances(): Promise<Allegiance[]> {
  const rows = await sql`
    SELECT slug, name, color, logo_url FROM allegiances ORDER BY name
  `;
  return rows.map(rowToAllegiance);
}

export async function getAllegianceBySlug(slug: string): Promise<Allegiance | null> {
  const rows = await sql`
    SELECT slug, name, color, logo_url FROM allegiances WHERE slug = ${slug}
  `;
  return rows.length > 0 ? rowToAllegiance(rows[0]) : null;
}

export async function upsertAllegiance(a: {
  slug: string;
  name: string;
  color: string;
  logoUrl?: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO allegiances (slug, name, color, logo_url)
    VALUES (${a.slug}, ${a.name}, ${a.color}, ${a.logoUrl ?? null})
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      color = EXCLUDED.color,
      logo_url = EXCLUDED.logo_url
  `;
}
