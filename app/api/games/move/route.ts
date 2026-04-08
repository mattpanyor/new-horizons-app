import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { getGameSession, updateGameState } from "@/lib/db/games";
import { handleStormQueensFollyMove } from "@/lib/games/stormQueensFolly";
import { handleEngineeringChallengeMove } from "@/lib/games/engineeringChallenge";

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
  if (session.winner) {
    return NextResponse.json({ error: "Game is already finished" }, { status: 400 });
  }
  if (session.designatedPlayer !== username) {
    return NextResponse.json({ error: "Not your game" }, { status: 403 });
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
    default:
      return NextResponse.json({ error: "Unknown game type" }, { status: 400 });
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await updateGameState(sessionId, result.state as Record<string, unknown>, result.winner);

  return NextResponse.json({
    state: result.state,
    winner: result.winner,
  });
}
