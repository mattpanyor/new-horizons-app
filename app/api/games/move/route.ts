import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getGameSession, updateGameState } from "@/lib/db/games";
import {
  isValidMove,
  applyMove,
  checkWin,
  getAiMove,
  getValidMoves,
} from "@/lib/games/stormQueensFolly";
import type { GameMove, StormQueensFollyState, PieceOwner } from "@/types/game";

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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, from, to, moveVersion } = body;
  if (!sessionId || !from || !to) {
    return NextResponse.json({ error: "sessionId, from, and to are required" }, { status: 400 });
  }

  const session = await getGameSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (session.status !== "launched") {
    return NextResponse.json({ error: "Game is not active" }, { status: 400 });
  }
  if (session.winner) {
    return NextResponse.json({ error: "Game is already finished" }, { status: 400 });
  }
  if (session.designatedPlayer !== username) {
    return NextResponse.json({ error: "Not your game" }, { status: 403 });
  }
  if (session.state.turn !== "player") {
    return NextResponse.json({ error: "Not your turn" }, { status: 400 });
  }

  // Version check — reject stale moves (e.g. double-click race)
  if (typeof moveVersion === "number" && moveVersion !== session.state.moveHistory.length) {
    return NextResponse.json({ error: "Stale move — board has changed" }, { status: 409 });
  }

  const move: GameMove = { from, to };
  if (!isValidMove(session.state.board, move, "player")) {
    return NextResponse.json({ error: "Invalid move" }, { status: 400 });
  }

  // Apply player move
  let board = applyMove(session.state.board, move);
  const history = [...session.state.moveHistory, move];
  let winner: PieceOwner | "draw" | null = checkWin(board);
  let turn: PieceOwner = "opponent";

  // If player didn't win, run AI
  if (!winner) {
    const aiMove = getAiMove(board, session.config.challengeRate);
    if (aiMove) {
      board = applyMove(board, aiMove);
      history.push(aiMove);
      winner = checkWin(board);
      turn = "player";

      // After AI moves, check if player is now stuck
      if (!winner && getValidMoves(board, "player").length === 0) {
        winner = "draw";
      }
    } else {
      // AI has no moves
      const playerMoves = getValidMoves(board, "player");
      winner = playerMoves.length === 0 ? "draw" : "draw"; // AI stuck = draw regardless
      turn = "player";
    }
  }

  const newState: StormQueensFollyState = {
    board,
    turn,
    moveHistory: history,
  };

  await updateGameState(sessionId, newState, winner);

  return NextResponse.json({
    state: newState,
    winner,
  });
}
