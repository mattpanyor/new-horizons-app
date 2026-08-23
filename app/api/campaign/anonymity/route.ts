import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listAnonymityAs } from "@/lib/campaign/service";

/** Every log line across the VIPs this caller may see. Writes go per-VIP. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listAnonymityAs(user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ entries: result.data });
}
