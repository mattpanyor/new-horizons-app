import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername, getAllUsers } from "@/lib/db/users";
import {
  getAllGameSessions,
  getGameSession,
  getActiveGame,
  createGameSession,
  updateGameSession,
  deleteGameSession,
  launchGameSession,
  stopGameSession,
} from "@/lib/db/games";
import { getAllKankaEntities } from "@/lib/db/kankaEntities";
import { GAME_REGISTRY, GAME_TYPES } from "@/lib/games/registry";
import { getRandomBoard } from "@/lib/games/engineeringChallenge";
import type { GameType, StormQueensFollyConfig, StormQueensFollyState } from "@/types/game";

async function requireAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 66) return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [sessions, users, entities] = await Promise.all([
    getAllGameSessions(),
    getAllUsers(),
    getAllKankaEntities(),
  ]);

  return NextResponse.json({
    sessions,
    users: users.map((u) => ({ id: u.id, username: u.username, character: u.character })),
    entities: entities.filter((e) => e.type === "character"),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { gameType, designatedPlayer, ...gameConfig } = body;

  const resolvedType: GameType = GAME_TYPES.includes(gameType) ? gameType : GAME_TYPES[0];
  const gameDef = GAME_REGISTRY[resolvedType];

  if (!designatedPlayer || typeof designatedPlayer !== "string") {
    return NextResponse.json({ error: "Designated player is required" }, { status: 400 });
  }

  // Build config: merge defaults with provided overrides
  const defaultConfig = gameDef.getDefaultConfig();
  let config = { ...defaultConfig, ...gameConfig };
  const state = gameDef.getDefaultState();

  // For EC: pick a random board based on wireCount + difficulty
  if (resolvedType === "engineering-challenge") {
    const wc = gameConfig.wireCount ?? 4;
    const diff = gameConfig.difficulty ?? "normal";
    const board = getRandomBoard(wc, diff);
    if (!board) {
      return NextResponse.json({ error: `No boards available for ${wc} wires on ${diff}` }, { status: 400 });
    }
    config = { ...config, ...board, wireCount: wc, difficulty: diff };
  }

  // For SQF: apply initialBoard to state if provided
  if (resolvedType === "storm-queens-folly" && gameConfig.initialBoard) {
    const ib = gameConfig.initialBoard;
    if (
      Array.isArray(ib) && ib.length === 3 &&
      ib.every((row: unknown) =>
        Array.isArray(row) && row.length === 3 &&
        row.every((cell: unknown) => cell === null || cell === "player" || cell === "opponent")
      )
    ) {
      (state as Record<string, unknown>).board = ib;
      (config as Record<string, unknown>).initialBoard = ib;
    }
  }

  const session = await createGameSession({
    gameType: resolvedType,
    config,
    state,
    designatedPlayer,
  });

  return NextResponse.json({ session }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, designatedPlayer, ...configOverrides } = body;

  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "Session id is required" }, { status: 400 });
  }

  const existing = await getGameSession(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "configured") {
    return NextResponse.json({ error: "Can only edit configured games" }, { status: 400 });
  }

  const gameDef = GAME_REGISTRY[existing.gameType as GameType];
  const config = { ...existing.config, ...configOverrides };
  const state = gameDef ? gameDef.getDefaultState() : existing.state;

  const updated = await updateGameSession(id, {
    config,
    state,
    designatedPlayer: designatedPlayer ?? existing.designatedPlayer ?? "",
  });

  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ session: updated });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body;
  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "Session id is required" }, { status: 400 });
  }

  const deleted = await deleteGameSession(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, action } = body;
  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "Session id is required" }, { status: 400 });
  }
  if (action !== "launch" && action !== "stop" && action !== "relaunch") {
    return NextResponse.json({ error: "Action must be 'launch', 'stop', or 'relaunch'" }, { status: 400 });
  }

  if (action === "launch" || action === "relaunch") {
    // Reset state to initial board before launching
    const existing = await getGameSession(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const active = await getActiveGame();
    if (active) {
      return NextResponse.json({ error: "Another game is already launched" }, { status: 409 });
    }

    // Reset state to defaults for the game type, preserving custom starting board for SQF
    const gameDef = GAME_REGISTRY[existing.gameType as GameType];
    const freshState = gameDef ? gameDef.getDefaultState() : {};
    if (existing.gameType === "storm-queens-folly") {
      const ib = (existing.config as StormQueensFollyConfig).initialBoard;
      if (ib) (freshState as StormQueensFollyState).board = ib;
    }

    await updateGameSession(id, {
      config: existing.config,
      state: freshState,
      designatedPlayer: existing.designatedPlayer ?? "",
    });

    const session = await launchGameSession(id);
    if (!session) {
      return NextResponse.json({ error: "Launch failed" }, { status: 500 });
    }
    return NextResponse.json({ session });
  }

  // action === "stop"
  const session = await stopGameSession(id);
  if (!session) {
    return NextResponse.json({ error: "Stop failed" }, { status: 500 });
  }
  return NextResponse.json({ session });
}
