import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getClueById, updateClue, deleteClue } from "@/lib/db/clues";
import { ALLEGIANCES } from "@/lib/allegiances";

const VALID_FACTION_SLUGS = new Set(Object.keys(ALLEGIANCES));

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

function sanitizeFactionSlugs(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") return null;
    if (!VALID_FACTION_SLUGS.has(v)) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await getClueById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fields: { text?: string; factionSlugs?: string[]; createdBy?: string } = {};

  if (body.text !== undefined) {
    if (typeof body.text !== "string" || body.text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    if (body.text.trim().length > 2000) {
      return NextResponse.json({ error: "Text must be 2000 characters or fewer" }, { status: 400 });
    }
    fields.text = body.text.trim();
  }

  if (body.factionSlugs !== undefined) {
    const slugs = sanitizeFactionSlugs(body.factionSlugs);
    if (slugs === null) {
      return NextResponse.json({ error: "Invalid faction slugs" }, { status: 400 });
    }
    fields.factionSlugs = slugs;
  }

  if (body.createdBy !== undefined) {
    if (typeof body.createdBy !== "string" || body.createdBy.trim().length === 0) {
      return NextResponse.json({ error: "Invalid createdBy" }, { status: 400 });
    }
    const author = await getUserByUsername(body.createdBy);
    if (!author) {
      return NextResponse.json({ error: "createdBy user not found" }, { status: 400 });
    }
    fields.createdBy = author.username;
  }

  if (fields.text === undefined && fields.factionSlugs === undefined && fields.createdBy === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const clue = await updateClue(id, fields);
  return NextResponse.json({ clue });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await getClueById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteClue(id);
  return NextResponse.json({ success: true });
}
