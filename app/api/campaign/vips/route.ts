import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listVipsAs } from "@/lib/campaign/service";

// Thin adapter: delegate to the campaign service, map the result onto HTTP.
// Access rules — including which VIPs this caller may see at all — live in
// lib/campaign/service.ts.

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listVipsAs(user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ vips: result.data });
}
