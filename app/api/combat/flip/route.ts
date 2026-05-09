import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getActiveGame, updateGameState } from "@/lib/db/games";
import type { SpaceCombatConfig, SpaceCombatState } from "@/types/game";

const FLIP_COOLDOWN_TURNS = 2;

// Commander toggles Aegis's Flip ability:
//   ready → armed   (state.flip = { charging })
//   armed → ready   (state.flip = undefined; same player phase = cancel)
//   cooldown        → 409 (uncancelable, just wait it out)
//
// Once the commander ends their turn while armed, the End-Turn handler keeps
// the charging state through the GM phase (so the aura stays visible to the
// GM); the GM End-Turn then transitions charging → cooldown(2). Cooldown is
// only "committed" (uncancelable) once the player End Turn fires — until
// then the commander can hit the button again to back out.
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

  if (state.phase !== "player") {
    return NextResponse.json(
      { error: "Flip only allowed during player phase" },
      { status: 400 },
    );
  }
  if (username !== config.commanderUsername) {
    return NextResponse.json(
      { error: "Only the commander can invoke Flip" },
      { status: 403 },
    );
  }

  const isArm = !state.flip;
  const isCancel = state.flip?.status === "charging";
  if (!isArm && !isCancel) {
    return NextResponse.json(
      { error: "Flip is on cooldown" },
      { status: 409 },
    );
  }
  // Mutex with Lattice — can't arm Flip while the Graviton Lattice is up.
  if (isArm && state.latticeActive) {
    return NextResponse.json(
      { error: "Flip cannot be armed while Lattice is active" },
      { status: 409 },
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* body optional */
  }
  const expected = (body as { expectedMoveCount?: unknown })?.expectedMoveCount;
  if (typeof expected === "number" && expected !== state.moveCount) {
    return NextResponse.json(
      { error: "Stale state — turn has advanced" },
      { status: 409 },
    );
  }

  const nextState: SpaceCombatState = {
    ...state,
    flip: isArm
      ? { status: "charging", cooldownLeft: FLIP_COOLDOWN_TURNS }
      : undefined,
    moveCount: state.moveCount + 1,
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
  return NextResponse.json({ ok: true });
}
