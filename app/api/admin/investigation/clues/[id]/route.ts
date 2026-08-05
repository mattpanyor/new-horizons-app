import { NextRequest, NextResponse } from "next/server";
import { requireAccessLevel } from "@/lib/auth";
import { ACCESS, deleteClueAs, updateClueAs } from "@/lib/investigation/service";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAccessLevel(ACCESS.SUPERADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: idStr } = await ctx.params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const result = await updateClueAs(admin, Number(idStr), {
    text: body.text,
    factionSlugs: body.factionSlugs,
    author: body.createdBy,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ clue: result.data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAccessLevel(ACCESS.SUPERADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: idStr } = await ctx.params;

  const result = await deleteClueAs(admin, Number(idStr));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
