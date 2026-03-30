import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface KankaEntityRow {
  id: number;
  entityId: number;
  name: string;
  type: string;
  imageUrl: string | null;
  title: string | null;
}

export async function getAllKankaEntities(): Promise<KankaEntityRow[]> {
  const rows = await sql`
    SELECT id, entity_id, name, type, image_url, title
    FROM kanka_entities
    ORDER BY name
  `;

  return rows.map((row) => ({
    id: row.id as number,
    entityId: row.entity_id as number,
    name: row.name as string,
    type: row.type as string,
    imageUrl: (row.image_url as string) ?? null,
    title: (row.title as string) ?? null,
  }));
}

export async function getKankaEntityByEntityId(entityId: number): Promise<KankaEntityRow | null> {
  const rows = await sql`
    SELECT id, entity_id, name, type, image_url, title
    FROM kanka_entities
    WHERE entity_id = ${entityId}
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as number,
    entityId: row.entity_id as number,
    name: row.name as string,
    type: row.type as string,
    imageUrl: (row.image_url as string) ?? null,
    title: (row.title as string) ?? null,
  };
}

const KANKA_CAMPAIGN_ID = "96303";

/** Returns a lowercase name → Kanka URL map for all entities in the DB */
export async function getKankaUrlMap(): Promise<Map<string, string>> {
  const rows = await sql`
    SELECT entity_id, name FROM kanka_entities
  `;

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(
      (row.name as string).toLowerCase(),
      `https://app.kanka.io/w/${KANKA_CAMPAIGN_ID}/entities/${row.entity_id}`,
    );
  }
  return map;
}

export async function upsertKankaEntity(fields: {
  entityId: number;
  name: string;
  type: string;
  imageUrl: string | null;
  title: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO kanka_entities (entity_id, name, type, image_url, title, updated_at)
    VALUES (${fields.entityId}, ${fields.name}, ${fields.type}, ${fields.imageUrl}, ${fields.title}, NOW())
    ON CONFLICT (entity_id) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      image_url = EXCLUDED.image_url,
      title = EXCLUDED.title,
      updated_at = NOW()
  `;
}
