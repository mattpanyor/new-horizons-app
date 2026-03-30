import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getMessagesForUser } from "@/lib/db/messages";
import { fetchKankaEntityById } from "@/lib/kanka";

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

  // Deduplicate Kanka entity IDs and fetch only those needed
  const kankaIds = [...new Set(messages.filter((m) => m.kankaEntityId != null).map((m) => m.kankaEntityId!))];

  if (kankaIds.length > 0) {
    const results = await Promise.all(kankaIds.map((id) => fetchKankaEntityById(id)));
    const allFailed = results.every((r) => r === undefined);
    if (allFailed && process.env.KANKA_API && process.env.KANKA_CAMPAIGN_ID) {
      return NextResponse.json({ error: "kanka_unavailable" }, { status: 503 });
    }
  }

  // Resolve Kanka entity info for each message (already cached from above)
  const enriched = await Promise.all(
    messages.map(async (msg) => {
      let sender = null;
      if (msg.kankaEntityId) {
        const entity = await fetchKankaEntityById(msg.kankaEntityId);
        if (entity) {
          sender = { name: entity.name, image: entity.image, title: entity.title };
        }
      }
      return { ...msg, sender };
    })
  );

  return NextResponse.json(enriched);
}
