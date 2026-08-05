// Admin-issued MCP tokens.
//
// An admin mints a token on a user's behalf and sends them the resulting URL.
// The response therefore includes the plaintext, and GET reveals every token —
// which is exactly why this endpoint is gated at accessLevel >= 66 and why the
// self-serve equivalent no longer exists.

import { NextRequest, NextResponse } from "next/server";
import { requireAccessLevel } from "@/lib/auth";
import { getUserByUsername } from "@/lib/db/users";
import { createMcpToken, listAllTokensRevealed, revokeToken } from "@/lib/db/mcpTokens";
import { isKnownScope } from "@/lib/mcp/registry";
import { isTokenSecretConfigured } from "@/lib/mcp/crypto";
import { ACCESS } from "@/lib/investigation/service";

const MAX_LABEL = 60;

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

  if (!Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: "Select at least one scope" }, { status: 400 });
  }
  const unique = Array.from(new Set(scopes));
  for (const scope of unique) {
    if (typeof scope !== "string" || !isKnownScope(scope)) {
      return NextResponse.json({ error: `Unknown scope: ${String(scope)}` }, { status: 400 });
    }
  }

  const { token, plaintext } = await createMcpToken({
    username: target.username,
    label: label.trim(),
    scopes: unique,
    issuedBy: admin.username,
  });

  return NextResponse.json({ token: { ...token, plaintext } }, { status: 201 });
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
