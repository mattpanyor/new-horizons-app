// Reversible encryption for MCP tokens.
//
// Tokens are issued by an admin and handed to a player, so the admin panel has
// to be able to show one again later — which a one-way hash cannot do. They are
// therefore stored twice:
//
//   token_hash      SHA-256, indexed, used to authenticate an incoming request
//   token_encrypted AES-256-GCM, used only to reveal the token in /admin/mcp
//
// Keeping both means the hot path (every tool call) is still an indexed lookup
// on a fast hash, and the decrypt key is only ever touched by the admin panel.
//
// The trade-off this makes explicit: a leaked database alone is no longer
// enough. An attacker needs the ciphertext *and* MCP_TOKEN_SECRET, which lives
// in the environment rather than the database.
//
// GCM is authenticated, so a tampered ciphertext fails to decrypt rather than
// silently returning garbage.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16;

export class TokenSecretMissingError extends Error {
  constructor() {
    super(
      "MCP_TOKEN_SECRET is not set. It is required to issue or reveal MCP tokens. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
    this.name = "TokenSecretMissingError";
  }
}

export function isTokenSecretConfigured(): boolean {
  return Boolean(process.env.MCP_TOKEN_SECRET);
}

// Hashed rather than used raw so any length of secret yields a valid 32-byte
// key — the env var can be a passphrase or base64, both work.
function encryptionKey(): Buffer {
  const secret = process.env.MCP_TOKEN_SECRET;
  if (!secret) throw new TokenSecretMissingError();
  return createHash("sha256").update(secret).digest();
}

/** Returns base64 of iv || authTag || ciphertext. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

/**
 * Reverses encryptToken. Returns null rather than throwing when the payload
 * cannot be read — the usual cause is a rotated MCP_TOKEN_SECRET, and one
 * unreadable row should not break the whole admin panel.
 */
export function decryptToken(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, "base64");
    if (buf.length <= IV_LENGTH + TAG_LENGTH) return null;

    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
