import { neon } from "@neondatabase/serverless";
import type {
  GameSession,
  GameType,
  GameConfig,
  GameState,
} from "@/types/game";

const sql = neon(process.env.DATABASE_URL!);

function rowToSession(row: Record<string, unknown>): GameSession {
  return {
    id: row.id as number,
    gameType: row.game_type as GameType,
    status: row.status as GameSession["status"],
    config: row.config as GameConfig,
    state: row.state as GameState,
    designatedPlayer: (row.designated_player as string) ?? null,
    winner: (row.winner as string) ?? null,
    createdAt: row.created_at as string,
    launchedAt: (row.launched_at as string) ?? null,
    finishedAt: (row.finished_at as string) ?? null,
  };
}

export async function getAllGameSessions(): Promise<GameSession[]> {
  const rows = await sql`
    SELECT * FROM game_sessions ORDER BY created_at DESC
  `;
  return rows.map(rowToSession);
}

export async function getGameSession(id: number): Promise<GameSession | null> {
  const rows = await sql`
    SELECT * FROM game_sessions WHERE id = ${id}
  `;
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

export async function getActiveGame(): Promise<GameSession | null> {
  const rows = await sql`
    SELECT * FROM game_sessions WHERE status = 'launched' LIMIT 1
  `;
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

export async function createGameSession(fields: {
  gameType: GameType;
  config: GameConfig;
  state: GameState;
  designatedPlayer: string;
}): Promise<GameSession> {
  const rows = await sql`
    INSERT INTO game_sessions (game_type, config, state, designated_player)
    VALUES (
      ${fields.gameType},
      ${JSON.stringify(fields.config)},
      ${JSON.stringify(fields.state)},
      ${fields.designatedPlayer}
    )
    RETURNING *
  `;
  return rowToSession(rows[0]);
}

export async function updateGameSession(
  id: number,
  fields: {
    config: GameConfig;
    state: GameState;
    designatedPlayer: string;
  }
): Promise<GameSession | null> {
  const rows = await sql`
    UPDATE game_sessions SET
      config = ${JSON.stringify(fields.config)},
      state = ${JSON.stringify(fields.state)},
      designated_player = ${fields.designatedPlayer}
    WHERE id = ${id} AND status IN ('configured', 'finished')
    RETURNING *
  `;
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

export async function deleteGameSession(id: number): Promise<boolean> {
  const rows = await sql`
    DELETE FROM game_sessions WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export async function launchGameSession(id: number): Promise<GameSession | null> {
  // Check no other game is launched
  const active = await getActiveGame();
  if (active && active.id !== id) return null;

  const rows = await sql`
    UPDATE game_sessions SET
      status = 'launched',
      launched_at = NOW(),
      winner = NULL
    WHERE id = ${id} AND status IN ('configured', 'finished')
    RETURNING *
  `;
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

export async function stopGameSession(id: number): Promise<GameSession | null> {
  const rows = await sql`
    UPDATE game_sessions SET
      status = 'finished',
      finished_at = NOW()
    WHERE id = ${id} AND status = 'launched'
    RETURNING *
  `;
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

export async function updateGameState(
  id: number,
  state: GameState,
  winner?: string | null,
  expectedMoveCount?: number
): Promise<GameSession | null> {
  const rows =
    typeof expectedMoveCount === "number"
      ? await sql`
          UPDATE game_sessions SET
            state = ${JSON.stringify(state)},
            winner = ${winner ?? null}
          WHERE id = ${id}
            AND status = 'launched'
            AND (state->>'moveCount')::int = ${expectedMoveCount}
          RETURNING *
        `
      : await sql`
          UPDATE game_sessions SET
            state = ${JSON.stringify(state)},
            winner = ${winner ?? null}
          WHERE id = ${id} AND status = 'launched'
          RETURNING *
        `;
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}
