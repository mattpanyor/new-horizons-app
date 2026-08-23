import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listStandingsAs } from "@/lib/campaign/service";

// Thin adapter: delegate to the campaign service, map the result onto HTTP.
// Permission and validation rules live in lib/campaign/service.ts.

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listStandingsAs(user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ standings: result.data });
}
