import { neon } from "@neondatabase/serverless";
import type { Clue } from "@/types/investigation";

const sql = neon(process.env.DATABASE_URL!);

function rowToClue(row: Record<string, unknown>): Clue {
  return {
    id: row.id as number,
    chapter: row.chapter as number,
    text: row.text as string,
    factionSlugs: (row.faction_slugs as string[]) ?? [],
    sessionNumber: (row.session_number as number) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    creatorImageUrl: (row.creator_image_url as string) ?? null,
    creatorColor: (row.creator_color as string) ?? null,
  };
}

// Shared projection for the composed query in searchClues. The tagged-template
// helpers below inline the same columns; this form exists because sql.query()
// is the only interface that takes a dynamically built WHERE clause.
const SELECT = `
  SELECT
    c.id, c.chapter, c.text, c.faction_slugs, c.session_number, c.created_by, c.created_at,
    u.image_url AS creator_image_url,
    u.color     AS creator_color
  FROM clues c
  LEFT JOIN users u ON u.username = c.created_by
`;

export interface ClueFilters {
  chapter?: number;
  session?: number;
  faction?: string;
  author?: string;
  query?: string;
  limit?: number;
}

// `%` and `_` are ILIKE wildcards — a user searching for "50%" means the
// literal characters, so escape them (Postgres LIKE uses backslash by default).
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export const CLUE_SEARCH_DEFAULT_LIMIT = 50;
export const CLUE_SEARCH_MAX_LIMIT = 200;

// Filtered clue search across chapters. Every filter is optional and they
// combine with AND. Used by the MCP tools, where the caller may want "every
// clue mentioning the cultists" rather than one chapter's worth.
export async function searchClues(filters: ClueFilters = {}): Promise<Clue[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.chapter !== undefined) {
    params.push(filters.chapter);
    where.push(`c.chapter = $${params.length}`);
  }
  if (filters.session !== undefined) {
    params.push(filters.session);
    where.push(`c.session_number = $${params.length}`);
  }
  if (filters.author !== undefined) {
    params.push(filters.author);
    where.push(`c.created_by = $${params.length}`);
  }
  if (filters.faction !== undefined) {
    params.push(filters.faction);
    where.push(`$${params.length} = ANY(c.faction_slugs)`);
  }
  if (filters.query !== undefined && filters.query.trim() !== "") {
    params.push(`%${escapeLike(filters.query.trim())}%`);
    where.push(`c.text ILIKE $${params.length}`);
  }

  const limit = Math.min(
    Math.max(filters.limit ?? CLUE_SEARCH_DEFAULT_LIMIT, 1),
    CLUE_SEARCH_MAX_LIMIT
  );
  params.push(limit);

  const rows = await sql.query(
    `${SELECT}
     ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY c.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(rowToClue);
}

export async function getCluesByChapter(chapter: number): Promise<Clue[]> {
  const rows = await sql`
    SELECT
      c.id, c.chapter, c.text, c.faction_slugs, c.session_number, c.created_by, c.created_at,
      u.image_url AS creator_image_url,
      u.color     AS creator_color
    FROM clues c
    LEFT JOIN users u ON u.username = c.created_by
    WHERE c.chapter = ${chapter}
    ORDER BY c.created_at DESC
  `;
  return rows.map(rowToClue);
}

export async function getClueById(id: number): Promise<Clue | null> {
  const rows = await sql`
    SELECT
      c.id, c.chapter, c.text, c.faction_slugs, c.session_number, c.created_by, c.created_at,
      u.image_url AS creator_image_url,
      u.color     AS creator_color
    FROM clues c
    LEFT JOIN users u ON u.username = c.created_by
    WHERE c.id = ${id}
  `;
  return rows.length > 0 ? rowToClue(rows[0]) : null;
}

export async function createClue(fields: {
  chapter: number;
  text: string;
  factionSlugs: string[];
  sessionNumber: number | null;
  createdBy: string;
}): Promise<Clue> {
  // Single round-trip: INSERT then SELECT with the users join in one CTE.
  const rows = await sql`
    WITH inserted AS (
      INSERT INTO clues (chapter, text, faction_slugs, session_number, created_by)
      VALUES (${fields.chapter}, ${fields.text}, ${fields.factionSlugs}, ${fields.sessionNumber}, ${fields.createdBy})
      RETURNING id, chapter, text, faction_slugs, session_number, created_by, created_at
    )
    SELECT
      i.id, i.chapter, i.text, i.faction_slugs, i.session_number, i.created_by, i.created_at,
      u.image_url AS creator_image_url,
      u.color     AS creator_color
    FROM inserted i
    LEFT JOIN users u ON u.username = i.created_by
  `;
  return rowToClue(rows[0]);
}

export async function updateClue(
  id: number,
  fields: {
    text?: string;
    factionSlugs?: string[];
    sessionNumber?: number | null;
    createdBy?: string;
  }
): Promise<Clue | null> {
  // Only touch columns whose values were explicitly passed.
  if (fields.text !== undefined) {
    await sql`UPDATE clues SET text = ${fields.text} WHERE id = ${id}`;
  }
  if (fields.factionSlugs !== undefined) {
    await sql`UPDATE clues SET faction_slugs = ${fields.factionSlugs} WHERE id = ${id}`;
  }
  // Explicit null is meaningful here — it clears the session number.
  if (fields.sessionNumber !== undefined) {
    await sql`UPDATE clues SET session_number = ${fields.sessionNumber} WHERE id = ${id}`;
  }
  if (fields.createdBy !== undefined) {
    await sql`UPDATE clues SET created_by = ${fields.createdBy} WHERE id = ${id}`;
  }
  return getClueById(id);
}

export async function deleteClue(id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM clues WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function getClueCountByUser(): Promise<Record<string, number>> {
  const rows = await sql`
    SELECT created_by, COUNT(*)::int AS count
    FROM clues
    GROUP BY created_by
  `;
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.created_by as string] = row.count as number;
  }
  return out;
}
