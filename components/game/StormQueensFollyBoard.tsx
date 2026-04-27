"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Position, Board, GameMove, PieceOwner, StormQueensFollyConfig, StormQueensFollyState } from "@/types/game";
import type { GameBoardProps } from "./gameComponents";
import GamePiece from "./GamePiece";
import PlayerPortrait from "./PlayerPortrait";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// Board layout: 9 nodes on a 3x3 grid
// Positions as percentages of the board container
const NODE_PCT: Record<string, { x: number; y: number }> = {
  "0,0": { x: 16.67, y: 16.67 },
  "0,1": { x: 50, y: 16.67 },
  "0,2": { x: 83.33, y: 16.67 },
  "1,0": { x: 16.67, y: 50 },
  "1,1": { x: 50, y: 50 },
  "1,2": { x: 83.33, y: 50 },
  "2,0": { x: 16.67, y: 83.33 },
  "2,1": { x: 50, y: 83.33 },
  "2,2": { x: 83.33, y: 83.33 },
};

// SVG coordinates for lines (300x300 viewbox)
const NODE_SVG: Record<string, { x: number; y: number }> = {
  "0,0": { x: 50, y: 50 },
  "0,1": { x: 150, y: 50 },
  "0,2": { x: 250, y: 50 },
  "1,0": { x: 50, y: 150 },
  "1,1": { x: 150, y: 150 },
  "1,2": { x: 250, y: 150 },
  "2,0": { x: 50, y: 250 },
  "2,1": { x: 150, y: 250 },
  "2,2": { x: 250, y: 250 },
};

const CONNECTIONS: [string, string][] = [
  ["0,0", "0,1"], ["0,1", "0,2"],
  ["1,0", "1,1"], ["1,1", "1,2"],
  ["2,0", "2,1"], ["2,1", "2,2"],
  ["0,0", "1,0"], ["1,0", "2,0"],
  ["0,1", "1,1"], ["1,1", "2,1"],
  ["0,2", "1,2"], ["1,2", "2,2"],
  ["0,0", "1,1"], ["1,1", "2,2"],
  ["0,2", "1,1"], ["1,1", "2,0"],
];

const ADJACENCY: Record<string, string[]> = {
  "0,0": ["0,1", "1,0", "1,1"],
  "0,1": ["0,0", "0,2", "1,1"],
  "0,2": ["0,1", "1,2", "1,1"],
  "1,0": ["0,0", "1,1", "2,0"],
  "1,1": ["0,0", "0,1", "0,2", "1,0", "1,2", "2,0", "2,1", "2,2"],
  "1,2": ["0,2", "1,1", "2,2"],
  "2,0": ["1,0", "1,1", "2,1"],
  "2,1": ["2,0", "2,2", "1,1"],
  "2,2": ["2,1", "1,2", "1,1"],
};

function posKey(r: number, c: number): string {
  return `${r},${c}`;
}

// ─── Piece tracking with stable IDs ───

interface TrackedPiece {
  id: string;
  owner: PieceOwner;
  pos: string; // "r,c"
}

function buildPiecesFromBoard(board: Board): TrackedPiece[] {
  const pieces: TrackedPiece[] = [];
  let pi = 0, oi = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = board[r][c];
      if (cell === "player") pieces.push({ id: `p${pi++}`, owner: "player", pos: posKey(r, c) });
      else if (cell === "opponent") pieces.push({ id: `o${oi++}`, owner: "opponent", pos: posKey(r, c) });
    }
  }
  return pieces;
}

function applyMoveToBoard(board: Board, move: GameMove): Board {
  const newBoard: Board = board.map((row) => [...row]);
  const piece = newBoard[move.from[0]][move.from[1]];
  newBoard[move.from[0]][move.from[1]] = null;
  newBoard[move.to[0]][move.to[1]] = piece;
  return newBoard;
}

function applyMoveToPieces(pieces: TrackedPiece[], move: GameMove): TrackedPiece[] {
  const fromKey = posKey(move.from[0], move.from[1]);
  const toKey = posKey(move.to[0], move.to[1]);
  return pieces.map((p) => p.pos === fromKey ? { ...p, pos: toKey } : p);
}

// ─── Component ───

const MOVE_ANIM_DURATION = 400; // ms per move animation
const MOVE_STAGGER_DELAY = 800; // ms between player and AI move

export default function StormQueensFollyBoard({
  session,
  player,
  opponent,
  isDesignatedPlayer,
  isMyTurn,
  victoryText,
}: GameBoardProps) {
  const sqfConfig = session.config as StormQueensFollyConfig;
  const sqfState = session.state as StormQueensFollyState;

  // Replay always starts from the configured initialBoard. Type guarantees this
  // exists on every session — no fallback to state.board, which would
  // double-apply moveHistory on top of an already-advanced position.
  const replayBoard: Board = sqfConfig.initialBoard;

  // latestState mirrors IP/AC: ingested from polling AND from POST responses,
  // so the player's own move animates immediately instead of waiting on the
  // 2-second poll cycle.
  //   - Polled state with moveHistory ≥ what we've stored: accept (covers a
  //     fresh move AND covers selection-only changes at the same move count).
  //   - Polled state shorter: ignore as a stale poll arriving after we've
  //     already ingested a POST response that moved us ahead.
  const [latestState, setLatestState] = useState<StormQueensFollyState>(sqfState);

  useEffect(() => {
    if (sqfState.moveHistory.length >= latestState.moveHistory.length) {
      setLatestState(sqfState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqfState]);

  // Local optimistic selection so the player's own clicks feel instant; falls
  // back to whatever the server has when not the designated player.
  const [localSelection, setLocalSelection] = useState<string | null>(null);
  const selectionSyncChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const [submitting, setSubmitting] = useState(false);

  // Animation state
  const lastMoveCountRef = useRef<number>(0);
  const [displayPieces, setDisplayPieces] = useState<TrackedPiece[]>(() => {
    let board = replayBoard;
    let pieces = buildPiecesFromBoard(board);
    for (const move of sqfState.moveHistory) {
      pieces = applyMoveToPieces(pieces, move);
      board = applyMoveToBoard(board, move);
    }
    return pieces;
  });
  const [displayBoard, setDisplayBoard] = useState<Board>(() => {
    let board = replayBoard;
    for (const move of sqfState.moveHistory) {
      board = applyMoveToBoard(board, move);
    }
    return board;
  });
  const [animating, setAnimating] = useState(false);
  const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Initialize lastMoveCountRef to current history length on first mount,
  // so that already-played moves aren't re-animated when joining mid-game.
  useEffect(() => {
    lastMoveCountRef.current = sqfState.moveHistory.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect new moves and animate them. Driven off latestState so POST responses
  // (not just polling) trigger animation immediately.
  useEffect(() => {
    const history = latestState.moveHistory;
    const lastKnown = lastMoveCountRef.current;
    const newMoves = history.slice(lastKnown);

    if (newMoves.length === 0) return;

    animTimeoutsRef.current.forEach((t) => clearTimeout(t));
    animTimeoutsRef.current = [];

    let boardAtLastKnown = replayBoard;
    let piecesAtLastKnown = buildPiecesFromBoard(boardAtLastKnown);
    for (let i = 0; i < lastKnown; i++) {
      boardAtLastKnown = applyMoveToBoard(boardAtLastKnown, history[i]);
      piecesAtLastKnown = applyMoveToPieces(piecesAtLastKnown, history[i]);
    }

    setAnimating(true);

    let currentBoard = boardAtLastKnown;
    let currentPieces = piecesAtLastKnown;

    newMoves.forEach((move, idx) => {
      const delay = idx * MOVE_STAGGER_DELAY;

      const timer = setTimeout(() => {
        currentPieces = applyMoveToPieces(currentPieces, move);
        currentBoard = applyMoveToBoard(currentBoard, move);
        setDisplayPieces([...currentPieces]);
        setDisplayBoard(currentBoard.map((row) => [...row]));

        if (idx === newMoves.length - 1) {
          const finalTimer = setTimeout(() => {
            setAnimating(false);
          }, MOVE_ANIM_DURATION);
          animTimeoutsRef.current.push(finalTimer);
        }
      }, delay);
      animTimeoutsRef.current.push(timer);
    });

    lastMoveCountRef.current = history.length;

    return () => {
      animTimeoutsRef.current.forEach((t) => clearTimeout(t));
      animTimeoutsRef.current = [];
    };
  }, [latestState, replayBoard]);

  // Resync display whenever the authoritative history is SHORTER than what
  // we've already animated. That covers (a) first-mount with empty history and
  // (b) any future rematch flow that resets moveHistory back toward zero.
  useEffect(() => {
    if (animating) return;
    if (latestState.moveHistory.length >= lastMoveCountRef.current) return;
    let board = replayBoard;
    let pieces = buildPiecesFromBoard(board);
    for (const move of latestState.moveHistory) {
      pieces = applyMoveToPieces(pieces, move);
      board = applyMoveToBoard(board, move);
    }
    setDisplayPieces(pieces);
    setDisplayBoard(board);
    lastMoveCountRef.current = latestState.moveHistory.length;
  }, [latestState.moveHistory, animating, replayBoard]);

  const canInteract = isDesignatedPlayer && isMyTurn && !submitting && !session.winner && !animating;

  // The selection rendered on screen: the designated player uses optimistic
  // local state for instant feedback; observers read from the server-synced
  // playerSelection so they see the same piece highlighted that the player is
  // currently considering.
  const effectiveSelection: string | null = isDesignatedPlayer
    ? localSelection
    : latestState.playerSelection
      ? posKey(latestState.playerSelection[0], latestState.playerSelection[1])
      : null;

  // Valid destinations for the displayed selection. We compute these for the
  // designated player AND for observers — observers see the same destination
  // dots the player is looking at. Memoized so handleNodeClick's deps are
  // stable across renders that don't actually change the destination set.
  const validDestinations = useMemo<Set<string>>(() => {
    const dest = new Set<string>();
    if (!effectiveSelection) return dest;
    const adj = ADJACENCY[effectiveSelection] ?? [];
    for (const key of adj) {
      const [r, c] = key.split(",").map(Number);
      if (displayBoard[r][c] === null) {
        dest.add(key);
      }
    }
    return dest;
  }, [effectiveSelection, displayBoard]);

  // Push selection changes to the server (fire-and-forget, ordered) so observers
  // see the highlight in roughly one poll interval.
  const syncSelection = useCallback(
    (sel: string | null) => {
      const selection: Position | null = sel
        ? (sel.split(",").map(Number) as Position)
        : null;
      selectionSyncChainRef.current = selectionSyncChainRef.current.then(() =>
        fetch("/api/games/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            action: "set-selection",
            selection,
          }),
        }).catch(() => {})
      );
    },
    [session.id]
  );

  const handleNodeClick = useCallback(async (r: number, c: number) => {
    if (!canInteract) return;

    const key = posKey(r, c);
    const cell = displayBoard[r][c];

    if (cell === "player") {
      const next = localSelection === key ? null : key;
      setLocalSelection(next);
      syncSelection(next);
      return;
    }

    if (cell === null && localSelection && validDestinations.has(key)) {
      const [fromR, fromC] = localSelection.split(",").map(Number);
      setSubmitting(true);
      setLocalSelection(null);

      try {
        const res = await fetch("/api/games/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            from: [fromR, fromC] as Position,
            to: [r, c] as Position,
            moveVersion: latestState.moveHistory.length,
          }),
        });
        if (res.ok) {
          // Ingest server's authoritative new state immediately so the player's
          // own move animates without waiting for the next poll.
          const data = await res.json().catch(() => null);
          if (
            data?.state &&
            (data.state as StormQueensFollyState).moveHistory.length >
              latestState.moveHistory.length
          ) {
            setLatestState(data.state as StormQueensFollyState);
          }
        } else {
          const data = await res.json().catch(() => null);
          console.error("Move failed:", data?.error);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (localSelection) {
      setLocalSelection(null);
      syncSelection(null);
    }
  }, [canInteract, displayBoard, localSelection, validDestinations, session.id, latestState.moveHistory.length, syncSelection]);

  const showPortraits = !!(player.character || opponent);

  // Opponent display name: prefer the AI's character (Kanka entity), fall back
  // to "Opponent". Used in the turn label so observers see who's about to move.
  const opponentDisplayName = opponent?.name ?? "Opponent";

  let turnText = "";
  if (session.winner) {
    turnText = "";
  } else if (animating) {
    turnText = "";
  } else if (isDesignatedPlayer) {
    turnText = isMyTurn ? "Your Turn" : `${opponentDisplayName}'s Turn`;
  } else {
    turnText = latestState.turn === "player"
      ? `${player.character ?? player.username}'s Turn`
      : `${opponentDisplayName}'s Turn`;
  }

  return (
    <div className="flex items-center gap-12 xl:gap-20">
      {showPortraits && (
        <PlayerPortrait
          name={player.character}
          title={player.role}
          imageUrl={player.imageUrl}
          group={player.group}
          side="player"
        />
      )}

      <div className="flex flex-col items-center gap-4">
        <p className="text-xs tracking-[0.4em] uppercase text-white/20" style={cinzel}>
          Storm Queen&apos;s Folly
        </p>

        <div
          className="relative"
          style={{
            background: "linear-gradient(145deg, rgba(8, 12, 28, 0.85), rgba(4, 6, 18, 0.9))",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: "0.75rem",
            boxShadow: "0 0 40px rgba(99, 102, 241, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="absolute top-1 left-1 w-4 h-4 border-t border-l border-indigo-500/25" />
          <div className="absolute top-1 right-1 w-4 h-4 border-t border-r border-indigo-500/25" />
          <div className="absolute bottom-1 left-1 w-4 h-4 border-b border-l border-indigo-500/25" />
          <div className="absolute bottom-1 right-1 w-4 h-4 border-b border-r border-indigo-500/25" />

          <div className="p-6 sm:p-8">
            <div className="relative">
            {/* Victory overlay — on top of board */}
            {session.winner && (() => {
              const playerWon = session.winner === "player";
              const isDraw = session.winner === "draw";
              let subtitle: string;
              if (isDraw) {
                subtitle = victoryText.draw;
              } else if (isDesignatedPlayer) {
                subtitle = playerWon ? victoryText.playerWin : victoryText.playerLose;
              } else {
                subtitle = playerWon ? victoryText.spectatorWin : victoryText.spectatorLose;
              }
              const title = isDraw ? "STALEMATE" : (playerWon ? "VICTORY" : "DEFEAT");
              const titleColor = isDraw
                ? "text-white/60"
                : playerWon ? "text-amber-300/80" : "text-purple-400/80";
              const lineColor = isDraw
                ? "rgba(99, 102, 241, 0.3)"
                : playerWon ? "rgba(212, 175, 55, 0.4)" : "rgba(139, 92, 246, 0.4)";

              return (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-[2px] rounded"
                  style={{ animation: "victoryIn 0.5s ease-out" }}
                >
                  <style>{`@keyframes victoryIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
                  <h2 className={`text-2xl sm:text-3xl font-semibold tracking-[0.3em] ${titleColor}`} style={cinzel}>
                    {title}
                  </h2>
                  <div className="w-24 h-px" style={{ background: `linear-gradient(to right, transparent, ${lineColor}, transparent)` }} />
                  <p className="text-white/40 text-sm text-center max-w-[240px]" style={cinzel}>
                    {subtitle}
                  </p>
                </div>
              );
            })()}
            {/* Board always renders underneath */}
            {(
              <div className="relative w-[280px] h-[280px] sm:w-[340px] sm:h-[340px]">
                {/* SVG: lines and node dots only */}
                <svg viewBox="0 0 300 300" className="absolute inset-0 w-full h-full">
                  {CONNECTIONS.map(([a, b]) => {
                    const pa = NODE_SVG[a];
                    const pb = NODE_SVG[b];
                    return (
                      <line
                        key={`${a}-${b}`}
                        x1={pa.x} y1={pa.y}
                        x2={pb.x} y2={pb.y}
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="1.5"
                      />
                    );
                  })}

                  {[0, 1, 2].map((r) =>
                    [0, 1, 2].map((c) => {
                      const key = posKey(r, c);
                      const pos = NODE_SVG[key];
                      const isValidDest = validDestinations.has(key);
                      return (
                        <g key={key}>
                          <circle
                            cx={pos.x} cy={pos.y}
                            r={isValidDest ? 12 : 6}
                            fill={isValidDest ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.05)"}
                            stroke={isValidDest ? "rgba(99, 102, 241, 0.4)" : "rgba(255,255,255,0.1)"}
                            strokeWidth="1"
                            className={isValidDest && canInteract ? "cursor-pointer" : ""}
                            onClick={() => handleNodeClick(r, c)}
                          />
                          {isValidDest && canInteract && (
                            <circle
                              cx={pos.x} cy={pos.y} r="4"
                              fill="rgba(99, 102, 241, 0.5)"
                              className="cursor-pointer"
                              onClick={() => handleNodeClick(r, c)}
                            />
                          )}
                        </g>
                      );
                    })
                  )}
                </svg>

                {/* Pieces: absolutely positioned divs with CSS transitions */}
                {displayPieces.map((piece) => {
                  const pct = NODE_PCT[piece.pos];
                  if (!pct) return null;
                  const isSelected = effectiveSelection === piece.pos;
                  return (
                    <div
                      key={piece.id}
                      className="absolute w-[60px] h-[60px] -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${pct.x}%`,
                        top: `${pct.y}%`,
                        transition: `left ${MOVE_ANIM_DURATION}ms ease-in-out, top ${MOVE_ANIM_DURATION}ms ease-in-out`,
                        zIndex: isSelected ? 10 : 1,
                      }}
                      onClick={() => {
                        const [r, c] = piece.pos.split(",").map(Number);
                        handleNodeClick(r, c);
                      }}
                    >
                      <GamePiece
                        owner={piece.owner}
                        selected={isSelected}
                        interactive={canInteract && piece.owner === "player"}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>

        {turnText && (
          <p
            className={`text-[9px] tracking-[0.25em] uppercase ${
              isMyTurn ? "text-amber-300/50" : "text-white/25"
            }`}
            style={cinzel}
          >
            {submitting ? "Submitting..." : turnText}
          </p>
        )}
      </div>

      {showPortraits && opponent && (
        <PlayerPortrait
          name={opponent.name}
          title={opponent.title}
          imageUrl={opponent.imageUrl}
          side="opponent"
        />
      )}
    </div>
  );
}
