import type {
  GameSession,
  HexCoord,
  IsolationMoveEvent,
  IsolationProtocolConfig,
  IsolationProtocolState,
  IsolationShape,
} from "@/types/game";

const RECENT_MOVES_MAX = 8;

// ─── Axial hex helpers ───

const NEIGHBOR_DIRS: ReadonlyArray<HexCoord> = [
  { q: +1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: +1 },
  { q: 0, r: -1 },
  { q: +1, r: -1 },
  { q: -1, r: +1 },
];

function keyOf(c: HexCoord): string {
  return `${c.q},${c.r}`;
}

function eqCoord(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

export function neighbors(c: HexCoord): HexCoord[] {
  return NEIGHBOR_DIRS.map((d) => ({ q: c.q + d.q, r: c.r + d.r }));
}

// ─── Shape definitions ───
//
// Each shape produces:
//   cells:   the full set of playable hex coords (as a Map keyed by `q,r`)
//   center:  the starting hex for the enemy
//   borders: cells where the enemy "escapes" upon arrival
//
// A cell is a border cell iff at least one of its 6 hex-neighbors is NOT in the
// shape's cell set.

export interface ShapeData {
  cells: HexCoord[];
  cellSet: Set<string>;
  center: HexCoord;
  borderSet: Set<string>;
}

const HEXAGONAL_RADIUS = 5; // 91-cell board
const WIDE_COLS = 13;
const WIDE_ROWS = 7;
const TRIANGULAR_SIZE = 9; // q+r ≤ 9 with q,r ≥ 0 → 55 cells; divisible by 3 so
                           // the centroid cell (3,3) sits 3 hexes from every edge.

function offsetToAxial(col: number, row: number): HexCoord {
  // odd-r offset → axial
  return { q: col - (row - (row & 1)) / 2, r: row };
}

function buildShapeData(shape: IsolationShape): ShapeData {
  const cells: HexCoord[] = [];
  let center: HexCoord = { q: 0, r: 0 };

  if (shape === "hexagonal") {
    for (let q = -HEXAGONAL_RADIUS; q <= HEXAGONAL_RADIUS; q++) {
      for (let r = -HEXAGONAL_RADIUS; r <= HEXAGONAL_RADIUS; r++) {
        const s = -q - r;
        if (Math.abs(s) <= HEXAGONAL_RADIUS) cells.push({ q, r });
      }
    }
    center = { q: 0, r: 0 };
  } else if (shape === "wide") {
    for (let row = 0; row < WIDE_ROWS; row++) {
      for (let col = 0; col < WIDE_COLS; col++) {
        cells.push(offsetToAxial(col, row));
      }
    }
    center = offsetToAxial(Math.floor(WIDE_COLS / 2), Math.floor(WIDE_ROWS / 2));
  } else {
    // triangular: q+r ≤ SIZE, q ≥ 0, r ≥ 0
    for (let q = 0; q <= TRIANGULAR_SIZE; q++) {
      for (let r = 0; r <= TRIANGULAR_SIZE - q; r++) {
        cells.push({ q, r });
      }
    }
    // Centroid-ish pick: floor(SIZE/3) from each edge
    const c = Math.floor(TRIANGULAR_SIZE / 3);
    center = { q: c, r: c };
  }

  const cellSet = new Set(cells.map(keyOf));
  const borderSet = new Set<string>();
  for (const c of cells) {
    for (const n of neighbors(c)) {
      if (!cellSet.has(keyOf(n))) {
        borderSet.add(keyOf(c));
        break;
      }
    }
  }

  return { cells, cellSet, center, borderSet };
}

// Cache shape data — shapes are pure functions of the enum.
const SHAPE_CACHE: Partial<Record<IsolationShape, ShapeData>> = {};

export function getShapeData(shape: IsolationShape): ShapeData {
  const cached = SHAPE_CACHE[shape];
  if (cached) return cached;
  const data = buildShapeData(shape);
  SHAPE_CACHE[shape] = data;
  return data;
}

// ─── Defaults (for registry) ───

export function getDefaultConfig(): IsolationProtocolConfig {
  return {
    shape: "hexagonal",
    initialShields: [],
    opponentEntityId: null,
  };
}

export function getDefaultState(config?: Partial<IsolationProtocolConfig>): IsolationProtocolState {
  const shape = config?.shape ?? "hexagonal";
  const shapeData = getShapeData(shape);
  const initial = config?.initialShields ?? [];
  // Defensive: strip any shield that coincides with the enemy start, any duplicate,
  // or any coord that isn't on the board.
  const seen = new Set<string>();
  const shields: HexCoord[] = [];
  for (const s of initial) {
    const k = keyOf(s);
    if (seen.has(k)) continue;
    if (!shapeData.cellSet.has(k)) continue;
    if (eqCoord(s, shapeData.center)) continue;
    seen.add(k);
    shields.push({ q: s.q, r: s.r });
  }
  return {
    enemy: { ...shapeData.center },
    shields,
    turn: "player",
    moveCount: 0,
    lastEnemyMove: null,
    recentMoves: [],
  };
}

// Append an event to the ring buffer, trimming to the last RECENT_MOVES_MAX.
function pushEvent(
  state: IsolationProtocolState,
  event: IsolationMoveEvent
): IsolationMoveEvent[] {
  const prev = Array.isArray(state.recentMoves) ? state.recentMoves : [];
  const next = [...prev, event];
  if (next.length > RECENT_MOVES_MAX) next.splice(0, next.length - RECENT_MOVES_MAX);
  return next;
}

// ─── BFS / AI ───

// Compute the distance from each cell to the nearest border cell, treating
// shielded cells (and any blocked cells passed in) as walls. Unreachable cells
// are absent from the map.
function computeEscapeDistances(
  shapeData: ShapeData,
  blocked: Set<string>
): Map<string, number> {
  const dist = new Map<string, number>();
  const queue: HexCoord[] = [];

  // Seed with every non-blocked border cell at distance 0.
  for (const k of shapeData.borderSet) {
    if (blocked.has(k)) continue;
    const [q, r] = k.split(",").map(Number);
    dist.set(k, 0);
    queue.push({ q, r });
  }

  // Standard BFS outward.
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curKey = keyOf(cur);
    const d = dist.get(curKey)!;
    for (const n of neighbors(cur)) {
      const k = keyOf(n);
      if (!shapeData.cellSet.has(k)) continue;
      if (blocked.has(k)) continue;
      if (dist.has(k)) continue;
      dist.set(k, d + 1);
      queue.push(n);
    }
  }

  return dist;
}

// AI: pick the neighbor that minimises distance-to-border. Tie-break deterministically
// by (q, r) to keep replay consistent. Returns null if no legal move exists.
function pickEnemyMove(
  state: IsolationProtocolState,
  shape: IsolationShape
): HexCoord | null {
  const shapeData = getShapeData(shape);
  const shieldSet = new Set(state.shields.map(keyOf));

  // The enemy itself is not a wall for BFS purposes — but since we want the
  // distance from each neighbor to the border (not through the enemy), we do
  // not block the enemy's cell.
  const dist = computeEscapeDistances(shapeData, shieldSet);

  const candidates: { pos: HexCoord; d: number }[] = [];
  for (const n of neighbors(state.enemy)) {
    const k = keyOf(n);
    if (!shapeData.cellSet.has(k)) continue;
    if (shieldSet.has(k)) continue;
    // If this neighbor is itself a border cell, the enemy escapes here (d=0).
    // If it isn't reachable from any border (fully walled off), skip it — the
    // enemy would strand itself by moving there.
    const d = dist.get(k);
    if (d === undefined) continue;
    candidates.push({ pos: n, d });
  }

  if (candidates.length === 0) {
    // All reachable moves are into dead-ends or blocked. If ANY legal move
    // exists even into a stranded pocket, take the one with the smallest
    // (q, r) to keep behaviour deterministic (extremely rare edge case where
    // escape distances are all undefined).
    const anyLegal: HexCoord[] = [];
    for (const n of neighbors(state.enemy)) {
      const k = keyOf(n);
      if (!shapeData.cellSet.has(k)) continue;
      if (shieldSet.has(k)) continue;
      anyLegal.push(n);
    }
    if (anyLegal.length === 0) return null;
    anyLegal.sort((a, b) => a.q - b.q || a.r - b.r);
    return anyLegal[0];
  }

  candidates.sort((a, b) => a.d - b.d || a.pos.q - b.pos.q || a.pos.r - b.pos.r);
  return candidates[0].pos;
}

// ─── Move handler ───

interface IsolationMoveBody {
  moveVersion?: number;
  shield?: HexCoord;
}

export function handleIsolationProtocolMove(
  session: GameSession,
  body: IsolationMoveBody
): { state: IsolationProtocolState; winner: string | null; error?: string } {
  const state = session.state as IsolationProtocolState;
  const config = session.config as IsolationProtocolConfig;
  const shapeData = getShapeData(config.shape);
  const { moveVersion, shield } = body;

  if (typeof moveVersion === "number" && moveVersion !== state.moveCount) {
    return { state, winner: null, error: "Stale move — game has advanced" };
  }
  if (state.turn !== "player") {
    return { state, winner: null, error: "Not your turn" };
  }
  if (!shield || typeof shield.q !== "number" || typeof shield.r !== "number") {
    return { state, winner: null, error: "shield coordinate required" };
  }

  const shieldKey = keyOf(shield);
  if (!shapeData.cellSet.has(shieldKey)) {
    return { state, winner: null, error: "Shield placed outside the field" };
  }
  if (eqCoord(shield, state.enemy)) {
    return { state, winner: null, error: "Cannot shield the enemy's current cell" };
  }
  const shieldSet = new Set(state.shields.map(keyOf));
  if (shieldSet.has(shieldKey)) {
    return { state, winner: null, error: "Cell already shielded" };
  }

  // Apply the player's shield.
  const nextShields: HexCoord[] = [...state.shields, { q: shield.q, r: shield.r }];

  // Check immediate win: enemy has no legal moves after this shield is placed.
  const newShieldSet = new Set(nextShields.map(keyOf));
  const hasAnyMove = neighbors(state.enemy).some((n) => {
    const k = keyOf(n);
    return shapeData.cellSet.has(k) && !newShieldSet.has(k);
  });

  if (!hasAnyMove) {
    const newMoveCount = state.moveCount + 1;
    const event: IsolationMoveEvent = {
      moveCount: newMoveCount,
      shield: { q: shield.q, r: shield.r },
      enemyFrom: null,
      enemyTo: null,
    };
    const finalState: IsolationProtocolState = {
      ...state,
      shields: nextShields,
      turn: "player",
      moveCount: newMoveCount,
      lastEnemyMove: null,
      recentMoves: pushEvent(state, event),
    };
    return { state: finalState, winner: "player" };
  }

  // AI moves.
  const intermediate: IsolationProtocolState = {
    ...state,
    shields: nextShields,
    turn: "opponent",
    moveCount: state.moveCount + 1,
    lastEnemyMove: null,
  };

  const enemyMove = pickEnemyMove(intermediate, config.shape);
  if (!enemyMove) {
    // AI is stuck — treat as player win (defensive; hasAnyMove check above should
    // already catch this).
    const event: IsolationMoveEvent = {
      moveCount: intermediate.moveCount,
      shield: { q: shield.q, r: shield.r },
      enemyFrom: null,
      enemyTo: null,
    };
    return {
      state: {
        ...intermediate,
        turn: "player",
        recentMoves: pushEvent(state, event),
      },
      winner: "player",
    };
  }

  const previousEnemy = state.enemy;
  const newMoveCount = intermediate.moveCount + 1;
  const event: IsolationMoveEvent = {
    moveCount: newMoveCount,
    shield: { q: shield.q, r: shield.r },
    enemyFrom: { ...previousEnemy },
    enemyTo: { ...enemyMove },
  };
  const finalState: IsolationProtocolState = {
    ...intermediate,
    enemy: enemyMove,
    lastEnemyMove: previousEnemy,
    turn: "player",
    moveCount: newMoveCount,
    recentMoves: pushEvent(state, event),
  };

  // Enemy escaped?
  if (shapeData.borderSet.has(keyOf(enemyMove))) {
    return { state: finalState, winner: "opponent" };
  }

  return { state: finalState, winner: null };
}
