import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getActiveGame } from "@/lib/db/games";
import { getKankaEntityByEntityId } from "@/lib/db/kankaEntities";
import { sanitizeStateForClient as sanitizeArcaneCardState } from "@/lib/games/arcaneCard";
import type { ArcaneCardState } from "@/types/game";

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

  const session = await getActiveGame();
  if (!session) {
    return NextResponse.json({ active: false });
  }

  // Get player data
  const designatedUser = session.designatedPlayer
    ? await getUserByUsername(session.designatedPlayer)
    : null;

  // Get opponent entity data
  let opponent = null;
  if (session.config.opponentEntityId) {
    const entity = await getKankaEntityByEntityId(session.config.opponentEntityId);
    if (entity) {
      opponent = {
        name: entity.name,
        imageUrl: entity.imageUrl,
        title: entity.title,
      };
    }
  }

  // Strip sensitive config fields (e.g. challengeRate for Storm Queen's Folly)
  const safeConfig = { ...session.config };
  if ("challengeRate" in safeConfig) {
    delete (safeConfig as Record<string, unknown>).challengeRate;
  }

  // Sanitize game-specific state (hide opponent deck order & hand identities for Arcane Card)
  let safeState = session.state;
  if (session.gameType === "arcane-card") {
    safeState = sanitizeArcaneCardState(session.state as ArcaneCardState);
  }

  return NextResponse.json({
    active: true,
    session: {
      ...session,
      config: safeConfig,
      state: safeState,
    },
    player: {
      username: designatedUser?.username ?? session.designatedPlayer,
      character: designatedUser?.character ?? null,
      role: designatedUser?.role ?? null,
      imageUrl: designatedUser?.imageUrl ?? null,
      group: designatedUser?.group ?? null,
    },
    opponent,
  });
}
