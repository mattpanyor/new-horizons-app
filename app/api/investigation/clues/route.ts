import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getCluesByChapter, createClue } from "@/lib/db/clues";
import { getCurrentChapter, getChapter } from "@/lib/db/chapters";
import { ALLEGIANCES } from "@/lib/allegiances";

const VALID_FACTION_SLUGS = new Set(Object.keys(ALLEGIANCES));

async function requireUser() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  return getUserByUsername(username);
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

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chapterParam = req.nextUrl.searchParams.get("chapter");
  if (!chapterParam) {
    return NextResponse.json({ error: "chapter query param required" }, { status: 400 });
  }
  const chapter = Number(chapterParam);
  if (!Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
  }

  const clues = await getCluesByChapter(chapter);
  return NextResponse.json({ clues });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text, factionSlugs, chapter: chapterInput } = body;

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

  let targetChapter: number;
  if (chapterInput === undefined || chapterInput === null) {
    const current = await getCurrentChapter();
    if (!current) {
      return NextResponse.json({ error: "No chapters exist yet" }, { status: 400 });
    }
    targetChapter = current.number;
  } else {
    if (!Number.isInteger(chapterInput) || chapterInput < 1) {
      return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
    }
    const exists = await getChapter(chapterInput);
    if (!exists) {
      return NextResponse.json({ error: "Chapter does not exist" }, { status: 400 });
    }
    targetChapter = chapterInput;
  }

  const clue = await createClue({
    chapter: targetChapter,
    text: text.trim(),
    factionSlugs: slugs,
    createdBy: user.username,
  });

  return NextResponse.json({ clue }, { status: 201 });
}
