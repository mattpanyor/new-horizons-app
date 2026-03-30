import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL!);

export interface User {
  id: number;
  username: string;
  group: string;
  role: string | null;
  character: string | null;
  accessLevel: number;
  kankaId: number | null;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, password, "group", role, character, access_level, kanka_id
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
    accessLevel: row.access_level as number,
    kankaId: (row.kanka_id as number) ?? null,
  };
}

export async function getAllUsers(maxAccessLevel?: number): Promise<User[]> {
  const rows = maxAccessLevel !== undefined
    ? await sql`
        SELECT id, username, "group", role, character, access_level, kanka_id
        FROM users
        WHERE access_level <= ${maxAccessLevel}
        ORDER BY id
      `
    : await sql`
        SELECT id, username, "group", role, character, access_level, kanka_id
        FROM users
        ORDER BY id
      `;

  return rows.map((row) => ({
    id: row.id as number,
    username: row.username as string,
    group: row.group as string,
    role: (row.role as string) ?? null,
    character: (row.character as string) ?? null,
    accessLevel: row.access_level as number,
    kankaId: (row.kanka_id as number) ?? null,
  }));
}

export async function updateUser(
  id: number,
  fields: { username: string; group: string; role: string | null; character: string | null; accessLevel: number; kankaId: number | null }
): Promise<User | null> {
  const rows = await sql`
    UPDATE users SET
      username     = ${fields.username},
      "group"      = ${fields.group},
      role         = ${fields.role},
      character    = ${fields.character},
      access_level = ${fields.accessLevel},
      kanka_id     = ${fields.kankaId}
    WHERE id = ${id}
    RETURNING id, username, "group", role, character, access_level, kanka_id
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as number,
    username: row.username as string,
    group: row.group as string,
    role: (row.role as string) ?? null,
    character: (row.character as string) ?? null,
    accessLevel: row.access_level as number,
    kankaId: (row.kanka_id as number) ?? null,
  };
}

export async function deleteUser(id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function resetPassword(id: number, newPassword: string): Promise<boolean> {
  const hash = await bcrypt.hash(newPassword, 10);
  const rows = await sql`UPDATE users SET password = ${hash} WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function createUser(fields: {
  username: string;
  password: string;
  group: string;
  role: string | null;
  character: string | null;
  accessLevel: number;
  kankaId: number | null;
}): Promise<User> {
  const hash = await bcrypt.hash(fields.password, 10);
  const rows = await sql`
    INSERT INTO users (username, password, "group", role, character, access_level, kanka_id)
    VALUES (${fields.username}, ${hash}, ${fields.group}, ${fields.role}, ${fields.character}, ${fields.accessLevel}, ${fields.kankaId})
    RETURNING id, username, "group", role, character, access_level, kanka_id
  `;

  const row = rows[0];
  return {
    id: row.id as number,
    username: row.username as string,
    group: row.group as string,
    role: (row.role as string) ?? null,
    character: (row.character as string) ?? null,
    accessLevel: row.access_level as number,
    kankaId: (row.kanka_id as number) ?? null,
  };
}

export async function getUserByUsername(
  username: string
): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, "group", role, character, access_level, kanka_id
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
    accessLevel: row.access_level as number,
    kankaId: (row.kanka_id as number) ?? null,
  };
}
