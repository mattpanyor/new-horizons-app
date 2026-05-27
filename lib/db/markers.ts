import type { MarkerType, Layer } from "@/lib/mapEnums";
import { cascadeSlugRename } from "@/lib/db/connections";
import { execQuery, type Tx } from "@/lib/db/tx";

export interface MarkerRow {
  id: number;
  sectorId: number;
  slug: string;
  name: string;
  type: MarkerType;
  allegianceSlug: string | null;
  externalUrl: string | null;
  territoryRadius: number | null;
  layer: Layer | null;
  connectionId: number | null;
  position: number | null;
  x: number | null;
  y: number | null;
  angle: number | null;
}

function rowToMarker(row: Record<string, unknown>): MarkerRow {
  return {
    id: row.id as number,
    sectorId: row.sector_id as number,
    slug: row.slug as string,
    name: row.name as string,
    type: row.type as MarkerType,
    allegianceSlug: (row.allegiance_slug as string) ?? null,
    externalUrl: (row.external_url as string) ?? null,
    territoryRadius: row.territory_radius !== null ? Number(row.territory_radius) : null,
    layer: (row.layer as Layer) ?? null,
    connectionId: row.connection_id !== null ? Number(row.connection_id) : null,
    position: row.position !== null ? Number(row.position) : null,
    x: row.x !== null ? Number(row.x) : null,
    y: row.y !== null ? Number(row.y) : null,
    angle: row.angle !== null ? Number(row.angle) : null,
  };
}

export async function getMarkersBySector(sectorId: number, tx?: Tx): Promise<MarkerRow[]> {
  const rows = await execQuery(tx,
    `SELECT id, sector_id, slug, name, type, allegiance_slug, external_url,
            territory_radius, layer, connection_id, position, x, y, angle
     FROM markers WHERE sector_id = $1 ORDER BY id`,
    [sectorId]
  );
  return rows.map(rowToMarker);
}

export async function insertMarker(m: {
  sectorId: number;
  slug: string;
  name: string;
  type: MarkerType;
  allegianceSlug?: string | null;
  externalUrl?: string | null;
  territoryRadius?: number | null;
  layer?: Layer | null;
  connectionId?: number | null;
  position?: number | null;
  x?: number | null;
  y?: number | null;
  angle?: number | null;
}, tx?: Tx): Promise<MarkerRow> {
  const rows = await execQuery(tx,
    `INSERT INTO markers (
       sector_id, slug, name, type, allegiance_slug, external_url,
       territory_radius, layer, connection_id, position, x, y, angle
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, sector_id, slug, name, type, allegiance_slug, external_url,
               territory_radius, layer, connection_id, position, x, y, angle`,
    [
      m.sectorId, m.slug, m.name, m.type,
      m.allegianceSlug ?? null, m.externalUrl ?? null,
      m.territoryRadius ?? null, m.layer ?? null,
      m.connectionId ?? null, m.position ?? null,
      m.x ?? null, m.y ?? null, m.angle ?? null,
    ]
  );
  return rowToMarker(rows[0]);
}

export async function updateMarker(
  id: number,
  fields: Partial<{
    slug: string;
    name: string;
    type: MarkerType;
    allegianceSlug: string | null;
    externalUrl: string | null;
    territoryRadius: number | null;
    layer: Layer | null;
    connectionId: number | null;
    position: number | null;
    x: number | null;
    y: number | null;
    angle: number | null;
  }>,
  tx?: Tx
): Promise<void> {
  // Non-positional fields can be updated independently.
  if (fields.slug !== undefined) {
    // Update row first; cascade only if the rename actually committed.
    const rows = await execQuery(tx, `SELECT slug, sector_id FROM markers WHERE id = $1`, [id]);
    if (rows.length > 0) {
      const oldSlug = rows[0].slug as string;
      const sectorId = rows[0].sector_id as number;
      await execQuery(tx, `UPDATE markers SET slug = $1 WHERE id = $2`, [fields.slug, id]);
      if (oldSlug !== fields.slug) {
        await cascadeSlugRename(sectorId, oldSlug, fields.slug, tx);
      }
    } else {
      await execQuery(tx, `UPDATE markers SET slug = $1 WHERE id = $2`, [fields.slug, id]);
    }
  }
  if (fields.name !== undefined) await execQuery(tx, `UPDATE markers SET name = $1 WHERE id = $2`, [fields.name, id]);
  if (fields.type !== undefined) await execQuery(tx, `UPDATE markers SET type = $1 WHERE id = $2`, [fields.type, id]);
  if (fields.allegianceSlug !== undefined) await execQuery(tx, `UPDATE markers SET allegiance_slug = $1 WHERE id = $2`, [fields.allegianceSlug, id]);
  if (fields.externalUrl !== undefined) await execQuery(tx, `UPDATE markers SET external_url = $1 WHERE id = $2`, [fields.externalUrl, id]);
  if (fields.territoryRadius !== undefined) await execQuery(tx, `UPDATE markers SET territory_radius = $1 WHERE id = $2`, [fields.territoryRadius, id]);
  if (fields.layer !== undefined) await execQuery(tx, `UPDATE markers SET layer = $1 WHERE id = $2`, [fields.layer, id]);

  // Positional fields must be updated atomically because the table CHECK
  // enforces a strict XOR between (connection_id + position) and (x + y).
  // The previous version naively preserved current x/y when only
  // connection_id was passed, which produced rows with BOTH shapes set and
  // violated the constraint. We now decide the target shape first
  // (attached vs free) and explicitly NULL the other side.
  const positionalTouched =
    fields.connectionId !== undefined ||
    fields.position !== undefined ||
    fields.x !== undefined ||
    fields.y !== undefined ||
    fields.angle !== undefined;
  if (positionalTouched) {
    const rows = await execQuery(tx,
      `SELECT connection_id, position, x, y, angle FROM markers WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return;
    const cur = rows[0];

    // Decide shape: explicit connection_id wins; else infer from explicit
    // x/y; else keep current shape.
    let attached: boolean;
    if (fields.connectionId !== undefined) {
      attached = fields.connectionId !== null;
    } else if (fields.x !== undefined || fields.y !== undefined) {
      attached = false;
    } else {
      attached = cur.connection_id !== null;
    }

    if (attached) {
      const cidValue = fields.connectionId !== undefined ? fields.connectionId : cur.connection_id;
      const pos      = fields.position    !== undefined ? fields.position    : cur.position ?? 0.5;
      await execQuery(tx,
        `UPDATE markers
         SET connection_id = $1,
             position      = $2,
             x             = NULL,
             y             = NULL,
             angle         = NULL
         WHERE id = $3`,
        [cidValue, pos, id]
      );
    } else {
      const xv  = fields.x     !== undefined ? fields.x     : cur.x ?? 0;
      const yv  = fields.y     !== undefined ? fields.y     : cur.y ?? 0;
      const ang = fields.angle !== undefined ? fields.angle : cur.angle;
      await execQuery(tx,
        `UPDATE markers
         SET connection_id = NULL,
             position      = NULL,
             x             = $1,
             y             = $2,
             angle         = $3
         WHERE id = $4`,
        [xv, yv, ang, id]
      );
    }
  }
}

export async function deleteMarker(id: number, tx?: Tx): Promise<void> {
  await execQuery(tx, `DELETE FROM markers WHERE id = $1`, [id]);
}
