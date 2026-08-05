import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";
import type { User } from "@/lib/db/users";

const sql = neon(process.env.DATABASE_URL!);

export const TOKEN_PREFIX = "nhmcp_";

export interface McpToken {
  id: number;
  username: string;
  label: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function rowToToken(row: Record<string, unknown>): McpToken {
  return {
    id: row.id as number,
    username: row.username as string,
    label: row.label as string,
    scopes: (row.scopes as string[]) ?? [],
    createdAt: row.created_at as string,
    lastUsedAt: (row.last_used_at as string) ?? null,
    revokedAt: (row.revoked_at as string) ?? null,
  };
}

// SHA-256 rather than bcrypt: these are 256-bit random strings, not
// human-chosen passwords, so there is no dictionary to slow down — and the
// hash is computed on every MCP tool call, where bcrypt's ~100ms would be a
// tax on each one.
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** A new token. The plaintext is returned once here and never stored. */
export function generateToken(): { plaintext: string; hash: string } {
  const plaintext = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { plaintext, hash: hashToken(plaintext) };
}

export async function createMcpToken(fields: {
  username: string;
  label: string;
  scopes: string[];
}): Promise<{ token: McpToken; plaintext: string }> {
  const { plaintext, hash } = generateToken();
  const rows = await sql`
    INSERT INTO mcp_tokens (username, token_hash, label, scopes)
    VALUES (${fields.username}, ${hash}, ${fields.label}, ${fields.scopes})
    RETURNING id, username, label, scopes, created_at, last_used_at, revoked_at
  `;
  return { token: rowToToken(rows[0]), plaintext };
}

export async function listTokensForUser(username: string): Promise<McpToken[]> {
  const rows = await sql`
    SELECT id, username, label, scopes, created_at, last_used_at, revoked_at
    FROM mcp_tokens
    WHERE username = ${username}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToToken);
}

// Scoped to the owner so one user can never revoke another's token, even by
// guessing an id.
export async function revokeToken(id: number, username: string): Promise<boolean> {
  const rows = await sql`
    UPDATE mcp_tokens
    SET revoked_at = NOW()
    WHERE id = ${id} AND username = ${username} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export interface AuthenticatedToken {
  user: User;
  tokenId: number;
  scopes: string[];
}

/**
 * Resolve a plaintext token to its owner. Returns null for unknown or revoked
 * tokens, and for tokens whose user row has since been deleted.
 */
export async function findUserByToken(plaintext: string): Promise<AuthenticatedToken | null> {
  if (!plaintext.startsWith(TOKEN_PREFIX)) return null;

  const rows = await sql`
    SELECT
      t.id AS token_id, t.scopes,
      u.id, u.username, u."group", u.role, u.character,
      u.access_level, u.image_url, u.color
    FROM mcp_tokens t
    JOIN users u ON u.username = t.username
    WHERE t.token_hash = ${hashToken(plaintext)}
      AND t.revoked_at IS NULL
  `;
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    tokenId: row.token_id as number,
    scopes: (row.scopes as string[]) ?? [],
    user: {
      id: row.id as number,
      username: row.username as string,
      group: row.group as string,
      role: (row.role as string) ?? null,
      character: (row.character as string) ?? null,
      accessLevel: row.access_level as number,
      imageUrl: (row.image_url as string) ?? null,
      color: (row.color as string) ?? null,
    },
  };
}

/** Fire-and-forget audit trail; never block a tool call on this. */
export async function touchLastUsed(tokenId: number): Promise<void> {
  await sql`UPDATE mcp_tokens SET last_used_at = NOW() WHERE id = ${tokenId}`;
}
