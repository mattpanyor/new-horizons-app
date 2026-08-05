import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";
import type { User } from "@/lib/db/users";
import { decryptToken, encryptToken } from "@/lib/mcp/crypto";

const sql = neon(process.env.DATABASE_URL!);

export const TOKEN_PREFIX = "nhmcp_";

export interface McpToken {
  id: number;
  username: string;
  label: string;
  scopes: string[];
  issuedBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** A token with its plaintext recovered, for the admin panel only. */
export interface McpTokenRevealed extends McpToken {
  /** null when MCP_TOKEN_SECRET is unset or has been rotated since issuance. */
  plaintext: string | null;
}

function rowToToken(row: Record<string, unknown>): McpToken {
  return {
    id: row.id as number,
    username: row.username as string,
    label: row.label as string,
    scopes: (row.scopes as string[]) ?? [],
    issuedBy: (row.issued_by as string) ?? null,
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

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/**
 * Issue a token for `username`, recorded as issued by `issuedBy`.
 *
 * Callers are responsible for the authorisation check — see the privilege rule
 * in app/api/admin/mcp/tokens/route.ts. Throws TokenSecretMissingError if
 * MCP_TOKEN_SECRET is unset, since a token that cannot be encrypted could never
 * be shown to the admin again.
 */
export async function createMcpToken(fields: {
  username: string;
  label: string;
  scopes: string[];
  issuedBy: string;
}): Promise<{ token: McpToken; plaintext: string }> {
  const plaintext = generateToken();
  const rows = await sql`
    INSERT INTO mcp_tokens (username, token_hash, token_encrypted, label, scopes, issued_by)
    VALUES (
      ${fields.username},
      ${hashToken(plaintext)},
      ${encryptToken(plaintext)},
      ${fields.label},
      ${fields.scopes},
      ${fields.issuedBy}
    )
    RETURNING id, username, label, scopes, issued_by, created_at, last_used_at, revoked_at
  `;
  return { token: rowToToken(rows[0]), plaintext };
}

/** Every token, with plaintext recovered. Admin panel only — never expose to players. */
export async function listAllTokensRevealed(): Promise<McpTokenRevealed[]> {
  const rows = await sql`
    SELECT id, username, label, scopes, issued_by, created_at, last_used_at, revoked_at,
           token_encrypted
    FROM mcp_tokens
    ORDER BY revoked_at NULLS FIRST, created_at DESC
  `;
  return rows.map((row) => {
    const encrypted = (row.token_encrypted as string) ?? null;
    return {
      ...rowToToken(row),
      plaintext: encrypted ? decryptToken(encrypted) : null,
    };
  });
}

export async function revokeToken(id: number): Promise<boolean> {
  const rows = await sql`
    UPDATE mcp_tokens
    SET revoked_at = NOW()
    WHERE id = ${id} AND revoked_at IS NULL
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
 *
 * Deliberately uses the hash, not the encrypted column: this runs on every tool
 * call and must stay an indexed lookup that never touches the encryption key.
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
