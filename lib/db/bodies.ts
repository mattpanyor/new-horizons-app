import { neon } from "@neondatabase/serverless";
import type {
  BodyType,
  LabelPosition,
  SpecialAttribute,
} from "@/lib/mapEnums";

const sql = neon(process.env.DATABASE_URL!);

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

export async function getBodiesBySystem(systemId: number): Promise<BodyRow[]> {
  const rows = await sql`
    SELECT id, system_id, body_id, name, type, biome_slug, lore,
           orbit_position, orbit_distance, label_position, special_attribute,
           allegiance_slug, external_url, published
    FROM celestial_bodies WHERE system_id = ${systemId}
    ORDER BY orbit_distance, id
  `;
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
}): Promise<BodyRow> {
  const rows = await sql`
    INSERT INTO celestial_bodies (
      system_id, body_id, name, type, biome_slug, lore,
      orbit_position, orbit_distance, label_position, special_attribute,
      allegiance_slug, external_url, published
    ) VALUES (
      ${b.systemId}, ${b.bodyId}, ${b.name}, ${b.type}, ${b.biomeSlug ?? null}, ${b.lore ?? null},
      ${b.orbitPosition}, ${b.orbitDistance}, ${b.labelPosition ?? null}, ${b.specialAttribute ?? null},
      ${b.allegianceSlug ?? null}, ${b.externalUrl ?? null}, ${b.published ?? true}
    )
    RETURNING id, system_id, body_id, name, type, biome_slug, lore,
              orbit_position, orbit_distance, label_position, special_attribute,
              allegiance_slug, external_url, published
  `;
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
  }>
): Promise<void> {
  if (fields.bodyId !== undefined) await sql`UPDATE celestial_bodies SET body_id = ${fields.bodyId} WHERE id = ${id}`;
  if (fields.name !== undefined) await sql`UPDATE celestial_bodies SET name = ${fields.name} WHERE id = ${id}`;
  if (fields.type !== undefined) await sql`UPDATE celestial_bodies SET type = ${fields.type} WHERE id = ${id}`;
  if (fields.biomeSlug !== undefined) await sql`UPDATE celestial_bodies SET biome_slug = ${fields.biomeSlug} WHERE id = ${id}`;
  if (fields.lore !== undefined) await sql`UPDATE celestial_bodies SET lore = ${fields.lore} WHERE id = ${id}`;
  if (fields.orbitPosition !== undefined) await sql`UPDATE celestial_bodies SET orbit_position = ${fields.orbitPosition} WHERE id = ${id}`;
  if (fields.orbitDistance !== undefined) await sql`UPDATE celestial_bodies SET orbit_distance = ${fields.orbitDistance} WHERE id = ${id}`;
  if (fields.labelPosition !== undefined) await sql`UPDATE celestial_bodies SET label_position = ${fields.labelPosition} WHERE id = ${id}`;
  if (fields.specialAttribute !== undefined) await sql`UPDATE celestial_bodies SET special_attribute = ${fields.specialAttribute} WHERE id = ${id}`;
  if (fields.allegianceSlug !== undefined) await sql`UPDATE celestial_bodies SET allegiance_slug = ${fields.allegianceSlug} WHERE id = ${id}`;
  if (fields.externalUrl !== undefined) await sql`UPDATE celestial_bodies SET external_url = ${fields.externalUrl} WHERE id = ${id}`;
  if (fields.published !== undefined) await sql`UPDATE celestial_bodies SET published = ${fields.published} WHERE id = ${id}`;
}

export async function deleteBody(id: number): Promise<void> {
  await sql`DELETE FROM celestial_bodies WHERE id = ${id}`;
}
