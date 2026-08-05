// Self-serve MCP token management.
//
// Every query is scoped to the caller's own username — there is no way to list
// or revoke another user's tokens through this endpoint, whatever their access
// level. Minting a token never grants more than the owner already has: the MCP
// registry re-checks access level on every call.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createMcpToken, listTokensForUser, revokeToken } from "@/lib/db/mcpTokens";
import { isKnownScope } from "@/lib/mcp/registry";

const MAX_LABEL = 60;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await listTokensForUser(user.username);
  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { label, scopes } = body;

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
    username: user.username,
    label: label.trim(),
    scopes: unique,
  });

  // The only time the plaintext is ever returned.
  return NextResponse.json({ token, plaintext }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const revoked = await revokeToken(id, user.username);
  if (!revoked) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
