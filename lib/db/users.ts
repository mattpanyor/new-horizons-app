import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL!);

export interface User {
  id: number;
  username: string;
  group: string;
  role: string | null;
  character: string | null;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, password, "group", role, character
    FROM users
    WHERE username = ${username}
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  const valid = await bcrypt.compare(password, row.password as string);
  if (!valid) return null;

  return {
    id: row.id as number,
    username: row.username as string,
    group: row.group as string,
    role: (row.role as string) ?? null,
    character: (row.character as string) ?? null,
  };
}

export async function getUserByUsername(
  username: string
): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, "group", role, character
    FROM users
    WHERE username = ${username}
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as number,
    username: row.username as string,
    group: row.group as string,
    role: (row.role as string) ?? null,
    character: (row.character as string) ?? null,
  };
}
