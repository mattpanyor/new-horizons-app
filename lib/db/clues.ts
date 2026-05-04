import { neon } from "@neondatabase/serverless";
import type { Clue } from "@/types/investigation";

const sql = neon(process.env.DATABASE_URL!);

function rowToClue(row: Record<string, unknown>): Clue {
  return {
    id: row.id as number,
    chapter: row.chapter as number,
    text: row.text as string,
    factionSlugs: (row.faction_slugs as string[]) ?? [],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    creatorImageUrl: (row.creator_image_url as string) ?? null,
    creatorColor: (row.creator_color as string) ?? null,
  };
}

export async function getCluesByChapter(chapter: number): Promise<Clue[]> {
  const rows = await sql`
    SELECT
      c.id, c.chapter, c.text, c.faction_slugs, c.created_by, c.created_at,
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
      c.id, c.chapter, c.text, c.faction_slugs, c.created_by, c.created_at,
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
  createdBy: string;
}): Promise<Clue> {
  const rows = await sql`
    INSERT INTO clues (chapter, text, faction_slugs, created_by)
    VALUES (${fields.chapter}, ${fields.text}, ${fields.factionSlugs}, ${fields.createdBy})
    RETURNING id, chapter, text, faction_slugs, created_by, created_at
  `;
  const inserted = rows[0];
  // re-fetch with creator image join (small cost, single row)
  const full = await getClueById(inserted.id as number);
  return full!;
}

export async function updateClue(
  id: number,
  fields: { text?: string; factionSlugs?: string[]; createdBy?: string }
): Promise<Clue | null> {
  // Only touch columns whose values were explicitly passed.
  if (fields.text !== undefined) {
    await sql`UPDATE clues SET text = ${fields.text} WHERE id = ${id}`;
  }
  if (fields.factionSlugs !== undefined) {
    await sql`UPDATE clues SET faction_slugs = ${fields.factionSlugs} WHERE id = ${id}`;
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
