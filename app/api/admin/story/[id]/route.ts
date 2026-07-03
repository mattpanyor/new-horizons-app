import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername, getAllUsers } from "@/lib/db/users";
import { getChapter } from "@/lib/db/chapters";
import {
  getStoryEntryById,
  updateStoryEntry,
  deleteStoryEntry,
} from "@/lib/db/story";

const MAX_TITLE = 200;
const MAX_BODY = 40000;

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

async function sanitizeAssigned(input: unknown): Promise<string[] | null> {
  if (!Array.isArray(input)) return null;
  const valid = new Set((await getAllUsers()).map((u) => u.username));
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") return null;
    if (!valid.has(v)) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }
  if (!(await getStoryEntryById(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const fields: Parameters<typeof updateStoryEntry>[1] = {};

  if (body.chapter !== undefined) {
    if (!Number.isInteger(body.chapter) || body.chapter < 1 || !(await getChapter(body.chapter))) {
      return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
    }
    fields.chapter = body.chapter;
  }

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (body.title.trim().length > MAX_TITLE) {
      return NextResponse.json({ error: `Title must be ${MAX_TITLE} characters or fewer` }, { status: 400 });
    }
    fields.title = body.title.trim();
  }

  if (body.body !== undefined) {
    if (typeof body.body !== "string") {
      return NextResponse.json({ error: "Body must be a string" }, { status: 400 });
    }
    if (body.body.length > MAX_BODY) {
      return NextResponse.json({ error: `Body must be ${MAX_BODY} characters or fewer` }, { status: 400 });
    }
    fields.body = body.body;
  }

  if (body.sessionNumber !== undefined) {
    if (body.sessionNumber === null || body.sessionNumber === "") {
      fields.sessionNumber = null;
    } else if (!Number.isInteger(body.sessionNumber) || body.sessionNumber < 0) {
      return NextResponse.json({ error: "Invalid session number" }, { status: 400 });
    } else {
      fields.sessionNumber = body.sessionNumber;
    }
  }

  if (body.isPublic !== undefined) {
    fields.isPublic = Boolean(body.isPublic);
  }

  if (body.assignedUsernames !== undefined) {
    const assigned = await sanitizeAssigned(body.assignedUsernames);
    if (assigned === null) {
      return NextResponse.json({ error: "Invalid assigned players" }, { status: 400 });
    }
    fields.assignedUsernames = assigned;
  }

  const entry = await updateStoryEntry(id, fields);
  return NextResponse.json({ entry });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }
  const ok = await deleteStoryEntry(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
