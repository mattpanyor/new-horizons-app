import { NextRequest, NextResponse } from "next/server";
import { requireAccessLevel } from "@/lib/auth";
import { ACCESS, deleteChapterAs, renameChapterAs } from "@/lib/investigation/service";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const admin = await requireAccessLevel(ACCESS.SUPERADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { number: numStr } = await ctx.params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const result = await renameChapterAs(admin, Number(numStr), body.title);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ chapter: result.data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const admin = await requireAccessLevel(ACCESS.SUPERADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { number: numStr } = await ctx.params;

  const result = await deleteChapterAs(admin, Number(numStr));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  // deletedClues is reported because the delete cascades to the chapter's clues.
  return NextResponse.json({ success: true, deletedClues: result.data.deletedClues });
}
