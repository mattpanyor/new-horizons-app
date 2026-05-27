import type { CenterKind } from "@/lib/mapEnums";
import { cascadeSlugRename } from "@/lib/db/connections";
import { execQuery, type Tx } from "@/lib/db/tx";

export interface SystemRow {
  id: number;
  sectorId: number;
  slug: string;
  name: string;
  x: number;
  y: number;
  allegianceSlug: string | null;
  territoryRadius: number | null;
  centerKind: CenterKind;
  binaryAngle: number | null;
  externalUrl: string | null;
  published: boolean;
}

function rowToSystem(row: Record<string, unknown>): SystemRow {
  return {
    id: row.id as number,
    sectorId: row.sector_id as number,
    slug: row.slug as string,
    name: row.name as string,
    x: Number(row.x),
    y: Number(row.y),
    allegianceSlug: (row.allegiance_slug as string) ?? null,
    territoryRadius: row.territory_radius !== null ? Number(row.territory_radius) : null,
    centerKind: row.center_kind as CenterKind,
    binaryAngle: row.binary_angle !== null ? Number(row.binary_angle) : null,
    externalUrl: (row.external_url as string) ?? null,
    published: row.published as boolean,
  };
}

export async function getSystemsBySector(sectorId: number, tx?: Tx): Promise<SystemRow[]> {
  const rows = await execQuery(tx,
    `SELECT id, sector_id, slug, name, x, y, allegiance_slug, territory_radius,
            center_kind, binary_angle, external_url, published
     FROM systems WHERE sector_id = $1 ORDER BY id`,
    [sectorId]
  );
  return rows.map(rowToSystem);
}

export async function getSystemBySlug(
  sectorId: number,
  slug: string,
  tx?: Tx
): Promise<SystemRow | null> {
  const rows = await execQuery(tx,
    `SELECT id, sector_id, slug, name, x, y, allegiance_slug, territory_radius,
            center_kind, binary_angle, external_url, published
     FROM systems WHERE sector_id = $1 AND slug = $2`,
    [sectorId, slug]
  );
  return rows.length > 0 ? rowToSystem(rows[0]) : null;
}

export async function insertSystem(s: {
  sectorId: number;
  slug: string;
  name: string;
  x: number;
  y: number;
  allegianceSlug?: string | null;
  territoryRadius?: number | null;
  centerKind: CenterKind;
  binaryAngle?: number | null;
  externalUrl?: string | null;
  published?: boolean;
}, tx?: Tx): Promise<SystemRow> {
  const rows = await execQuery(tx,
    `INSERT INTO systems (
       sector_id, slug, name, x, y, allegiance_slug, territory_radius,
       center_kind, binary_angle, external_url, published
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, sector_id, slug, name, x, y, allegiance_slug, territory_radius,
               center_kind, binary_angle, external_url, published`,
    [
      s.sectorId, s.slug, s.name, s.x, s.y,
      s.allegianceSlug ?? null, s.territoryRadius ?? null,
      s.centerKind, s.binaryAngle ?? null,
      s.externalUrl ?? null, s.published ?? true,
    ]
  );
  return rowToSystem(rows[0]);
}

export async function updateSystem(
  id: number,
  fields: Partial<{
    slug: string;
    name: string;
    x: number;
    y: number;
    allegianceSlug: string | null;
    territoryRadius: number | null;
    centerKind: CenterKind;
    binaryAngle: number | null;
    externalUrl: string | null;
    published: boolean;
  }>,
  tx?: Tx
): Promise<void> {
  if (fields.slug !== undefined) {
    // Entity rename. Order matters: update the row FIRST, then cascade
    // connection slugs. If the row update fails (e.g. UNIQUE (sector_id, slug)
    // collision), we never rewrite connections — so they keep pointing at
    // the still-correct old slug instead of being orphaned.
    const rows = await execQuery(tx, `SELECT slug, sector_id FROM systems WHERE id = $1`, [id]);
    if (rows.length > 0) {
      const oldSlug = rows[0].slug as string;
      const sectorId = rows[0].sector_id as number;
      await execQuery(tx, `UPDATE systems SET slug = $1 WHERE id = $2`, [fields.slug, id]);
      if (oldSlug !== fields.slug) {
        await cascadeSlugRename(sectorId, oldSlug, fields.slug, tx);
      }
    } else {
      await execQuery(tx, `UPDATE systems SET slug = $1 WHERE id = $2`, [fields.slug, id]);
    }
  }
  if (fields.name !== undefined) await execQuery(tx, `UPDATE systems SET name = $1 WHERE id = $2`, [fields.name, id]);
  if (fields.x !== undefined) await execQuery(tx, `UPDATE systems SET x = $1 WHERE id = $2`, [fields.x, id]);
  if (fields.y !== undefined) await execQuery(tx, `UPDATE systems SET y = $1 WHERE id = $2`, [fields.y, id]);
  if (fields.allegianceSlug !== undefined) await execQuery(tx, `UPDATE systems SET allegiance_slug = $1 WHERE id = $2`, [fields.allegianceSlug, id]);
  if (fields.territoryRadius !== undefined) await execQuery(tx, `UPDATE systems SET territory_radius = $1 WHERE id = $2`, [fields.territoryRadius, id]);
  if (fields.centerKind !== undefined) await execQuery(tx, `UPDATE systems SET center_kind = $1 WHERE id = $2`, [fields.centerKind, id]);
  if (fields.binaryAngle !== undefined) await execQuery(tx, `UPDATE systems SET binary_angle = $1 WHERE id = $2`, [fields.binaryAngle, id]);
  if (fields.externalUrl !== undefined) await execQuery(tx, `UPDATE systems SET external_url = $1 WHERE id = $2`, [fields.externalUrl, id]);
  if (fields.published !== undefined) await execQuery(tx, `UPDATE systems SET published = $1 WHERE id = $2`, [fields.published, id]);
}

export async function deleteSystem(id: number, tx?: Tx): Promise<void> {
  await execQuery(tx, `DELETE FROM systems WHERE id = $1`, [id]);
}
