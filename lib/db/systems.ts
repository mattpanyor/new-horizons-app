import { neon } from "@neondatabase/serverless";
import type { CenterKind } from "@/lib/mapEnums";
import { cascadeSlugRename } from "@/lib/db/connections";

const sql = neon(process.env.DATABASE_URL!);

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

export async function getSystemsBySector(sectorId: number): Promise<SystemRow[]> {
  const rows = await sql`
    SELECT id, sector_id, slug, name, x, y, allegiance_slug, territory_radius,
           center_kind, binary_angle, external_url, published
    FROM systems WHERE sector_id = ${sectorId} ORDER BY id
  `;
  return rows.map(rowToSystem);
}

export async function getSystemBySlug(
  sectorId: number,
  slug: string
): Promise<SystemRow | null> {
  const rows = await sql`
    SELECT id, sector_id, slug, name, x, y, allegiance_slug, territory_radius,
           center_kind, binary_angle, external_url, published
    FROM systems WHERE sector_id = ${sectorId} AND slug = ${slug}
  `;
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
}): Promise<SystemRow> {
  const rows = await sql`
    INSERT INTO systems (
      sector_id, slug, name, x, y, allegiance_slug, territory_radius,
      center_kind, binary_angle, external_url, published
    ) VALUES (
      ${s.sectorId}, ${s.slug}, ${s.name}, ${s.x}, ${s.y},
      ${s.allegianceSlug ?? null}, ${s.territoryRadius ?? null},
      ${s.centerKind}, ${s.binaryAngle ?? null},
      ${s.externalUrl ?? null}, ${s.published ?? true}
    )
    RETURNING id, sector_id, slug, name, x, y, allegiance_slug, territory_radius,
              center_kind, binary_angle, external_url, published
  `;
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
  }>
): Promise<void> {
  if (fields.slug !== undefined) {
    // Slug rename — also rewrite any connection that referenced the old slug
    // as an endpoint, so the GM doesn't have to fix orphans manually.
    const rows = await sql`SELECT slug, sector_id FROM systems WHERE id = ${id}`;
    if (rows.length > 0) {
      const oldSlug = rows[0].slug as string;
      const sectorId = rows[0].sector_id as number;
      if (oldSlug !== fields.slug) {
        await cascadeSlugRename(sectorId, oldSlug, fields.slug);
      }
    }
    await sql`UPDATE systems SET slug = ${fields.slug} WHERE id = ${id}`;
  }
  if (fields.name !== undefined) await sql`UPDATE systems SET name = ${fields.name} WHERE id = ${id}`;
  if (fields.x !== undefined) await sql`UPDATE systems SET x = ${fields.x} WHERE id = ${id}`;
  if (fields.y !== undefined) await sql`UPDATE systems SET y = ${fields.y} WHERE id = ${id}`;
  if (fields.allegianceSlug !== undefined) await sql`UPDATE systems SET allegiance_slug = ${fields.allegianceSlug} WHERE id = ${id}`;
  if (fields.territoryRadius !== undefined) await sql`UPDATE systems SET territory_radius = ${fields.territoryRadius} WHERE id = ${id}`;
  if (fields.centerKind !== undefined) await sql`UPDATE systems SET center_kind = ${fields.centerKind} WHERE id = ${id}`;
  if (fields.binaryAngle !== undefined) await sql`UPDATE systems SET binary_angle = ${fields.binaryAngle} WHERE id = ${id}`;
  if (fields.externalUrl !== undefined) await sql`UPDATE systems SET external_url = ${fields.externalUrl} WHERE id = ${id}`;
  if (fields.published !== undefined) await sql`UPDATE systems SET published = ${fields.published} WHERE id = ${id}`;
}

export async function deleteSystem(id: number): Promise<void> {
  await sql`DELETE FROM systems WHERE id = ${id}`;
}
