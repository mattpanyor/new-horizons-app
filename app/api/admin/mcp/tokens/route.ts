// Admin-issued MCP tokens.
//
// An admin mints a token on a user's behalf and sends them the resulting URL.
// The response therefore includes the plaintext, and GET reveals every token —
// which is exactly why this endpoint is gated at accessLevel >= 66 and why the
// self-serve equivalent no longer exists.

import { NextRequest, NextResponse } from "next/server";
import { requireAccessLevel } from "@/lib/auth";
import { getUserByUsername } from "@/lib/db/users";
import {
  createMcpToken,
  getTokenById,
  listAllTokensRevealed,
  revokeToken,
  updateTokenScopes,
} from "@/lib/db/mcpTokens";
import { isKnownScope } from "@/lib/mcp/registry";
import { isTokenSecretConfigured } from "@/lib/mcp/crypto";
import { ACCESS } from "@/lib/investigation/service";

const MAX_LABEL = 60;

/**
 * Validates a scope list, returning the deduped set or an error message.
 *
 * Shared by issuing and editing so the two cannot drift — a scope rejected at
 * mint time must not be settable afterwards.
 */
function parseScopes(input: unknown): { ok: true; scopes: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "Select at least one scope" };
  }
  const unique = Array.from(new Set(input));
  for (const scope of unique) {
    if (typeof scope !== "string" || !isKnownScope(scope)) {
      return { ok: false, error: `Unknown scope: ${String(scope)}` };
    }
  }
  return { ok: true, scopes: unique as string[] };
}

export async function GET() {
  const admin = await requireAccessLevel(ACCESS.ADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tokens = await listAllTokensRevealed();
  return NextResponse.json({ tokens, secretConfigured: isTokenSecretConfigured() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAccessLevel(ACCESS.ADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!isTokenSecretConfigured()) {
    return NextResponse.json(
      { error: "MCP_TOKEN_SECRET is not configured on the server" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { username, label, scopes } = body;

  if (typeof username !== "string" || username.trim().length === 0) {
    return NextResponse.json({ error: "User is required" }, { status: 400 });
  }
  const target = await getUserByUsername(username);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  // Privilege ceiling: issuing a token for someone more privileged than you
  // would be an escalation — you hold the token, so you would gain their
  // access. Equal levels are allowed so admins can help each other.
  if (target.accessLevel > admin.accessLevel) {
    return NextResponse.json(
      { error: "Cannot issue a token for a user with a higher access level than your own" },
      { status: 403 }
    );
  }

  if (typeof label !== "string" || label.trim().length === 0) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }
  if (label.trim().length > MAX_LABEL) {
    return NextResponse.json(
      { error: `Label must be ${MAX_LABEL} characters or fewer` },
      { status: 400 }
    );
  }

  const parsed = parseScopes(scopes);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { token, plaintext } = await createMcpToken({
    username: target.username,
    label: label.trim(),
    scopes: parsed.scopes,
    issuedBy: admin.username,
  });

  return NextResponse.json({ token: { ...token, plaintext } }, { status: 201 });
}

/**
 * Change an existing token's scopes.
 *
 * Exists so a token issued before a module was added can pick it up without
 * being revoked and re-issued, which would make its holder reconfigure their
 * client. The secret is untouched, so the URL they already have keeps working.
 *
 * The response deliberately does NOT include the plaintext, unlike POST. The
 * caller already has the token on screen; re-sending the secret for an edit
 * that did not change it puts it through the network again for no reason.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAccessLevel(ACCESS.ADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await getTokenById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Authorisation is decided before the token's state, deliberately. Checking
  // "is it revoked" first would answer that question for a token the caller has
  // no business touching, and would let a lower-privileged admin probe a
  // superadmin's tokens by watching which error comes back.
  //
  // Same privilege ceiling as issuing: widening a token belonging to someone
  // more privileged than you is an escalation, because you can read the token.
  const owner = await getUserByUsername(existing.username);
  if (!owner) {
    return NextResponse.json({ error: "Token owner no longer exists" }, { status: 400 });
  }
  if (owner.accessLevel > admin.accessLevel) {
    return NextResponse.json(
      { error: "Cannot change scopes on a token belonging to a user with a higher access level than your own" },
      { status: 403 }
    );
  }

  if (existing.revokedAt) {
    return NextResponse.json(
      { error: "Cannot change scopes on a revoked token" },
      { status: 400 }
    );
  }

  const parsed = parseScopes(body.scopes);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const token = await updateTokenScopes(id, parsed.scopes);
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ token });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAccessLevel(ACCESS.ADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const revoked = await revokeToken(id);
  if (!revoked) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
