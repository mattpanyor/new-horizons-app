import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getActiveGame, setStateAtPath } from "@/lib/db/games";
import { getWeaponById } from "@/lib/combat/playerShip";
import type { CombatPlacedHighlight, SpaceCombatState } from "@/types/game";

const DEFAULT_COLOR = "#ffffff";

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
  const state = session.state as SpaceCombatState;
  if (state.phase !== "player") {
    return NextResponse.json(
      { error: "Highlights only allowed during player phase" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const weaponId = (body as { weaponId?: unknown }).weaponId;
  const axis = (body as { axis?: unknown }).axis;
  const expectedMoveCount = (body as { expectedMoveCount?: unknown })
    .expectedMoveCount;

  // Optimistic-concurrency guard: if the client read an older state than the
  // current server state (e.g. they placed during the player turn but the
  // commander has since End-Turned and bumped moveCount), reject the write
  // so the slot doesn't leak into the new turn.
  if (
    typeof expectedMoveCount === "number" &&
    state.moveCount > expectedMoveCount
  ) {
    return NextResponse.json(
      { error: "Stale state — turn has advanced" },
      { status: 409 },
    );
  }

  // Clear-slot path: weaponId === null. Atomic single-key write so concurrent
  // POSTs from other users (writing their own slot) can't blow this one away.
  if (weaponId === null) {
    const ok = await setStateAtPath(
      session.id,
      ["weaponHighlights", username],
      null,
    );
    if (!ok) {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof weaponId !== "string" || !getWeaponById(weaponId)) {
    return NextResponse.json({ error: "Unknown weapon" }, { status: 400 });
  }
  if (
    !axis ||
    typeof axis !== "object" ||
    typeof (axis as { x?: unknown }).x !== "number" ||
    typeof (axis as { y?: unknown }).y !== "number" ||
    typeof (axis as { z?: unknown }).z !== "number"
  ) {
    return NextResponse.json({ error: "Invalid axis" }, { status: 400 });
  }
  const { x, y, z } = axis as { x: number; y: number; z: number };
  // Normalize to unit vector.
  const len = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(len) || len < 1e-6) {
    return NextResponse.json({ error: "Invalid axis (zero length)" }, { status: 400 });
  }

  const placed: CombatPlacedHighlight = {
    weaponId,
    axis: { x: x / len, y: y / len, z: z / len },
    color: user.color ?? DEFAULT_COLOR,
  };
  const ok = await setStateAtPath(
    session.id,
    ["weaponHighlights", username],
    placed,
  );
  if (!ok) {
    return NextResponse.json({ error: "Game is not active" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
