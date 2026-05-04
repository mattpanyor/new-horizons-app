import { neon } from "@neondatabase/serverless";
import type { Chapter } from "@/types/investigation";

const sql = neon(process.env.DATABASE_URL!);

function rowToChapter(row: Record<string, unknown>): Chapter {
  return {
    number: row.number as number,
    title: row.title as string,
  };
}

export async function getAllChapters(): Promise<Chapter[]> {
  const rows = await sql`SELECT number, title FROM chapters ORDER BY number ASC`;
  return rows.map(rowToChapter);
}

export async function getChapter(number: number): Promise<Chapter | null> {
  const rows = await sql`SELECT number, title FROM chapters WHERE number = ${number}`;
  return rows.length > 0 ? rowToChapter(rows[0]) : null;
}

export async function getCurrentChapter(): Promise<Chapter | null> {
  const rows = await sql`SELECT number, title FROM chapters ORDER BY number DESC LIMIT 1`;
  return rows.length > 0 ? rowToChapter(rows[0]) : null;
}

export async function createChapter(title: string): Promise<Chapter> {
  const rows = await sql`
    INSERT INTO chapters (number, title)
    VALUES (
      COALESCE((SELECT MAX(number) + 1 FROM chapters), 1),
      ${title}
    )
    RETURNING number, title
  `;
  return rowToChapter(rows[0]);
}

export async function renameChapter(number: number, title: string): Promise<Chapter | null> {
  const rows = await sql`
    UPDATE chapters SET title = ${title} WHERE number = ${number}
    RETURNING number, title
  `;
  return rows.length > 0 ? rowToChapter(rows[0]) : null;
}

export async function deleteChapter(number: number): Promise<boolean> {
  const rows = await sql`DELETE FROM chapters WHERE number = ${number} RETURNING number`;
  return rows.length > 0;
}

export async function getClueCountByChapter(): Promise<Record<number, number>> {
  const rows = await sql`SELECT chapter, COUNT(*)::int AS count FROM clues GROUP BY chapter`;
  const out: Record<number, number> = {};
  for (const row of rows) {
    out[row.chapter as number] = row.count as number;
  }
  return out;
}
