import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getGameSession, updateGameState } from "@/lib/db/games";
import { handleStormQueensFollyMove } from "@/lib/games/stormQueensFolly";
import { handleEngineeringChallengeMove } from "@/lib/games/engineeringChallenge";
import { handleRunePokerMove } from "@/lib/games/runePoker";
import {
  handleArcaneCardMove,
  getDefaultState as getArcaneCardDefaultState,
  sanitizeStateForClient as sanitizeArcaneCardState,
} from "@/lib/games/arcaneCard";
import { handleIsolationProtocolMove } from "@/lib/games/isolationProtocol";
import type {
  ArcaneCardConfig,
  ArcaneCardState,
  IsolationProtocolState,
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = await getGameSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (session.status !== "launched") {
    return NextResponse.json({ error: "Game is not active" }, { status: 400 });
  }

  // Arcane Card: automatic rematch after a stalemate. Allowed for ANY logged-in
  // user — not just the designated player — so observers can recover the table
  // if the player drops or has a network blip during the rematch countdown.
  // Optimistic-concurrency on moveCount serializes concurrent triggers (the
  // first one wins; the others get a 409 they can ignore).
  if (session.gameType === "arcane-card" && body?.action === "rematch") {
    if (session.winner !== "draw") {
      return NextResponse.json({ error: "Rematch only allowed after a draw" }, { status: 400 });
    }
    const rate = (session.config as ArcaneCardConfig).challengeRate ?? 2;
    const freshState = getArcaneCardDefaultState(rate);
    // Bump moveCount past the stalemated game's so the client's animation driver
    // recognizes it as a new state and swaps in the fresh shuffled decks.
    const oldMoveCount = (session.state as ArcaneCardState).moveCount ?? 0;
    freshState.moveCount = oldMoveCount + 1;
    const updated = await updateGameState(
      sessionId,
      freshState as unknown as Record<string, unknown>,
      null,
      oldMoveCount
    );
    if (!updated) {
      return NextResponse.json({ error: "Rematch already in progress" }, { status: 409 });
    }
    return NextResponse.json({
      state: sanitizeArcaneCardState(freshState),
      winner: null,
    });
  }

  if (session.designatedPlayer !== username) {
    return NextResponse.json({ error: "Not your game" }, { status: 403 });
  }

  if (session.winner) {
    return NextResponse.json({ error: "Game is already finished" }, { status: 400 });
  }

  // Dispatch to game-specific handler
  let result: { state: unknown; winner: string | null; error?: string };

  switch (session.gameType) {
    case "storm-queens-folly":
      result = handleStormQueensFollyMove(session, body);
      break;
    case "engineering-challenge":
      result = handleEngineeringChallengeMove(session, body);
      break;
    case "rune-poker":
      result = handleRunePokerMove(session, body);
      break;
    case "arcane-card":
      result = handleArcaneCardMove(session, body);
      break;
    case "isolation-protocol":
      result = handleIsolationProtocolMove(session, body);
      break;
    default:
      return NextResponse.json({ error: "Unknown game type" }, { status: 400 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // For arcane-card, use optimistic-concurrency guard on moveCount to prevent
  // two concurrent POSTs from both passing the in-memory moveVersion check and
  // clobbering each other's writes.
  const expectedMoveCount =
    session.gameType === "arcane-card"
      ? (session.state as ArcaneCardState).moveCount
      : session.gameType === "isolation-protocol"
      ? (session.state as IsolationProtocolState).moveCount
      : undefined;
  const updated = await updateGameState(
    sessionId,
    result.state as Record<string, unknown>,
    result.winner,
    expectedMoveCount
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Stale move — game has advanced" },
      { status: 409 }
    );
  }

  // Sanitize game-specific state for the client (hide opponent private info)
  let clientState = result.state;
  if (session.gameType === "arcane-card") {
    clientState = sanitizeArcaneCardState(result.state as ArcaneCardState);
  }

  return NextResponse.json({
    state: clientState,
    winner: result.winner,
  });
}
