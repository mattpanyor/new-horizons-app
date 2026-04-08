// ─── Board primitives (Storm Queen's Folly) ───

export type Position = [row: number, col: number];
export type PieceOwner = "player" | "opponent";
export type CellState = PieceOwner | null;
export type Board = CellState[][];

export interface GameMove {
  from: Position;
  to: Position;
}

// ─── Storm Queen's Folly config & state ───

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

// ─── Engineering Challenge config & state ───

export interface WirePath {
  wireIndex: number;       // which wire pair (0-based)
  cells: Position[];       // ordered list of cells the wire passes through
  complete: boolean;       // true if connected to end node
}

export interface ECPair {
  a: Position;
  b: Position;
}

export interface EngineeringChallengeConfig {
  wireCount: number;       // 3-6
  difficulty: "easy" | "normal" | "hard";
  timeLimit: number;       // seconds (0 = unlimited)
  gridRows: number;
  gridCols: number;
  pairs: ECPair[];         // endpoint pairs for this puzzle
  opponentEntityId: number | null;
}

export interface EngineeringChallengeState {
  wires: WirePath[];       // placed wires
  startTime: string | null; // ISO timestamp when game started
  completed: boolean;       // all wires connected
}

// ─── Session ───

export type GameType = "storm-queens-folly" | "engineering-challenge";
export type GameStatus = "configured" | "launched" | "finished";

// Generic config/state — the DB stores these as JSONB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameConfig = StormQueensFollyConfig | EngineeringChallengeConfig | Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameState = StormQueensFollyState | EngineeringChallengeState | Record<string, any>;

export type WinnerValue = PieceOwner | "draw" | "player" | "timeout" | null;

export interface GameSession {
  id: number;
  gameType: GameType;
  status: GameStatus;
  config: GameConfig;
  state: GameState;
  designatedPlayer: string | null;
  winner: string | null;
  createdAt: string;
  launchedAt: string | null;
  finishedAt: string | null;
}

// ─── API responses ───

export interface ActiveGameResponse {
  active: true;
  session: GameSession;
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
  state: GameState;
  winner: string | null;
}
