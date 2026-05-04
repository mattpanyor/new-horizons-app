import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getAllKankaEntities } from "@/lib/db/kankaEntities";

export async function GET() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getUserByUsername(username);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entities = await getAllKankaEntities();
  // Trim payload — picker only needs id/name/type/image
  const items = entities.map((e) => ({
    entityId: e.entityId,
    name: e.name,
    type: e.type,
    imageUrl: e.imageUrl,
  }));
  return NextResponse.json({ entities: items });
}
