import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createClueAs, listCluesByChapterAs } from "@/lib/investigation/service";

// Thin adapter: parse the request, delegate to the investigation service, map
// the result onto HTTP. Permission and validation rules live in
// lib/investigation/service.ts so the MCP tools enforce exactly the same ones.

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chapterParam = req.nextUrl.searchParams.get("chapter");
  if (!chapterParam) {
    return NextResponse.json({ error: "chapter query param required" }, { status: 400 });
  }

  const result = await listCluesByChapterAs(user, Number(chapterParam));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ clues: result.data });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const result = await createClueAs(user, {
    chapter: body.chapter,
    text: body.text,
    factionSlugs: body.factionSlugs,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ clue: result.data }, { status: 201 });
}
