import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getActiveGame, updateGameState } from "@/lib/db/games";
import { validateEnemyList } from "@/lib/combat/spaceCombat";
import type {
  CombatEnemyShip,
  SpaceCombatConfig,
  SpaceCombatState,
} from "@/types/game";

export async function POST(req: NextRequest) {
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
  if (!session || session.gameType !== "space-combat") {
    return NextResponse.json({ error: "No active combat" }, { status: 400 });
  }
  const config = session.config as SpaceCombatConfig;
  const state = session.state as SpaceCombatState;

  // Phase-specific auth + payload handling.
  if (state.phase === "player") {
    if (username !== config.commanderUsername) {
      return NextResponse.json(
        { error: "Only the commander can end the player turn" },
        { status: 403 },
      );
    }
  } else {
    if (user.accessLevel < 127) {
      return NextResponse.json(
        { error: "Only the GM can end the gm turn" },
        { status: 403 },
      );
    }
  }

  // gm-phase end-turn may include the new staged enemy list (Phase 7+).
  let nextEnemies: CombatEnemyShip[] = state.enemies ?? [];
  if (state.phase === "gm") {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // No body is fine — just flip phase with no enemy changes.
    }
    if (body && typeof body === "object" && "enemies" in body) {
      const candidate = (body as { enemies: unknown }).enemies;
      const validated = validateEnemyList(candidate);
      if (validated === null) {
        return NextResponse.json({ error: "Invalid enemies payload" }, { status: 400 });
      }
      nextEnemies = validated;
    }
  }

  // Build next state. End Turn always:
  //  - increments moveCount (drives client animation)
  //  - clears weaponHighlights (per spec: phase change resets all measurements)
  //  - flips phase
  // If gm phase: also snapshots prevEnemies = current, sets enemies = next.
  const nextState: SpaceCombatState = {
    ...state,
    phase: state.phase === "player" ? "gm" : "player",
    moveCount: (state.moveCount ?? 0) + 1,
    weaponHighlights: {},
    enemies: state.phase === "gm" ? nextEnemies : state.enemies,
    prevEnemies: state.phase === "gm" ? (state.enemies ?? []) : state.prevEnemies,
  };

  const updated = await updateGameState(
    session.id,
    nextState as unknown as Record<string, unknown>,
    null,
    state.moveCount,
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Stale move — game has advanced" },
      { status: 409 },
    );
  }
  return NextResponse.json({ state: updated.state });
}
