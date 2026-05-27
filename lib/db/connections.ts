import type { Layer } from "@/lib/mapEnums";
import { execQuery, type Tx } from "@/lib/db/tx";

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

export async function getConnectionsBySector(sectorId: number, tx?: Tx): Promise<ConnectionRow[]> {
  const rows = await execQuery(tx,
    `SELECT id, sector_id, from_slug, to_slug, curvature, label, color, dashes, opacity, layer
     FROM connections WHERE sector_id = $1 ORDER BY id`,
    [sectorId]
  );
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
}, tx?: Tx): Promise<ConnectionRow> {
  const rows = await execQuery(tx,
    `INSERT INTO connections (
       sector_id, from_slug, to_slug, curvature, label, color, dashes, opacity, layer
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, sector_id, from_slug, to_slug, curvature, label, color, dashes, opacity, layer`,
    [
      c.sectorId, c.fromSlug, c.toSlug,
      c.curvature ?? null, c.label ?? null, c.color ?? null,
      c.dashes ?? null, c.opacity ?? null, c.layer ?? null,
    ]
  );
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
  }>,
  tx?: Tx
): Promise<void> {
  if (fields.fromSlug !== undefined) await execQuery(tx, `UPDATE connections SET from_slug = $1 WHERE id = $2`, [fields.fromSlug, id]);
  if (fields.toSlug !== undefined) await execQuery(tx, `UPDATE connections SET to_slug = $1 WHERE id = $2`, [fields.toSlug, id]);
  if (fields.curvature !== undefined) await execQuery(tx, `UPDATE connections SET curvature = $1 WHERE id = $2`, [fields.curvature, id]);
  if (fields.label !== undefined) await execQuery(tx, `UPDATE connections SET label = $1 WHERE id = $2`, [fields.label, id]);
  if (fields.color !== undefined) await execQuery(tx, `UPDATE connections SET color = $1 WHERE id = $2`, [fields.color, id]);
  if (fields.dashes !== undefined) await execQuery(tx, `UPDATE connections SET dashes = $1 WHERE id = $2`, [fields.dashes, id]);
  if (fields.opacity !== undefined) await execQuery(tx, `UPDATE connections SET opacity = $1 WHERE id = $2`, [fields.opacity, id]);
  if (fields.layer !== undefined) await execQuery(tx, `UPDATE connections SET layer = $1 WHERE id = $2`, [fields.layer, id]);
}

export async function deleteConnection(id: number, tx?: Tx): Promise<void> {
  await execQuery(tx, `DELETE FROM connections WHERE id = $1`, [id]);
}

/**
 * Slug-rename cascade. When a system/vortex/marker is renamed, rewrite the
 * connection endpoints that referenced its old slug. Sector-scoped so a slug
 * collision in another sector can't cause unrelated rewrites.
 *
 * Called by updateSystem / updateVortex / updateMarker when their slug
 * changes. No-op if old and new are equal. The `tx` parameter MUST be
 * threaded through from the parent caller — otherwise the cascade runs on
 * a separate connection, outside the transaction.
 */
export async function cascadeSlugRename(
  sectorId: number,
  oldSlug: string,
  newSlug: string,
  tx?: Tx
): Promise<void> {
  if (oldSlug === newSlug) return;
  await execQuery(tx,
    `UPDATE connections SET from_slug = $1 WHERE sector_id = $2 AND from_slug = $3`,
    [newSlug, sectorId, oldSlug]
  );
  await execQuery(tx,
    `UPDATE connections SET to_slug = $1 WHERE sector_id = $2 AND to_slug = $3`,
    [newSlug, sectorId, oldSlug]
  );
}
