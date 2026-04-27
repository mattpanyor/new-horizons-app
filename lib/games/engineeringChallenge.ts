import type {
  Position,
  GameSession,
  EngineeringChallengeConfig,
  EngineeringChallengeState,
  WirePath,
  ECPair,
} from "@/types/game";
import boardsData from "@/content/games/engineering-challenge/boards.json";

// ─── Wire colors ───

export const WIRE_COLORS = [
  { name: "Cyan", hex: "#22D3EE" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Green", hex: "#22C55E" },
  { name: "Red", hex: "#EF4444" },
  { name: "Purple", hex: "#A855F7" },
  { name: "White", hex: "#E2E8F0" },
];

// ─── Board selection ───

interface BoardDef {
  id: string;
  wireCount: number;
  difficulty: string;
  pairs: { a: number[]; b: number[] }[];
}

export function getRandomBoard(wireCount: number, difficulty: "easy" | "normal" | "hard"): {
  pairs: ECPair[];
  gridRows: number;
  gridCols: number;
} | null {
  const matching = (boardsData.boards as BoardDef[]).filter(
    (b) => b.wireCount === wireCount && b.difficulty === difficulty
  );
  if (matching.length === 0) return null;
  const board = matching[Math.floor(Math.random() * matching.length)];
  return {
    pairs: board.pairs.map((p) => ({
      a: p.a as Position,
      b: p.b as Position,
    })),
    gridRows: boardsData.gridRows,
    gridCols: boardsData.gridCols,
  };
}

// ─── Defaults ───

export function getDefaultConfig(wireCount: number = 4): EngineeringChallengeConfig {
  const board = getRandomBoard(wireCount, "normal");
  return {
    wireCount,
    difficulty: "normal",
    timeLimit: 90,
    gridRows: board?.gridRows ?? 12,
    gridCols: board?.gridCols ?? 14,
    pairs: board?.pairs ?? [],
    opponentEntityId: null,
  };
}

export function getDefaultState(): EngineeringChallengeState {
  return {
    wires: [],
    startTime: null,
    completed: false,
  };
}

// ─── Validation ───

function posKey(p: Position): string {
  return `${p[0]},${p[1]}`;
}

export function isValidWirePlacement(
  state: EngineeringChallengeState,
  config: EngineeringChallengeConfig,
  wire: WirePath
): string | null {
  const { gridRows, gridCols, pairs } = config;

  if (wire.cells.length < 2) return "Wire too short";

  // Check all cells are in bounds
  for (const [r, c] of wire.cells) {
    if (r < 0 || r >= gridRows || c < 0 || c >= gridCols) {
      return "Wire goes out of bounds";
    }
  }

  // Check consecutive cells are adjacent (cardinal only)
  for (let i = 1; i < wire.cells.length; i++) {
    const [pr, pc] = wire.cells[i - 1];
    const [cr, cc] = wire.cells[i];
    const dr = Math.abs(cr - pr);
    const dc = Math.abs(cc - pc);
    if (dr + dc !== 1) return "Wire must follow cardinal directions";
  }

  // No cell may appear twice — including the path looping back through its own
  // start or end endpoint. The client already enforces this; the server check
  // is defense-in-depth so a hand-crafted POST can't produce a tangled wire.
  const seen = new Set<string>();
  for (const cell of wire.cells) {
    const k = posKey(cell);
    if (seen.has(k)) return "Wire crosses itself";
    seen.add(k);
  }

  // Check no overlap with existing wires (except the wire being replaced)
  const occupied = new Set<string>();
  for (const existing of state.wires) {
    if (existing.wireIndex === wire.wireIndex) continue;
    for (const cell of existing.cells) {
      occupied.add(posKey(cell));
    }
  }
  // Also block other pair endpoints
  for (let i = 0; i < pairs.length; i++) {
    if (i === wire.wireIndex) continue;
    occupied.add(posKey(pairs[i].a));
    occupied.add(posKey(pairs[i].b));
  }
  // Check wire cells don't overlap (skip first and last which are endpoints)
  for (let i = 1; i < wire.cells.length - 1; i++) {
    if (occupied.has(posKey(wire.cells[i]))) {
      return "Wire crosses another wire or endpoint";
    }
  }

  // Check start matches one endpoint and end matches the other
  const pair = pairs[wire.wireIndex];
  if (!pair) return "Invalid wire index";

  const first = wire.cells[0];
  const last = wire.cells[wire.cells.length - 1];

  const startsAtA = first[0] === pair.a[0] && first[1] === pair.a[1];
  const startsAtB = first[0] === pair.b[0] && first[1] === pair.b[1];
  if (!startsAtA && !startsAtB) return "Wire must start at one of its endpoints";

  if (wire.complete) {
    const targetEnd = startsAtA ? pair.b : pair.a;
    if (last[0] !== targetEnd[0] || last[1] !== targetEnd[1]) {
      return "Wire must end at the matching endpoint";
    }
  }

  return null;
}

export function checkAllWiresComplete(state: EngineeringChallengeState, config: EngineeringChallengeConfig): boolean {
  if (state.wires.filter((w) => w.complete).length !== config.wireCount) return false;
  return true;
}

// ─── Move handler ───

export function handleEngineeringChallengeMove(
  session: GameSession,
  body: { action?: string; wireIndex?: number; cells?: Position[]; complete?: boolean }
): { state: EngineeringChallengeState; winner: string | null; error?: string } {
  const state = session.state as EngineeringChallengeState;
  const config = session.config as EngineeringChallengeConfig;
  const { action, wireIndex, cells, complete } = body;

  // Start timer on first move
  let startTime = state.startTime;
  if (!startTime) {
    startTime = new Date().toISOString();
  }

  // Check timeout
  if (config.timeLimit > 0 && startTime) {
    const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
    if (elapsed >= config.timeLimit) {
      return {
        state: { ...state, startTime },
        winner: "timeout",
      };
    }
  }

  if (action === "place-wire") {
    if (wireIndex === undefined || !cells || !Array.isArray(cells)) {
      return { state, winner: null, error: "wireIndex and cells are required" };
    }
    if (wireIndex < 0 || wireIndex >= config.wireCount) {
      return { state, winner: null, error: "Invalid wire index" };
    }

    const wire: WirePath = {
      wireIndex,
      cells,
      complete: !!complete,
    };

    const validationError = isValidWirePlacement(state, config, wire);
    if (validationError) {
      return { state, winner: null, error: validationError };
    }

    const newWires = state.wires.filter((w) => w.wireIndex !== wireIndex);
    newWires.push(wire);

    const newState: EngineeringChallengeState = {
      wires: newWires,
      startTime,
      completed: false,
    };

    if (checkAllWiresComplete(newState, config)) {
      newState.completed = true;
      return { state: newState, winner: "player" };
    }

    return { state: newState, winner: null };
  }

  if (action === "remove-wire") {
    if (wireIndex === undefined) {
      return { state, winner: null, error: "wireIndex is required" };
    }
    const newWires = state.wires.filter((w) => w.wireIndex !== wireIndex);
    return {
      state: { wires: newWires, startTime, completed: false },
      winner: null,
    };
  }

  return { state, winner: null, error: "Unknown action" };
}
