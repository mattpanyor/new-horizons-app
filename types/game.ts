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
  // Cell the designated player has currently selected. Synced via the lightweight
  // "set-selection" action so observers see the same hover/destination preview.
  playerSelection?: Position | null;
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

// ─── Rune Poker config & state ───

export type Sigil = "flame" | "void" | "storm" | "earth" | "star" | "crown";

export type HandRank =
  | "nothing"
  | "one-pair"
  | "two-pair"
  | "three-of-a-kind"
  | "full-house"
  | "four-of-a-kind"
  | "straight"
  | "five-of-a-kind";

export type RunePokerPhase = "casting" | "keeping" | "showdown" | "round-end";

export interface RunePokerConfig {
  challengeRate: 1 | 2 | 3;
  roundCount: 1 | 3 | 5;
  opponentEntityId: number | null;
}

export interface RunePokerState {
  round: number;
  playerWins: number;
  opponentWins: number;
  phase: RunePokerPhase;
  castsRemaining: number;
  playerCoins: Sigil[];
  opponentCoins: Sigil[];
  lockedCoins: boolean[];
  opponentLockedCoins: boolean[];
  playerHand: HandRank | null;
  opponentHand: HandRank | null;
}

// ─── Arcane Card config & state ───

export type SideCardKind = "positive" | "negative" | "mixed";

export interface SideCard {
  id: string;                                       // unique within match, e.g. "s0".."s9"
  kind: SideCardKind;
  value: number;                                    // 1..6, magnitude
}

export type PlayedCard =
  | { kind: "main"; value: number }                                                   // 1..10
  | { kind: "side"; card: SideCard; playedAs: "positive" | "negative" };

export interface ArcaneCardPlayerState {
  mainDeck: number[];                               // remaining cards, top = index 0
  hand: SideCard[];                                 // current hand (0..4)
  played: PlayedCard[];                             // ordered committed cards
  standing: boolean;
}

export interface ArcaneCardConfig {
  challengeRate: 1 | 2 | 3;
  opponentEntityId: number | null;
}

export interface ArcaneCardState {
  player: ArcaneCardPlayerState;
  opponent: ArcaneCardPlayerState;
  turn: "player" | "opponent";
  moveCount: number;                                // strictly increasing, used for moveVersion staleness check
  // Card the designated player has currently selected and how it would be played.
  // Synced via "set-preview" so observers see the deliberation, cleared on commit.
  playerSelection?: { cardId: string; playAs: "positive" | "negative" } | null;
}

// ─── Isolation Protocol config & state ───

export type IsolationShape = "hexagonal" | "wide" | "triangular";

export interface HexCoord {
  q: number;
  r: number;
}

export interface IsolationProtocolConfig {
  shape: IsolationShape;
  initialShields: HexCoord[];
  opponentEntityId: number | null;
}

// One complete move event (one player POST): the shield placed plus, if the
// enemy had a legal response, its hop. Bounded ring buffer on the state so
// spectators polling at 2s can replay any steps they missed.
export interface IsolationMoveEvent {
  moveCount: number;               // moveCount AFTER this event was applied
  shield: HexCoord;
  enemyFrom: HexCoord | null;      // null when the player's shield surrounded the enemy
  enemyTo: HexCoord | null;
}

export interface IsolationProtocolState {
  enemy: HexCoord;
  shields: HexCoord[];             // all shields: pre-placed + player-placed
  turn: "player" | "opponent";
  moveCount: number;
  lastEnemyMove: HexCoord | null;  // previous enemy position, for single-step animation
  recentMoves: IsolationMoveEvent[]; // last ~24 events, oldest first — for spectator replay
}

// ─── Session ───

export type GameType =
  | "storm-queens-folly"
  | "engineering-challenge"
  | "rune-poker"
  | "arcane-card"
  | "isolation-protocol";
export type GameStatus = "configured" | "launched" | "finished";

// Generic config/state — the DB stores these as JSONB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameConfig =
  | StormQueensFollyConfig
  | EngineeringChallengeConfig
  | RunePokerConfig
  | ArcaneCardConfig
  | IsolationProtocolConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Record<string, any>;
export type GameState =
  | StormQueensFollyState
  | EngineeringChallengeState
  | RunePokerState
  | ArcaneCardState
  | IsolationProtocolState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Record<string, any>;

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
