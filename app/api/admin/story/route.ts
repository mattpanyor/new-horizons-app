import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername, getAllUsers } from "@/lib/db/users";
import { getChapter } from "@/lib/db/chapters";
import { getAllStoryEntries, createStoryEntry } from "@/lib/db/story";

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
  if (input === undefined || input === null) return [];
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

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const entries = await getAllStoryEntries();
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { chapter, title, body: text, sessionNumber, isPublic, assignedUsernames } = body;

  if (!Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
  }
  if (!(await getChapter(chapter))) {
    return NextResponse.json({ error: "Chapter does not exist" }, { status: 400 });
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.trim().length > MAX_TITLE) {
    return NextResponse.json({ error: `Title must be ${MAX_TITLE} characters or fewer` }, { status: 400 });
  }

  if (text !== undefined && typeof text !== "string") {
    return NextResponse.json({ error: "Body must be a string" }, { status: 400 });
  }
  if (typeof text === "string" && text.length > MAX_BODY) {
    return NextResponse.json({ error: `Body must be ${MAX_BODY} characters or fewer` }, { status: 400 });
  }

  let session: number | null = null;
  if (sessionNumber !== undefined && sessionNumber !== null && sessionNumber !== "") {
    if (!Number.isInteger(sessionNumber) || sessionNumber < 0 || sessionNumber > 2147483647) {
      return NextResponse.json({ error: "Invalid session number" }, { status: 400 });
    }
    session = sessionNumber;
  }

  const assigned = await sanitizeAssigned(assignedUsernames);
  if (assigned === null) {
    return NextResponse.json({ error: "Invalid assigned players" }, { status: 400 });
  }

  const entry = await createStoryEntry({
    chapter,
    title: title.trim(),
    body: typeof text === "string" ? text : "",
    sessionNumber: session,
    isPublic: Boolean(isPublic),
    assignedUsernames: assigned,
    createdBy: admin.username,
  });
  return NextResponse.json({ entry }, { status: 201 });
}
