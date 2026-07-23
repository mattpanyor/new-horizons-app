import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";
import type { StoryEntry, StoryVisibility } from "@/types/story";

const sql = neon(process.env.DATABASE_URL!);

function rowToEntry(row: Record<string, unknown>): StoryEntry {
  return {
    id: row.id as number,
    uid: row.uid as string,
    chapter: row.chapter as number,
    chapterTitle: (row.chapter_title as string) ?? null,
    sessionNumber: (row.session_number as number) ?? null,
    title: row.title as string,
    body: (row.body as string) ?? "",
    visibility: row.visibility as StoryVisibility,
    assignedUsernames: (row.assigned_usernames as string[]) ?? [],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const SELECT = `
  SELECT
    s.id, s.uid, s.chapter, s.session_number, s.title, s.body,
    s.visibility, s.assigned_usernames, s.created_by, s.created_at, s.updated_at,
    c.title AS chapter_title
  FROM story_entries s
  LEFT JOIN chapters c ON c.number = s.chapter
`;

export async function getAllStoryEntries(): Promise<StoryEntry[]> {
  const rows = await sql.query(`${SELECT} ORDER BY s.chapter ASC, s.created_at DESC`);
  return rows.map(rowToEntry);
}

export async function getStoryEntryByUid(uid: string): Promise<StoryEntry | null> {
  const rows = await sql.query(`${SELECT} WHERE s.uid = $1`, [uid]);
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export async function getStoryEntryById(id: number): Promise<StoryEntry | null> {
  const rows = await sql.query(`${SELECT} WHERE s.id = $1`, [id]);
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export async function createStoryEntry(fields: {
  chapter: number;
  title: string;
  body: string;
  sessionNumber: number | null;
  visibility: StoryVisibility;
  assignedUsernames: string[];
  createdBy: string;
}): Promise<StoryEntry> {
  const uid = randomUUID();
  // Single round-trip (INSERT + SELECT-with-join in one CTE) so the created row
  // is always returned — a separate follow-up SELECT could miss it under lag.
  const rows = await sql.query(
    `WITH inserted AS (
       INSERT INTO story_entries
         (uid, chapter, session_number, title, body, visibility, assigned_usernames, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, uid, chapter, session_number, title, body,
                 visibility, assigned_usernames, created_by, created_at, updated_at
     )
     SELECT
       s.id, s.uid, s.chapter, s.session_number, s.title, s.body,
       s.visibility, s.assigned_usernames, s.created_by, s.created_at, s.updated_at,
       c.title AS chapter_title
     FROM inserted s
     LEFT JOIN chapters c ON c.number = s.chapter`,
    [
      uid,
      fields.chapter,
      fields.sessionNumber,
      fields.title,
      fields.body,
      fields.visibility,
      fields.assignedUsernames,
      fields.createdBy,
    ]
  );
  return rowToEntry(rows[0]);
}

export async function updateStoryEntry(
  id: number,
  fields: {
    chapter?: number;
    title?: string;
    body?: string;
    sessionNumber?: number | null;
    visibility?: StoryVisibility;
    assignedUsernames?: string[];
  }
): Promise<StoryEntry | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const push = (col: string, val: unknown) => {
    sets.push(`${col} = $${i++}`);
    values.push(val);
  };

  if (fields.chapter !== undefined) push("chapter", fields.chapter);
  if (fields.title !== undefined) push("title", fields.title);
  if (fields.body !== undefined) push("body", fields.body);
  if (fields.sessionNumber !== undefined) push("session_number", fields.sessionNumber);
  if (fields.visibility !== undefined) push("visibility", fields.visibility);
  if (fields.assignedUsernames !== undefined) push("assigned_usernames", fields.assignedUsernames);

  if (sets.length === 0) return getStoryEntryById(id);

  sets.push(`updated_at = NOW()`);
  values.push(id);
  await sql.query(
    `UPDATE story_entries SET ${sets.join(", ")} WHERE id = $${i}`,
    values
  );
  return getStoryEntryById(id);
}

export async function deleteStoryEntry(id: number): Promise<boolean> {
  const rows = await sql.query(`DELETE FROM story_entries WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}
