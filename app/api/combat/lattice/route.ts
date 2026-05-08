import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getActiveGame, updateGameState } from "@/lib/db/games";
import type { SpaceCombatConfig, SpaceCombatState } from "@/types/game";

const GM_ACCESS_LEVEL = 127;

// Toggle the Graviton Lattice shield. Auth model:
//   - Commander (player phase only): can set active=true OR active=false
//   - GM (any phase): can only set active=false (disarm — narratively the
//       enemy "shoots it off")
//
// Mutex with Flip: activating the lattice is rejected while flip is in any
// non-undefined state (charging or cooldown — actually only charging is
// possible in player phase). Symmetric: the flip endpoint rejects arming
// while lattice is active.
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

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const wantActive = (body as { active?: unknown })?.active;
  if (typeof wantActive !== "boolean") {
    return NextResponse.json(
      { error: "active (boolean) required" },
      { status: 400 },
    );
  }

  const isCommander = username === config.commanderUsername;
  const isGM = user.accessLevel >= GM_ACCESS_LEVEL;

  // Auth + intent matrix.
  if (wantActive) {
    // Activation — commander only, player phase only.
    if (!isCommander || state.phase !== "player") {
      return NextResponse.json(
        { error: "Only the commander can activate lattice during player phase" },
        { status: 403 },
      );
    }
    // Mutex with flip — can't activate lattice while a flip is in any cycle.
    if (state.flip) {
      return NextResponse.json(
        { error: "Lattice cannot be raised while Flip is in cycle" },
        { status: 409 },
      );
    }
  } else {
    // Disarm — commander (any phase if they put it up) OR GM (any phase).
    if (!isCommander && !isGM) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const expected = (body as { expectedMoveCount?: unknown })?.expectedMoveCount;
  if (typeof expected === "number" && expected !== state.moveCount) {
    return NextResponse.json(
      { error: "Stale state — turn has advanced" },
      { status: 409 },
    );
  }

  // No-op short-circuit.
  if (!!state.latticeActive === wantActive) {
    return NextResponse.json({ ok: true });
  }

  const nextState: SpaceCombatState = {
    ...state,
    latticeActive: wantActive ? true : undefined,
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
