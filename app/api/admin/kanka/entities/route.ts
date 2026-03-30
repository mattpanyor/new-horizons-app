import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getKankaEntities } from "@/lib/kanka";

export async function GET() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entities = await getKankaEntities();
  return NextResponse.json(entities);
}
