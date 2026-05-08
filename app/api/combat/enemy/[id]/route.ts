import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getActiveGame, updateGameState } from "@/lib/db/games";
import { validateEnemy } from "@/lib/combat/spaceCombat";
import type { CombatEnemyShip, SpaceCombatState } from "@/types/game";

async function authGM() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

async function loadCombat() {
  const session = await getActiveGame();
  if (!session || session.gameType !== "space-combat") return null;
  return session;
}

// PATCH /api/combat/enemy/:id — edit any subset of enemy fields.
//   GM only. Both phases.
//   In Phase 6 this is the immediate-commit path. Phase 7 will route GM-phase
//   edits through the staging buffer instead, but the endpoint stays available.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authGM();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const session = await loadCombat();
  if (!session) return NextResponse.json({ error: "No active combat" }, { status: 400 });
  const state = session.state as SpaceCombatState;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = (body ?? {}) as Record<string, unknown>;

  const idx = (state.enemies ?? []).findIndex((e) => e.id === id);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const existing = state.enemies[idx];

  const merged: unknown = {
    ...existing,
    ...(typeof o.label === "string" ? { label: o.label } : {}),
    ...("factionId" in o
      ? { factionId: o.factionId === null ? null : (o.factionId as string | null) }
      : {}),
    ...(typeof o.range === "string" ? { range: o.range } : {}),
    ...(typeof o.facing === "string" ? { facing: o.facing } : {}),
    ...(typeof o.azimuthDeg === "number" ? { azimuthDeg: o.azimuthDeg } : {}),
    ...(typeof o.elevationDeg === "number" ? { elevationDeg: o.elevationDeg } : {}),
    ...(typeof o.shieldsUp === "boolean" ? { shieldsUp: o.shieldsUp } : {}),
  };
  const validated = validateEnemy(merged);
  if (!validated) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  const nextEnemies: CombatEnemyShip[] = state.enemies.map((e, i) =>
    i === idx ? validated : e,
  );
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
    return NextResponse.json({ error: "Stale state" }, { status: 409 });
  }
  return NextResponse.json({ enemy: validated });
}

// DELETE /api/combat/enemy/:id — remove an enemy. GM only. Both phases.
//   Permanent — no undo per spec.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authGM();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const session = await loadCombat();
  if (!session) return NextResponse.json({ error: "No active combat" }, { status: 400 });
  const state = session.state as SpaceCombatState;

  if (!(state.enemies ?? []).some((e) => e.id === id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const nextEnemies = state.enemies.filter((e) => e.id !== id);
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
    return NextResponse.json({ error: "Stale state" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
