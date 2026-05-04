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
  imageUrl: string | null;
  color: string | null;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    username: row.username as string,
    group: row.group as string,
    role: (row.role as string) ?? null,
    character: (row.character as string) ?? null,
    accessLevel: row.access_level as number,
    imageUrl: (row.image_url as string) ?? null,
    color: (row.color as string) ?? null,
  };
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, password, "group", role, character, access_level, image_url, color
    FROM users
    WHERE username = ${username}
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  const valid = await bcrypt.compare(password, row.password as string);
  if (!valid) return null;

  return rowToUser(row);
}

export async function getAllUsers(maxAccessLevel?: number): Promise<User[]> {
  const rows = maxAccessLevel !== undefined
    ? await sql`
        SELECT id, username, "group", role, character, access_level, image_url, color
        FROM users
        WHERE access_level <= ${maxAccessLevel}
        ORDER BY id
      `
    : await sql`
        SELECT id, username, "group", role, character, access_level, image_url, color
        FROM users
        ORDER BY id
      `;

  return rows.map(rowToUser);
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, "group", role, character, access_level, image_url, color
    FROM users
    WHERE id = ${id}
  `;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

/**
 * Updates only the columns whose values are explicitly provided. A field
 * absent from `fields` is left untouched; passing `null` for a nullable field
 * (role, character, imageUrl, color) explicitly clears it.
 *
 * This is the "only-touch-passed-fields" rule: callers can never silently
 * wipe a column by forgetting to round-trip it.
 */
export async function updateUser(
  id: number,
  fields: Partial<{
    username: string;
    group: string;
    role: string | null;
    character: string | null;
    accessLevel: number;
    imageUrl: string | null;
    color: string | null;
  }>
): Promise<User | null> {
  if (fields.username !== undefined) {
    await sql`UPDATE users SET username = ${fields.username} WHERE id = ${id}`;
  }
  if (fields.group !== undefined) {
    await sql`UPDATE users SET "group" = ${fields.group} WHERE id = ${id}`;
  }
  if (fields.role !== undefined) {
    await sql`UPDATE users SET role = ${fields.role} WHERE id = ${id}`;
  }
  if (fields.character !== undefined) {
    await sql`UPDATE users SET character = ${fields.character} WHERE id = ${id}`;
  }
  if (fields.accessLevel !== undefined) {
    await sql`UPDATE users SET access_level = ${fields.accessLevel} WHERE id = ${id}`;
  }
  if (fields.imageUrl !== undefined) {
    await sql`UPDATE users SET image_url = ${fields.imageUrl} WHERE id = ${id}`;
  }
  if (fields.color !== undefined) {
    await sql`UPDATE users SET color = ${fields.color} WHERE id = ${id}`;
  }
  return getUserById(id);
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
  imageUrl?: string | null;
  color?: string | null;
}): Promise<User> {
  const hash = await bcrypt.hash(fields.password, 10);
  const rows = await sql`
    INSERT INTO users (username, password, "group", role, character, access_level, image_url, color)
    VALUES (${fields.username}, ${hash}, ${fields.group}, ${fields.role}, ${fields.character}, ${fields.accessLevel}, ${fields.imageUrl ?? null}, ${fields.color ?? null})
    RETURNING id, username, "group", role, character, access_level, image_url, color
  `;

  return rowToUser(rows[0]);
}

export async function getUserByUsername(
  username: string
): Promise<User | null> {
  const rows = await sql`
    SELECT id, username, "group", role, character, access_level, image_url, color
    FROM users
    WHERE username = ${username}
  `;

  if (rows.length === 0) return null;
  return rowToUser(rows[0]);
}
