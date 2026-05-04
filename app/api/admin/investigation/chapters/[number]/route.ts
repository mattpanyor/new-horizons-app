import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { renameChapter, deleteChapter, getChapter } from "@/lib/db/chapters";

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { number: numStr } = await ctx.params;
  const number = Number(numStr);
  if (!Number.isInteger(number) || number < 1) {
    return NextResponse.json({ error: "Invalid chapter number" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title } = body;
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.trim().length > 200) {
    return NextResponse.json({ error: "Title must be 200 characters or fewer" }, { status: 400 });
  }

  const chapter = await renameChapter(number, title.trim());
  if (!chapter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ chapter });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { number: numStr } = await ctx.params;
  const number = Number(numStr);
  if (!Number.isInteger(number) || number < 1) {
    return NextResponse.json({ error: "Invalid chapter number" }, { status: 400 });
  }

  const existing = await getChapter(number);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteChapter(number);
  return NextResponse.json({ success: true });
}
