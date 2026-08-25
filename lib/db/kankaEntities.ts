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

/** A group member, resolved from the ids stored in `members`. */
export interface KankaMemberDetail {
  entityId: number;
  name: string;
  /** Membership role. Organisations only — families have no equivalent. */
  role: string | null;
  /** The member's own title, independent of any group. Often a noble rank. */
  title: string | null;
}

/** What the archive holds about one entity, for callers that match by name. */
export interface KankaDossier {
  description: string | null;
  members: KankaMemberDetail[];
}

/**
 * Lowercase name → the entity's description and membership.
 *
 * Sibling of getKankaUrlMap: the same name-matched lookup, for callers whose
 * own identity list is authored in this repo rather than in Kanka.
 *
 * The description is Kanka's raw HTML flattened to text here rather than at the
 * call site, so no caller can accidentally put markup into a React text node
 * and print <p> tags on screen. Inline references resolve against the whole
 * table, which is why every row is read and not only the described ones.
 *
 * Member order is Kanka's own and deliberately not sorted: the GM lists them by
 * standing, so an organisation reads Legate, Tribune, Captain rather than
 * alphabetically. Members naming a row that is not here — a private character
 * the sync skipped — are dropped, since there is nothing to name or link to.
 */
export async function getKankaDossierMap(): Promise<Map<string, KankaDossier>> {
  const rows = await sql`SELECT entity_id, name, title, entry, members FROM kanka_entities`;

  const byId = new Map<number, { name: string; title: string | null }>();
  for (const row of rows) {
    byId.set(row.entity_id as number, {
      name: row.name as string,
      title: (row.title as string) ?? null,
    });
  }

  const names = new Map<number, string>();
  for (const [id, v] of byId) names.set(id, v.name);

  const map = new Map<string, KankaDossier>();
  for (const row of rows) {
    const entry = (row.entry as string | null) ?? "";
    const description = entry.trim() ? kankaEntryToText(entry, names) || null : null;

    const members: KankaMemberDetail[] = [];
    for (const m of ((row.members as KankaMember[] | null) ?? [])) {
      const found = byId.get(m.entityId);
      if (!found) continue;
      members.push({
        entityId: m.entityId,
        name: found.name,
        role: m.role ?? null,
        title: found.title,
      });
    }

    if (description === null && members.length === 0) continue;
    map.set((row.name as string).toLowerCase(), { description, members });
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
