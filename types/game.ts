// ─── Board primitives ───

export type Position = [row: number, col: number];
export type PieceOwner = "player" | "opponent";
export type CellState = PieceOwner | null;
export type Board = CellState[][];

export interface GameMove {
  from: Position;
  to: Position;
}

// ─── Game config & state ───

export interface StormQueensFollyConfig {
  challengeRate: 1 | 2 | 3;
  initialBoard: Board;
  opponentEntityId: number | null;
}

export interface StormQueensFollyState {
  board: Board;
  turn: PieceOwner;
  moveHistory: GameMove[];
}

// ─── Session ───

export type GameType = "storm-queens-folly";
export type GameStatus = "configured" | "launched" | "finished";

export interface GameSession {
  id: number;
  gameType: GameType;
  status: GameStatus;
  config: StormQueensFollyConfig;
  state: StormQueensFollyState;
  designatedPlayer: string | null;
  winner: PieceOwner | "draw" | null;
  createdAt: string;
  launchedAt: string | null;
  finishedAt: string | null;
}

// ─── API responses ───

export interface ActiveGameResponse {
  active: true;
  session: Omit<GameSession, "config"> & {
    config: Omit<StormQueensFollyConfig, "challengeRate">;
  };
  player: {
    username: string;
    character: string | null;
    role: string | null;
    imageUrl: string | null;
    group: string | null;
  };
  opponent: {
    name: string;
    imageUrl: string | null;
    title: string | null;
  } | null;
}

export interface NoActiveGameResponse {
  active: false;
}

export interface MoveResponse {
  state: StormQueensFollyState;
  winner: PieceOwner | "draw" | null;
}
