import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getUserByUsername } from "@/lib/db/users";
import { getActiveGame, updateGameState } from "@/lib/db/games";
import { validateEnemy } from "@/lib/combat/spaceCombat";
import { SIZE_CLASS_BY_ID } from "@/lib/combat/sizeClasses";
import type { CombatEnemyShip, SpaceCombatState } from "@/types/game";

// POST /api/combat/enemy — add a new enemy. GM-phase + accessLevel >= 127.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getActiveGame();
  if (!session || session.gameType !== "space-combat") {
    return NextResponse.json({ error: "No active combat" }, { status: 400 });
  }
  const state = session.state as SpaceCombatState;
  if (state.phase !== "gm") {
    return NextResponse.json(
      { error: "Add Ship only allowed during GM phase" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = (body ?? {}) as Record<string, unknown>;

  // Build a candidate enemy from the modal payload (range + size + faction).
  // Default position: directly north (azimuth=0, elevation=0), facing=bow.
  const candidate: unknown = {
    id: randomUUID(),
    sizeClass: o.sizeClass,
    label:
      typeof o.label === "string" && o.label.trim()
        ? o.label.trim()
        : SIZE_CLASS_BY_ID[(o.sizeClass as keyof typeof SIZE_CLASS_BY_ID)]?.displayName ?? "Object",
    factionId: o.factionId === undefined ? null : o.factionId,
    range: o.range,
    azimuthDeg: 0,
    elevationDeg: 0,
    facing: "bow",
  };
  const validated = validateEnemy(candidate);
  if (!validated) {
    return NextResponse.json({ error: "Invalid enemy payload" }, { status: 400 });
  }

  const nextEnemies: CombatEnemyShip[] = [...(state.enemies ?? []), validated];
  const nextState: SpaceCombatState = {
    ...state,
    enemies: nextEnemies,
    moveCount: (state.moveCount ?? 0) + 1,
  };
  const updated = await updateGameState(
    session.id,
    nextState as unknown as Record<string, unknown>,
    null,
    state.moveCount,
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Stale state — game has advanced" },
      { status: 409 },
    );
  }
  return NextResponse.json({ enemy: validated });
}
