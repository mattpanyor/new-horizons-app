import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { createClue } from "@/lib/db/clues";
import { getChapter } from "@/lib/db/chapters";
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

export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { chapter, text, factionSlugs, createdBy } = body;

  if (!Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
  }
  const chapterRow = await getChapter(chapter);
  if (!chapterRow) {
    return NextResponse.json({ error: "Chapter does not exist" }, { status: 400 });
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.trim().length > 2000) {
    return NextResponse.json({ error: "Text must be 2000 characters or fewer" }, { status: 400 });
  }

  const slugs = sanitizeFactionSlugs(factionSlugs ?? []);
  if (slugs === null) {
    return NextResponse.json({ error: "Invalid faction slugs" }, { status: 400 });
  }

  if (typeof createdBy !== "string" || createdBy.trim().length === 0) {
    return NextResponse.json({ error: "createdBy is required" }, { status: 400 });
  }
  const author = await getUserByUsername(createdBy);
  if (!author) {
    return NextResponse.json({ error: "createdBy user not found" }, { status: 400 });
  }

  const clue = await createClue({
    chapter,
    text: text.trim(),
    factionSlugs: slugs,
    createdBy: author.username,
  });
  return NextResponse.json({ clue }, { status: 201 });
}
