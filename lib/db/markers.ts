import { neon } from "@neondatabase/serverless";
import type { MarkerType, Layer } from "@/lib/mapEnums";
import { cascadeSlugRename } from "@/lib/db/connections";

const sql = neon(process.env.DATABASE_URL!);

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

export async function getMarkersBySector(sectorId: number): Promise<MarkerRow[]> {
  const rows = await sql`
    SELECT id, sector_id, slug, name, type, allegiance_slug, external_url,
           territory_radius, layer, connection_id, position, x, y, angle
    FROM markers WHERE sector_id = ${sectorId} ORDER BY id
  `;
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
}): Promise<MarkerRow> {
  const rows = await sql`
    INSERT INTO markers (
      sector_id, slug, name, type, allegiance_slug, external_url,
      territory_radius, layer, connection_id, position, x, y, angle
    ) VALUES (
      ${m.sectorId}, ${m.slug}, ${m.name}, ${m.type},
      ${m.allegianceSlug ?? null}, ${m.externalUrl ?? null},
      ${m.territoryRadius ?? null}, ${m.layer ?? null},
      ${m.connectionId ?? null}, ${m.position ?? null},
      ${m.x ?? null}, ${m.y ?? null}, ${m.angle ?? null}
    )
    RETURNING id, sector_id, slug, name, type, allegiance_slug, external_url,
              territory_radius, layer, connection_id, position, x, y, angle
  `;
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
  }>
): Promise<void> {
  // Non-positional fields can be updated independently.
  if (fields.slug !== undefined) {
    // Update row first; cascade only if the rename actually committed.
    const rows = await sql`SELECT slug, sector_id FROM markers WHERE id = ${id}`;
    if (rows.length > 0) {
      const oldSlug = rows[0].slug as string;
      const sectorId = rows[0].sector_id as number;
      await sql`UPDATE markers SET slug = ${fields.slug} WHERE id = ${id}`;
      if (oldSlug !== fields.slug) {
        await cascadeSlugRename(sectorId, oldSlug, fields.slug);
      }
    } else {
      await sql`UPDATE markers SET slug = ${fields.slug} WHERE id = ${id}`;
    }
  }
  if (fields.name !== undefined) await sql`UPDATE markers SET name = ${fields.name} WHERE id = ${id}`;
  if (fields.type !== undefined) await sql`UPDATE markers SET type = ${fields.type} WHERE id = ${id}`;
  if (fields.allegianceSlug !== undefined) await sql`UPDATE markers SET allegiance_slug = ${fields.allegianceSlug} WHERE id = ${id}`;
  if (fields.externalUrl !== undefined) await sql`UPDATE markers SET external_url = ${fields.externalUrl} WHERE id = ${id}`;
  if (fields.territoryRadius !== undefined) await sql`UPDATE markers SET territory_radius = ${fields.territoryRadius} WHERE id = ${id}`;
  if (fields.layer !== undefined) await sql`UPDATE markers SET layer = ${fields.layer} WHERE id = ${id}`;

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
    const rows = await sql`
      SELECT connection_id, position, x, y, angle
      FROM markers WHERE id = ${id}
    `;
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
      await sql`
        UPDATE markers
        SET connection_id = ${cidValue},
            position      = ${pos},
            x             = NULL,
            y             = NULL,
            angle         = NULL
        WHERE id = ${id}
      `;
    } else {
      const xv  = fields.x     !== undefined ? fields.x     : cur.x ?? 0;
      const yv  = fields.y     !== undefined ? fields.y     : cur.y ?? 0;
      const ang = fields.angle !== undefined ? fields.angle : cur.angle;
      await sql`
        UPDATE markers
        SET connection_id = NULL,
            position      = NULL,
            x             = ${xv},
            y             = ${yv},
            angle         = ${ang}
        WHERE id = ${id}
      `;
    }
  }
}

export async function deleteMarker(id: number): Promise<void> {
  await sql`DELETE FROM markers WHERE id = ${id}`;
}
