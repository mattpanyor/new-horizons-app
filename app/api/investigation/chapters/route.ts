import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listChaptersAs } from "@/lib/investigation/service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listChaptersAs(user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ chapters: result.data });
}
