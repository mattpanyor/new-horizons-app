import { neon } from "@neondatabase/serverless";
import type { Layer } from "@/lib/mapEnums";
import { cascadeSlugRename } from "@/lib/db/connections";

const sql = neon(process.env.DATABASE_URL!);

export interface VortexRow {
  id: number;
  sectorId: number;
  slug: string;
  name: string;
  x: number;
  y: number;
  color: string | null;
  radius: number | null;
  ratioW: number | null;
  ratioH: number | null;
  layer: Layer | null;
}

function rowToVortex(row: Record<string, unknown>): VortexRow {
  return {
    id: row.id as number,
    sectorId: row.sector_id as number,
    slug: row.slug as string,
    name: row.name as string,
    x: Number(row.x),
    y: Number(row.y),
    color: (row.color as string) ?? null,
    radius: row.radius !== null ? Number(row.radius) : null,
    ratioW: row.ratio_w !== null ? Number(row.ratio_w) : null,
    ratioH: row.ratio_h !== null ? Number(row.ratio_h) : null,
    layer: (row.layer as Layer) ?? null,
  };
}

export async function getVortexesBySector(sectorId: number): Promise<VortexRow[]> {
  const rows = await sql`
    SELECT id, sector_id, slug, name, x, y, color, radius, ratio_w, ratio_h, layer
    FROM vortexes WHERE sector_id = ${sectorId} ORDER BY id
  `;
  return rows.map(rowToVortex);
}

export async function insertVortex(v: {
  sectorId: number;
  slug: string;
  name: string;
  x: number;
  y: number;
  color?: string | null;
  radius?: number | null;
  ratioW?: number | null;
  ratioH?: number | null;
  layer?: Layer | null;
}): Promise<VortexRow> {
  const rows = await sql`
    INSERT INTO vortexes (
      sector_id, slug, name, x, y, color, radius, ratio_w, ratio_h, layer
    ) VALUES (
      ${v.sectorId}, ${v.slug}, ${v.name}, ${v.x}, ${v.y},
      ${v.color ?? null}, ${v.radius ?? null},
      ${v.ratioW ?? null}, ${v.ratioH ?? null},
      ${v.layer ?? null}
    )
    RETURNING id, sector_id, slug, name, x, y, color, radius, ratio_w, ratio_h, layer
  `;
  return rowToVortex(rows[0]);
}

export async function updateVortex(
  id: number,
  fields: Partial<{
    slug: string;
    name: string;
    x: number;
    y: number;
    color: string | null;
    radius: number | null;
    ratioW: number | null;
    ratioH: number | null;
    layer: Layer | null;
  }>
): Promise<void> {
  if (fields.slug !== undefined) {
    const rows = await sql`SELECT slug, sector_id FROM vortexes WHERE id = ${id}`;
    if (rows.length > 0) {
      const oldSlug = rows[0].slug as string;
      const sectorId = rows[0].sector_id as number;
      if (oldSlug !== fields.slug) {
        await cascadeSlugRename(sectorId, oldSlug, fields.slug);
      }
    }
    await sql`UPDATE vortexes SET slug = ${fields.slug} WHERE id = ${id}`;
  }
  if (fields.name !== undefined) await sql`UPDATE vortexes SET name = ${fields.name} WHERE id = ${id}`;
  if (fields.x !== undefined) await sql`UPDATE vortexes SET x = ${fields.x} WHERE id = ${id}`;
  if (fields.y !== undefined) await sql`UPDATE vortexes SET y = ${fields.y} WHERE id = ${id}`;
  if (fields.color !== undefined) await sql`UPDATE vortexes SET color = ${fields.color} WHERE id = ${id}`;
  if (fields.radius !== undefined) await sql`UPDATE vortexes SET radius = ${fields.radius} WHERE id = ${id}`;
  if (fields.ratioW !== undefined) await sql`UPDATE vortexes SET ratio_w = ${fields.ratioW} WHERE id = ${id}`;
  if (fields.ratioH !== undefined) await sql`UPDATE vortexes SET ratio_h = ${fields.ratioH} WHERE id = ${id}`;
  if (fields.layer !== undefined) await sql`UPDATE vortexes SET layer = ${fields.layer} WHERE id = ${id}`;
}

export async function deleteVortex(id: number): Promise<void> {
  await sql`DELETE FROM vortexes WHERE id = ${id}`;
}
