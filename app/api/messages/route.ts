import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getMessagesForUser } from "@/lib/db/messages";
import { getKankaEntityByEntityId } from "@/lib/db/kankaEntities";

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

  const messages = await getMessagesForUser(user.id);

  if (messages.length === 0) {
    return NextResponse.json([]);
  }

  const enriched = await Promise.all(
    messages.map(async (msg) => {
      let sender = null;
      if (msg.kankaEntityId) {
        const entity = await getKankaEntityByEntityId(msg.kankaEntityId);
        if (entity) {
          sender = { name: entity.name, image: entity.imageUrl, title: entity.title };
        }
      }
      return { ...msg, sender };
    })
  );

  return NextResponse.json(enriched);
}
