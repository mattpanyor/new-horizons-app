// Authentication for the MCP endpoint.
//
// An MCP request has no session cookie, so it carries a per-user token instead.
// Two ways to present it, because client support varies:
//
//   1. Authorization: Bearer nhmcp_…      preferred
//   2. /api/mcp/server/t/nhmcp_…          for clients whose only config is a URL
//
// The second leaks the secret into server logs, proxy logs and browser history,
// so it exists as a compatibility fallback and is labelled as such in the UI.

import {
  findUserByToken,
  touchLastUsed,
  TOKEN_PREFIX,
  type AuthenticatedToken,
} from "@/lib/db/mcpTokens";

/** Pull a token out of the Authorization header, or the /t/<token> path form. */
export function extractToken(req: Request, slug: string[] = []): string | null {
  const header = req.headers.get("authorization");
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match) return match[1].trim();
  }

  // Path form: […, "t", "<token>"]
  const tIndex = slug.indexOf("t");
  if (tIndex !== -1 && slug.length > tIndex + 1) {
    const candidate = slug[tIndex + 1];
    if (candidate.startsWith(TOKEN_PREFIX)) return candidate;
  }

  return null;
}

/**
 * Resolve a request to its acting user, or null if the token is missing,
 * unknown, or revoked.
 *
 * `last_used_at` is updated as a side effect for auditing. A failure to record
 * it must not fail the request — it is a log line, not a precondition.
 */
export async function authenticateMcpRequest(
  req: Request,
  slug: string[] = []
): Promise<AuthenticatedToken | null> {
  const token = extractToken(req, slug);
  if (!token) return null;

  const auth = await findUserByToken(token);
  if (!auth) return null;

  void touchLastUsed(auth.tokenId).catch(() => {});

  return auth;
}
