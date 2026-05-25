import { neon } from "@neondatabase/serverless";
import type { Layer } from "@/lib/mapEnums";

const sql = neon(process.env.DATABASE_URL!);

export interface ConnectionRow {
  id: number;
  sectorId: number;
  fromSlug: string;
  toSlug: string;
  curvature: number | null;
  label: string | null;
  color: string | null;
  dashes: string | null;
  opacity: number | null;
  layer: Layer | null;
}

function rowToConnection(row: Record<string, unknown>): ConnectionRow {
  return {
    id: row.id as number,
    sectorId: row.sector_id as number,
    fromSlug: row.from_slug as string,
    toSlug: row.to_slug as string,
    curvature: row.curvature !== null ? Number(row.curvature) : null,
    label: (row.label as string) ?? null,
    color: (row.color as string) ?? null,
    dashes: (row.dashes as string) ?? null,
    opacity: row.opacity !== null ? Number(row.opacity) : null,
    layer: (row.layer as Layer) ?? null,
  };
}

export async function getConnectionsBySector(sectorId: number): Promise<ConnectionRow[]> {
  const rows = await sql`
    SELECT id, sector_id, from_slug, to_slug, curvature, label, color, dashes, opacity, layer
    FROM connections WHERE sector_id = ${sectorId} ORDER BY id
  `;
  return rows.map(rowToConnection);
}

export async function insertConnection(c: {
  sectorId: number;
  fromSlug: string;
  toSlug: string;
  curvature?: number | null;
  label?: string | null;
  color?: string | null;
  dashes?: string | null;
  opacity?: number | null;
  layer?: Layer | null;
}): Promise<ConnectionRow> {
  const rows = await sql`
    INSERT INTO connections (
      sector_id, from_slug, to_slug, curvature, label, color, dashes, opacity, layer
    ) VALUES (
      ${c.sectorId}, ${c.fromSlug}, ${c.toSlug},
      ${c.curvature ?? null}, ${c.label ?? null}, ${c.color ?? null},
      ${c.dashes ?? null}, ${c.opacity ?? null}, ${c.layer ?? null}
    )
    RETURNING id, sector_id, from_slug, to_slug, curvature, label, color, dashes, opacity, layer
  `;
  return rowToConnection(rows[0]);
}

export async function updateConnection(
  id: number,
  fields: Partial<{
    fromSlug: string;
    toSlug: string;
    curvature: number | null;
    label: string | null;
    color: string | null;
    dashes: string | null;
    opacity: number | null;
    layer: Layer | null;
  }>
): Promise<void> {
  if (fields.fromSlug !== undefined) await sql`UPDATE connections SET from_slug = ${fields.fromSlug} WHERE id = ${id}`;
  if (fields.toSlug !== undefined) await sql`UPDATE connections SET to_slug = ${fields.toSlug} WHERE id = ${id}`;
  if (fields.curvature !== undefined) await sql`UPDATE connections SET curvature = ${fields.curvature} WHERE id = ${id}`;
  if (fields.label !== undefined) await sql`UPDATE connections SET label = ${fields.label} WHERE id = ${id}`;
  if (fields.color !== undefined) await sql`UPDATE connections SET color = ${fields.color} WHERE id = ${id}`;
  if (fields.dashes !== undefined) await sql`UPDATE connections SET dashes = ${fields.dashes} WHERE id = ${id}`;
  if (fields.opacity !== undefined) await sql`UPDATE connections SET opacity = ${fields.opacity} WHERE id = ${id}`;
  if (fields.layer !== undefined) await sql`UPDATE connections SET layer = ${fields.layer} WHERE id = ${id}`;
}

export async function deleteConnection(id: number): Promise<void> {
  await sql`DELETE FROM connections WHERE id = ${id}`;
}

/**
 * Slug-rename cascade. When a system/vortex/marker is renamed, rewrite the
 * connection endpoints that referenced its old slug. Sector-scoped so a slug
 * collision in another sector can't cause unrelated rewrites.
 *
 * Called by updateSystem / updateVortex / updateMarker when their slug
 * changes. No-op if old and new are equal.
 */
export async function cascadeSlugRename(
  sectorId: number,
  oldSlug: string,
  newSlug: string
): Promise<void> {
  if (oldSlug === newSlug) return;
  await sql`
    UPDATE connections
    SET from_slug = ${newSlug}
    WHERE sector_id = ${sectorId} AND from_slug = ${oldSlug}
  `;
  await sql`
    UPDATE connections
    SET to_slug = ${newSlug}
    WHERE sector_id = ${sectorId} AND to_slug = ${oldSlug}
  `;
}
