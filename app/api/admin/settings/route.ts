// Admin-controlled app settings. Thin adapter over lib/settings/service.ts —
// the validation lives there so every surface shares it.

import { NextRequest, NextResponse } from "next/server";
import { requireAccessLevel } from "@/lib/auth";
import { ACCESS } from "@/lib/investigation/service";
import {
  getHomeScreenArtStatus,
  presetOptions,
  setHomeScreenArt,
} from "@/lib/settings/service";

export async function GET() {
  const admin = await requireAccessLevel(ACCESS.ADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await getHomeScreenArtStatus();
  return NextResponse.json({ homeScreenArt: status, options: presetOptions() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAccessLevel(ACCESS.ADMIN);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { homeScreenArt } = body;
  if (typeof homeScreenArt !== "string") {
    return NextResponse.json({ error: "homeScreenArt is required" }, { status: 400 });
  }

  try {
    await setHomeScreenArt(homeScreenArt, admin.username);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save setting" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, homeScreenArt: await getHomeScreenArtStatus() });
}
