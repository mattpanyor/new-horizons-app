import type {
  BodyType,
  LabelPosition,
  SpecialAttribute,
} from "@/lib/mapEnums";
import { execQuery, type Tx } from "@/lib/db/tx";

export interface BodyRow {
  id: number;
  systemId: number;
  bodyId: string;
  name: string;
  type: BodyType;
  biomeSlug: string | null;
  lore: string | null;
  orbitPosition: number;
  orbitDistance: number;
  labelPosition: LabelPosition | null;
  specialAttribute: SpecialAttribute | null;
  allegianceSlug: string | null;
  externalUrl: string | null;
  published: boolean;
}

function rowToBody(row: Record<string, unknown>): BodyRow {
  return {
    id: row.id as number,
    systemId: row.system_id as number,
    bodyId: row.body_id as string,
    name: row.name as string,
    type: row.type as BodyType,
    biomeSlug: (row.biome_slug as string) ?? null,
    lore: (row.lore as string) ?? null,
    orbitPosition: Number(row.orbit_position),
    orbitDistance: Number(row.orbit_distance),
    labelPosition: (row.label_position as LabelPosition) ?? null,
    specialAttribute: (row.special_attribute as SpecialAttribute) ?? null,
    allegianceSlug: (row.allegiance_slug as string) ?? null,
    externalUrl: (row.external_url as string) ?? null,
    published: row.published as boolean,
  };
}

export async function getBodiesBySystem(systemId: number, tx?: Tx): Promise<BodyRow[]> {
  const rows = await execQuery(tx,
    `SELECT id, system_id, body_id, name, type, biome_slug, lore,
            orbit_position, orbit_distance, label_position, special_attribute,
            allegiance_slug, external_url, published
     FROM celestial_bodies WHERE system_id = $1
     ORDER BY orbit_distance, id`,
    [systemId]
  );
  return rows.map(rowToBody);
}

export async function insertBody(b: {
  systemId: number;
  bodyId: string;
  name: string;
  type: BodyType;
  biomeSlug?: string | null;
  lore?: string | null;
  orbitPosition: number;
  orbitDistance: number;
  labelPosition?: LabelPosition | null;
  specialAttribute?: SpecialAttribute | null;
  allegianceSlug?: string | null;
  externalUrl?: string | null;
  published?: boolean;
}, tx?: Tx): Promise<BodyRow> {
  const rows = await execQuery(tx,
    `INSERT INTO celestial_bodies (
       system_id, body_id, name, type, biome_slug, lore,
       orbit_position, orbit_distance, label_position, special_attribute,
       allegiance_slug, external_url, published
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, system_id, body_id, name, type, biome_slug, lore,
               orbit_position, orbit_distance, label_position, special_attribute,
               allegiance_slug, external_url, published`,
    [
      b.systemId, b.bodyId, b.name, b.type, b.biomeSlug ?? null, b.lore ?? null,
      b.orbitPosition, b.orbitDistance, b.labelPosition ?? null, b.specialAttribute ?? null,
      b.allegianceSlug ?? null, b.externalUrl ?? null, b.published ?? true,
    ]
  );
  return rowToBody(rows[0]);
}

export async function updateBody(
  id: number,
  fields: Partial<{
    bodyId: string;
    name: string;
    type: BodyType;
    biomeSlug: string | null;
    lore: string | null;
    orbitPosition: number;
    orbitDistance: number;
    labelPosition: LabelPosition | null;
    specialAttribute: SpecialAttribute | null;
    allegianceSlug: string | null;
    externalUrl: string | null;
    published: boolean;
  }>,
  tx?: Tx
): Promise<void> {
  if (fields.bodyId !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET body_id = $1 WHERE id = $2`, [fields.bodyId, id]);
  if (fields.name !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET name = $1 WHERE id = $2`, [fields.name, id]);
  if (fields.type !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET type = $1 WHERE id = $2`, [fields.type, id]);
  if (fields.biomeSlug !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET biome_slug = $1 WHERE id = $2`, [fields.biomeSlug, id]);
  if (fields.lore !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET lore = $1 WHERE id = $2`, [fields.lore, id]);
  if (fields.orbitPosition !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET orbit_position = $1 WHERE id = $2`, [fields.orbitPosition, id]);
  if (fields.orbitDistance !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET orbit_distance = $1 WHERE id = $2`, [fields.orbitDistance, id]);
  if (fields.labelPosition !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET label_position = $1 WHERE id = $2`, [fields.labelPosition, id]);
  if (fields.specialAttribute !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET special_attribute = $1 WHERE id = $2`, [fields.specialAttribute, id]);
  if (fields.allegianceSlug !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET allegiance_slug = $1 WHERE id = $2`, [fields.allegianceSlug, id]);
  if (fields.externalUrl !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET external_url = $1 WHERE id = $2`, [fields.externalUrl, id]);
  if (fields.published !== undefined) await execQuery(tx, `UPDATE celestial_bodies SET published = $1 WHERE id = $2`, [fields.published, id]);
}

export async function deleteBody(id: number, tx?: Tx): Promise<void> {
  await execQuery(tx, `DELETE FROM celestial_bodies WHERE id = $1`, [id]);
}
