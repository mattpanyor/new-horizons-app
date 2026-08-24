import { neon } from "@neondatabase/serverless";
import { kankaEntityUrl, kankaEntryToText } from "@/lib/kanka";

const sql = neon(process.env.DATABASE_URL!);

export interface KankaEntityRow {
  id: number;
  entityId: number;
  name: string;
  type: string;
  imageUrl: string | null;
  title: string | null;
  /** Kanka's description, raw HTML. See the note on rendering below. */
  entry: string | null;
  /**
   * Who belongs to this group. Populated for organisations and families,
   * null for kinds that cannot have members. `role` is Kanka's free-text
   * title and only organisations carry one.
   */
  members: KankaMember[] | null;
  /**
   * Immediate location(s) as entity_ids. Populated for characters only; null
   * elsewhere. An array because Kanka models it as one, though in practice a
   * character has at most one.
   */
  locations: number[] | null;
}

export interface KankaMember {
  entityId: number;
  role?: string;
}

export async function getAllKankaEntities(): Promise<KankaEntityRow[]> {
  const rows = await sql`
    SELECT id, entity_id, name, type, image_url, title, entry, members, locations
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
    entry: (row.entry as string) ?? null,
    members: (row.members as KankaMember[]) ?? null,
    locations: (row.locations as number[]) ?? null,
  }));
}

export async function getKankaEntityByEntityId(entityId: number): Promise<KankaEntityRow | null> {
  const rows = await sql`
    SELECT id, entity_id, name, type, image_url, title, entry, members, locations
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
    entry: (row.entry as string) ?? null,
    members: (row.members as KankaMember[]) ?? null,
    locations: (row.locations as number[]) ?? null,
  };
}

/** Returns a lowercase name → Kanka URL map for all entities in the DB */
export async function getKankaUrlMap(): Promise<Map<string, string>> {
  const rows = await sql`
    SELECT entity_id, name FROM kanka_entities
  `;

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(
      (row.name as string).toLowerCase(),
      kankaEntityUrl(row.entity_id as number),
    );
  }
  return map;
}

/**
 * Lowercase name → description as PLAIN TEXT, for the entities that have one.
 *
 * Sibling of getKankaUrlMap: the same name-matched lookup, for callers whose
 * own identity list is authored in this repo rather than in Kanka. Entities
 * with an empty entry are left out so a caller can treat "absent" as "no
 * description" without also testing for blank.
 *
 * The stored entry is Kanka's raw HTML and is flattened here rather than at the
 * call site, so no caller can accidentally put markup into a React text node
 * and print <p> tags on screen. Reading the whole table rather than only the
 * rows with an entry is deliberate: inline references name other entities, and
 * resolving them needs every id, not just the described ones.
 */
export async function getKankaDescriptionMap(): Promise<Map<string, string>> {
  const rows = await sql`SELECT entity_id, name, entry FROM kanka_entities`;

  const names = new Map<number, string>();
  for (const row of rows) names.set(row.entity_id as number, row.name as string);

  const map = new Map<string, string>();
  for (const row of rows) {
    const entry = (row.entry as string | null) ?? "";
    if (!entry.trim()) continue;
    const text = kankaEntryToText(entry, names);
    if (text) map.set((row.name as string).toLowerCase(), text);
  }
  return map;
}

// Every column here is Kanka-owned and blindly overwritten on each sync: the
// upsert assigns from EXCLUDED unconditionally, it does not diff. A column left
// out of the DO UPDATE list would be written once on insert and then silently
// go stale forever, so anything added to the INSERT must be added to both.
//
// The corollary is that this table cannot hold locally-authored data. Anything
// this app owns about an entity belongs in its own table keyed on entity_id.
export async function upsertKankaEntity(fields: {
  entityId: number;
  name: string;
  type: string;
  imageUrl: string | null;
  title: string | null;
  entry: string | null;
  members: KankaMember[] | null;
  locations: number[] | null;
}): Promise<void> {
  await sql`
    INSERT INTO kanka_entities
      (entity_id, name, type, image_url, title, entry, members, locations, updated_at)
    VALUES (${fields.entityId}, ${fields.name}, ${fields.type}, ${fields.imageUrl}, ${fields.title},
            ${fields.entry},
            ${fields.members === null ? null : JSON.stringify(fields.members)}::jsonb,
            ${fields.locations}::int[], NOW())
    ON CONFLICT (entity_id) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      image_url = EXCLUDED.image_url,
      title = EXCLUDED.title,
      entry = EXCLUDED.entry,
      members = EXCLUDED.members,
      locations = EXCLUDED.locations,
      updated_at = NOW()
  `;
}
