import type { Layer } from "@/lib/mapEnums";
import { cascadeSlugRename } from "@/lib/db/connections";
import { execQuery, type Tx } from "@/lib/db/tx";

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

export async function getVortexesBySector(sectorId: number, tx?: Tx): Promise<VortexRow[]> {
  const rows = await execQuery(tx,
    `SELECT id, sector_id, slug, name, x, y, color, radius, ratio_w, ratio_h, layer
     FROM vortexes WHERE sector_id = $1 ORDER BY id`,
    [sectorId]
  );
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
}, tx?: Tx): Promise<VortexRow> {
  const rows = await execQuery(tx,
    `INSERT INTO vortexes (
       sector_id, slug, name, x, y, color, radius, ratio_w, ratio_h, layer
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, sector_id, slug, name, x, y, color, radius, ratio_w, ratio_h, layer`,
    [
      v.sectorId, v.slug, v.name, v.x, v.y,
      v.color ?? null, v.radius ?? null,
      v.ratioW ?? null, v.ratioH ?? null,
      v.layer ?? null,
    ]
  );
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
  }>,
  tx?: Tx
): Promise<void> {
  if (fields.slug !== undefined) {
    // Update row first; cascade only if the rename actually committed (see
    // lib/db/systems.ts updateSystem for rationale).
    const rows = await execQuery(tx, `SELECT slug, sector_id FROM vortexes WHERE id = $1`, [id]);
    if (rows.length > 0) {
      const oldSlug = rows[0].slug as string;
      const sectorId = rows[0].sector_id as number;
      await execQuery(tx, `UPDATE vortexes SET slug = $1 WHERE id = $2`, [fields.slug, id]);
      if (oldSlug !== fields.slug) {
        await cascadeSlugRename(sectorId, oldSlug, fields.slug, tx);
      }
    } else {
      await execQuery(tx, `UPDATE vortexes SET slug = $1 WHERE id = $2`, [fields.slug, id]);
    }
  }
  if (fields.name !== undefined) await execQuery(tx, `UPDATE vortexes SET name = $1 WHERE id = $2`, [fields.name, id]);
  if (fields.x !== undefined) await execQuery(tx, `UPDATE vortexes SET x = $1 WHERE id = $2`, [fields.x, id]);
  if (fields.y !== undefined) await execQuery(tx, `UPDATE vortexes SET y = $1 WHERE id = $2`, [fields.y, id]);
  if (fields.color !== undefined) await execQuery(tx, `UPDATE vortexes SET color = $1 WHERE id = $2`, [fields.color, id]);
  if (fields.radius !== undefined) await execQuery(tx, `UPDATE vortexes SET radius = $1 WHERE id = $2`, [fields.radius, id]);
  if (fields.ratioW !== undefined) await execQuery(tx, `UPDATE vortexes SET ratio_w = $1 WHERE id = $2`, [fields.ratioW, id]);
  if (fields.ratioH !== undefined) await execQuery(tx, `UPDATE vortexes SET ratio_h = $1 WHERE id = $2`, [fields.ratioH, id]);
  if (fields.layer !== undefined) await execQuery(tx, `UPDATE vortexes SET layer = $1 WHERE id = $2`, [fields.layer, id]);
}

export async function deleteVortex(id: number, tx?: Tx): Promise<void> {
  await execQuery(tx, `DELETE FROM vortexes WHERE id = $1`, [id]);
}
