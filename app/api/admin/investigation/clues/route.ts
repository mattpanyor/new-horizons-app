import { NextRequest, NextResponse } from "next/server";
import { requireAccessLevel } from "@/lib/auth";
import { ACCESS, createClueAs } from "@/lib/investigation/service";

export async function POST(req: NextRequest) {
  const admin = await requireAccessLevel(ACCESS.SUPERADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // The admin form always supplies both explicitly — unlike the player
  // composer, which defaults the chapter and the author.
  if (body.chapter === undefined || body.chapter === null) {
    return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
  }
  if (typeof body.createdBy !== "string" || body.createdBy.trim().length === 0) {
    return NextResponse.json({ error: "createdBy is required" }, { status: 400 });
  }

  const result = await createClueAs(admin, {
    chapter: body.chapter,
    text: body.text,
    factionSlugs: body.factionSlugs,
    author: body.createdBy,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ clue: result.data }, { status: 201 });
}
