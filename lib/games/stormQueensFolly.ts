import type { Board, Position, PieceOwner, GameMove, CellState, GameSession, StormQueensFollyState, StormQueensFollyConfig } from "@/types/game";

// ─── Adjacency map ───
// Center connects to all 8, edges to 3, corners to center + 2 orthogonal neighbors

const ADJACENCY: Record<string, Position[]> = {
  "0,0": [[0, 1], [1, 0], [1, 1]],
  "0,1": [[0, 0], [0, 2], [1, 1]],
  "0,2": [[0, 1], [1, 2], [1, 1]],
  "1,0": [[0, 0], [1, 1], [2, 0]],
  "1,1": [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
  "1,2": [[0, 2], [1, 1], [2, 2]],
  "2,0": [[1, 0], [1, 1], [2, 1]],
  "2,1": [[2, 0], [2, 2], [1, 1]],
  "2,2": [[2, 1], [1, 2], [1, 1]],
};

function posKey(p: Position): string {
  return `${p[0]},${p[1]}`;
}

// ─── Win lines (8 possible) ───

const WIN_LINES: Position[][] = [
  // Rows
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  // Columns
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  // Diagonals
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];

// ─── Public functions ───

export function getDefaultBoard(): Board {
  return [
    [null, null, "opponent"],
    ["opponent", "player", "player"],
    ["player", "opponent", null],
  ];
}

export function getAdjacentPositions(pos: Position): Position[] {
  return ADJACENCY[posKey(pos)] ?? [];
}

export function getValidMoves(board: Board, owner: PieceOwner): GameMove[] {
  const moves: GameMove[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[r][c] !== owner) continue;
      const from: Position = [r, c];
      for (const to of getAdjacentPositions(from)) {
        if (board[to[0]][to[1]] === null) {
          moves.push({ from, to });
        }
      }
    }
  }
  return moves;
}

export function applyMove(board: Board, move: GameMove): Board {
  const newBoard: Board = board.map((row) => [...row]);
  const piece = newBoard[move.from[0]][move.from[1]];
  newBoard[move.from[0]][move.from[1]] = null;
  newBoard[move.to[0]][move.to[1]] = piece;
  return newBoard;
}

export function checkWin(board: Board): PieceOwner | null {
  for (const line of WIN_LINES) {
    const cells: CellState[] = line.map(([r, c]) => board[r][c]);
    if (cells[0] && cells[0] === cells[1] && cells[1] === cells[2]) {
      return cells[0];
    }
  }
  return null;
}

export function isValidMove(board: Board, move: GameMove, owner: PieceOwner): boolean {
  const { from, to } = move;
  // Check bounds
  if (from[0] < 0 || from[0] > 2 || from[1] < 0 || from[1] > 2) return false;
  if (to[0] < 0 || to[0] > 2 || to[1] < 0 || to[1] > 2) return false;
  // Must be moving own piece
  if (board[from[0]][from[1]] !== owner) return false;
  // Destination must be empty
  if (board[to[0]][to[1]] !== null) return false;
  // Must be adjacent
  const adj = getAdjacentPositions(from);
  return adj.some((p) => p[0] === to[0] && p[1] === to[1]);
}

// ─── AI (minimax with alpha-beta pruning) ───

const DEPTH_BY_RATE: Record<number, number> = { 1: 1, 2: 3, 3: 5 };

function evaluate(board: Board): number {
  const winner = checkWin(board);
  if (winner === "opponent") return 100;
  if (winner === "player") return -100;

  // Heuristic: count lines where opponent has 2 and empty 1 vs player has 2 and empty 1
  let score = 0;
  for (const line of WIN_LINES) {
    const cells = line.map(([r, c]) => board[r][c]);
    const opp = cells.filter((c) => c === "opponent").length;
    const plr = cells.filter((c) => c === "player").length;
    const empty = cells.filter((c) => c === null).length;
    if (opp === 2 && empty === 1) score += 10;
    if (plr === 2 && empty === 1) score -= 10;
  }
  return score;
}

function minimax(
  board: Board,
  depth: number,
  isMaximizing: boolean,
  alpha: number,
  beta: number
): number {
  const winner = checkWin(board);
  if (winner) return winner === "opponent" ? 100 : -100;

  const owner: PieceOwner = isMaximizing ? "opponent" : "player";
  const moves = getValidMoves(board, owner);

  // No moves = stalemate for this side
  if (moves.length === 0) return 0;

  if (depth === 0) return evaluate(board);

  if (isMaximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move);
      const val = minimax(newBoard, depth - 1, false, alpha, beta);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move);
      const val = minimax(newBoard, depth - 1, true, alpha, beta);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function getAiMove(board: Board, challengeRate: number): GameMove | null {
  const depth = DEPTH_BY_RATE[challengeRate] ?? 3;
  const moves = getValidMoves(board, "opponent");

  if (moves.length === 0) return null;

  // Rate 1 (easy): random move
  if (challengeRate === 1) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const newBoard = applyMove(board, move);
    const score = minimax(newBoard, depth - 1, false, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// ─── Move handler (called from API route) ───

export function handleStormQueensFollyMove(
  session: GameSession,
  body: { from?: Position; to?: Position; moveVersion?: number }
): { state: StormQueensFollyState; winner: string | null; error?: string } {
  const state = session.state as StormQueensFollyState;
  const config = session.config as StormQueensFollyConfig;
  const { from, to, moveVersion } = body;

  if (!from || !to) {
    return { state, winner: null, error: "from and to are required" };
  }
  if (state.turn !== "player") {
    return { state, winner: null, error: "Not your turn" };
  }
  if (typeof moveVersion === "number" && moveVersion !== state.moveHistory.length) {
    return { state, winner: null, error: "Stale move — board has changed" };
  }

  const move: GameMove = { from, to };
  if (!isValidMove(state.board, move, "player")) {
    return { state, winner: null, error: "Invalid move" };
  }

  let board = applyMove(state.board, move);
  const history = [...state.moveHistory, move];
  let winner: string | null = checkWin(board);
  let turn: PieceOwner = "opponent";

  if (!winner) {
    const aiMove = getAiMove(board, config.challengeRate);
    if (aiMove) {
      board = applyMove(board, aiMove);
      history.push(aiMove);
      winner = checkWin(board);
      turn = "player";
      if (!winner && getValidMoves(board, "player").length === 0) {
        winner = "draw";
      }
    } else {
      winner = "draw";
      turn = "player";
    }
  }

  return {
    state: { board, turn, moveHistory: history },
    winner,
  };
}
