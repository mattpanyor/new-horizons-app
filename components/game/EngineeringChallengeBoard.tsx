"use client";

import { useState, useCallback } from "react";
import type { EngineeringChallengeConfig, EngineeringChallengeState, Position } from "@/types/game";
import { WIRE_COLORS } from "@/lib/games/engineeringChallenge";
import PlayerPortrait from "./PlayerPortrait";
import type { GameBoardProps } from "./gameComponents";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const CELL_SIZE = 40;

function posKey(p: Position): string {
  return `${p[0]},${p[1]}`;
}

export default function EngineeringChallengeBoard({
  session,
  player,
  opponent,
  isDesignatedPlayer,
  victoryText,
}: GameBoardProps) {
  const config = session.config as EngineeringChallengeConfig;
  const state = session.state as EngineeringChallengeState;
  const { gridRows, gridCols, wireCount, timeLimit, pairs } = config;

  const [selectedWire, setSelectedWire] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState<Position[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canInteract = isDesignatedPlayer && !session.winner && !submitting;

  // Build occupied cells map (excluding current wire being drawn)
  const occupiedCells = new Set<string>();
  for (const wire of state.wires) {
    if (wire.wireIndex === selectedWire) continue;
    for (const cell of wire.cells) {
      occupiedCells.add(posKey(cell));
    }
  }
  // Also block other pair endpoints
  for (let i = 0; i < pairs.length; i++) {
    if (i === selectedWire) continue;
    occupiedCells.add(posKey(pairs[i].a));
    occupiedCells.add(posKey(pairs[i].b));
  }

  // Timer display
  let timerDisplay = "";
  if (timeLimit > 0 && state.startTime) {
    const elapsed = (Date.now() - new Date(state.startTime).getTime()) / 1000;
    const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));
    timerDisplay = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  }

  // Map cells to wire colors for rendering
  const cellColorMap = new Map<string, string>();
  // Current path being drawn
  if (selectedWire !== null) {
    const color = WIRE_COLORS[selectedWire % WIRE_COLORS.length].hex;
    for (const cell of currentPath) {
      cellColorMap.set(posKey(cell), color);
    }
  }
  // Placed wires
  for (const wire of state.wires) {
    const color = WIRE_COLORS[wire.wireIndex % WIRE_COLORS.length].hex;
    for (const cell of wire.cells) {
      cellColorMap.set(posKey(cell), color);
    }
  }

  // Find which endpoint a cell is (returns wire index or -1)
  const getEndpointWire = (r: number, c: number): number => {
    for (let i = 0; i < pairs.length; i++) {
      if ((pairs[i].a[0] === r && pairs[i].a[1] === c) ||
          (pairs[i].b[0] === r && pairs[i].b[1] === c)) {
        return i;
      }
    }
    return -1;
  };

  const handleCellClick = useCallback((r: number, c: number) => {
    if (!canInteract) return;
    const key = posKey([r, c]);
    const endpointIdx = getEndpointWire(r, c);

    // Clicking an endpoint to start a new wire
    if (endpointIdx >= 0 && selectedWire === null) {
      // Check if this wire already exists — remove it first
      setSelectedWire(endpointIdx);
      setCurrentPath([[r, c]]);
      return;
    }

    // If drawing a wire
    if (selectedWire !== null && currentPath.length > 0) {
      const last = currentPath[currentPath.length - 1];
      const dr = Math.abs(r - last[0]);
      const dc = Math.abs(c - last[1]);

      // Check if clicking the matching endpoint to complete
      if (endpointIdx === selectedWire && dr + dc === 1) {
        const first = currentPath[0];
        const pair = pairs[selectedWire];
        // Make sure we're not clicking the same endpoint we started from
        const startedAtA = first[0] === pair.a[0] && first[1] === pair.a[1];
        const clickingA = r === pair.a[0] && c === pair.a[1];
        if ((startedAtA && !clickingA) || (!startedAtA && clickingA)) {
          const completePath: Position[] = [...currentPath, [r, c]];
          submitWire(selectedWire, completePath, true);
          return;
        }
      }

      // Clicking adjacent empty cell
      if (dr + dc === 1 && !occupiedCells.has(key)) {
        if (!currentPath.some(([pr, pc]) => pr === r && pc === c)) {
          setCurrentPath([...currentPath, [r, c]]);
          return;
        }
      }

      // Undo last step
      if (currentPath.length >= 2) {
        const prev = currentPath[currentPath.length - 2];
        if (prev[0] === r && prev[1] === c) {
          setCurrentPath(currentPath.slice(0, -1));
          return;
        }
      }
    }

    // Click on an existing completed wire to remove it
    const existingWire = state.wires.find((w) =>
      w.cells.some(([wr, wc]) => wr === r && wc === c)
    );
    if (existingWire && canInteract && selectedWire === null) {
      removeWire(existingWire.wireIndex);
      return;
    }

    // Cancel current drawing
    if (selectedWire !== null) {
      setSelectedWire(null);
      setCurrentPath([]);
    }
  }, [canInteract, selectedWire, currentPath, pairs, occupiedCells, state.wires]);

  const submitWire = async (wireIndex: number, cells: Position[], complete: boolean) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/games/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "place-wire",
          wireIndex,
          cells,
          complete,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error("Wire placement failed:", data?.error);
      }
    } finally {
      setSubmitting(false);
      setSelectedWire(null);
      setCurrentPath([]);
    }
  };

  const removeWire = async (wireIndex: number) => {
    setSubmitting(true);
    try {
      await fetch("/api/games/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "remove-wire",
          wireIndex,
        }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const showPortraits = !!(player.character || opponent);
  const boardW = gridCols * CELL_SIZE;
  const boardH = gridRows * CELL_SIZE;

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
        <div className="flex items-center gap-4">
          <p className="text-xs tracking-[0.4em] uppercase text-white/20" style={cinzel}>
            Engineering Challenge
          </p>
          {timerDisplay && (
            <span className="text-xs tracking-[0.2em] text-amber-300/50 tabular-nums" style={cinzel}>
              {timerDisplay}
            </span>
          )}
        </div>

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

          <div className="p-4 sm:p-6">
            <div className="relative">
              {/* Victory overlay */}
              {session.winner && (() => {
                const playerWon = session.winner === "player";
                const isDraw = session.winner === "draw" || session.winner === "timeout";
                let subtitle: string;
                if (isDraw) {
                  subtitle = victoryText.draw;
                } else if (isDesignatedPlayer) {
                  subtitle = playerWon ? victoryText.playerWin : victoryText.playerLose;
                } else {
                  subtitle = playerWon ? victoryText.spectatorWin : victoryText.spectatorLose;
                }
                const title = isDraw ? "TIME EXPIRED" : "COMPLETED";
                const titleColor = playerWon ? "text-cyan-300/80" : "text-red-400/80";
                const lineColor = playerWon ? "rgba(34, 211, 238, 0.4)" : "rgba(239, 68, 68, 0.3)";

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
                    <p className="text-white/40 text-sm text-center max-w-[280px]" style={cinzel}>
                      {subtitle}
                    </p>
                  </div>
                );
              })()}

              {/* Board */}
              <div className="relative" style={{ width: boardW, height: boardH }}>
                {/* Grid lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${boardW} ${boardH}`}>
                  {Array.from({ length: gridRows + 1 }, (_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * CELL_SIZE} x2={boardW} y2={i * CELL_SIZE} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                  ))}
                  {Array.from({ length: gridCols + 1 }, (_, i) => (
                    <line key={`v${i}`} x1={i * CELL_SIZE} y1={0} x2={i * CELL_SIZE} y2={boardH} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                  ))}
                </svg>

                {/* Cells */}
                {Array.from({ length: gridRows }, (_, r) =>
                  Array.from({ length: gridCols }, (_, c) => {
                    const key = posKey([r, c]);
                    const wireColor = cellColorMap.get(key);
                    const epIdx = getEndpointWire(r, c);
                    const isEndpoint = epIdx >= 0;
                    const epColor = isEndpoint ? WIRE_COLORS[epIdx % WIRE_COLORS.length].hex : null;
                    const isCompleted = isEndpoint && state.wires.some((w) => w.wireIndex === epIdx && w.complete);

                    return (
                      <div
                        key={key}
                        className={`absolute ${canInteract ? "cursor-pointer" : ""}`}
                        style={{
                          left: c * CELL_SIZE,
                          top: r * CELL_SIZE,
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                        }}
                        onClick={() => handleCellClick(r, c)}
                      >
                        {/* Wire fill */}
                        {wireColor && !isEndpoint && (
                          <div
                            className="absolute inset-[6px] rounded-sm"
                            style={{ background: `${wireColor}44`, boxShadow: `0 0 6px ${wireColor}22` }}
                          />
                        )}

                        {/* Endpoint node */}
                        {isEndpoint && epColor && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div
                              className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
                              style={{
                                borderColor: isCompleted ? `${epColor}` : `${epColor}99`,
                                background: isCompleted ? `${epColor}44` : `${epColor}22`,
                                boxShadow: isCompleted ? `0 0 12px ${epColor}66` : `0 0 8px ${epColor}33`,
                              }}
                            >
                              {isCompleted && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={epColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {!session.winner && (
          <p className="text-[9px] tracking-[0.25em] uppercase text-white/25" style={cinzel}>
            {submitting ? "Submitting..." :
              selectedWire !== null ? "Click cells to route wire, click endpoint to complete" :
              isDesignatedPlayer ? "Click an endpoint to start wiring" : "Observing"}
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
