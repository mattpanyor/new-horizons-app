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
import type { Board, GameType, StormQueensFollyState } from "@/types/game";

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

  const { gameType, challengeRate, designatedPlayer, opponentEntityId, initialBoard } = body;

  const resolvedType: GameType = GAME_TYPES.includes(gameType) ? gameType : GAME_TYPES[0];
  const gameDef = GAME_REGISTRY[resolvedType];

  if (![1, 2, 3].includes(challengeRate)) {
    return NextResponse.json({ error: "Challenge rate must be 1, 2, or 3" }, { status: 400 });
  }
  if (!designatedPlayer || typeof designatedPlayer !== "string") {
    return NextResponse.json({ error: "Designated player is required" }, { status: 400 });
  }

  let board: Board = gameDef.getDefaultBoard();
  if (initialBoard) {
    if (
      !Array.isArray(initialBoard) ||
      initialBoard.length !== 3 ||
      !initialBoard.every((row: unknown) =>
        Array.isArray(row) && row.length === 3 &&
        row.every((cell: unknown) => cell === null || cell === "player" || cell === "opponent")
      )
    ) {
      return NextResponse.json({ error: "Invalid board layout" }, { status: 400 });
    }
    board = initialBoard;
  }
  const state: StormQueensFollyState = {
    board,
    turn: "player",
    moveHistory: [],
  };

  const session = await createGameSession({
    gameType: resolvedType,
    config: {
      challengeRate,
      initialBoard: board,
      opponentEntityId: opponentEntityId ?? null,
    },
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

  const { id, challengeRate, designatedPlayer, opponentEntityId, initialBoard } = body;

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

  const board: Board = initialBoard ?? existing.config.initialBoard;
  const state: StormQueensFollyState = {
    board,
    turn: "player",
    moveHistory: [],
  };

  const updated = await updateGameSession(id, {
    config: {
      challengeRate: challengeRate ?? existing.config.challengeRate,
      initialBoard: board,
      opponentEntityId: opponentEntityId ?? existing.config.opponentEntityId,
    },
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

    // Reset state from config's initial board
    await updateGameSession(id, {
      config: existing.config,
      state: {
        board: existing.config.initialBoard,
        turn: "player",
        moveHistory: [],
      },
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
