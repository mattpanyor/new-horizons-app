import { NextRequest, NextResponse } from "next/server";
import { requireAccessLevel } from "@/lib/auth";
import { ACCESS, createChapterAs, listChaptersWithCountsAs } from "@/lib/investigation/service";

export async function GET() {
  const admin = await requireAccessLevel(ACCESS.SUPERADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await listChaptersWithCountsAs(admin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

export async function POST(req: NextRequest) {
  const admin = await requireAccessLevel(ACCESS.SUPERADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const result = await createChapterAs(admin, body.title);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ chapter: result.data }, { status: 201 });
}
