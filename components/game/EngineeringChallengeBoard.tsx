"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { EngineeringChallengeConfig, EngineeringChallengeState, Position } from "@/types/game";
import { WIRE_COLORS } from "@/lib/games/engineeringChallenge";
import PlayerPortrait from "./PlayerPortrait";
import type { GameBoardProps } from "./gameComponents";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

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
  const { gridRows, gridCols, timeLimit, pairs } = config;

  const [selectedWire, setSelectedWire] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState<Position[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Pulse the most recently completed wire (player + observer parity).
  // Tracks the previous set of completed wireIndexes; whenever a new index
  // appears, set it as the pulsing one for ~700ms.
  const [pulsingWireIndex, setPulsingWireIndex] = useState<number | null>(null);
  const prevCompleteRef = useRef<Set<number>>(
    new Set(state.wires.filter((w) => w.complete).map((w) => w.wireIndex))
  );
  useEffect(() => {
    const current = new Set(state.wires.filter((w) => w.complete).map((w) => w.wireIndex));
    let newlyComplete: number | null = null;
    for (const idx of current) {
      if (!prevCompleteRef.current.has(idx)) {
        newlyComplete = idx;
        break;
      }
    }
    prevCompleteRef.current = current;
    if (newlyComplete === null) return;
    setPulsingWireIndex(newlyComplete);
    const t = setTimeout(() => setPulsingWireIndex((cur) => (cur === newlyComplete ? null : cur)), 700);
    return () => clearTimeout(t);
  }, [state.wires]);

  const canInteract = isDesignatedPlayer && !session.winner && !submitting;
  const completedCount = state.wires.filter((w) => w.complete).length;

  // Build occupied cells map (excluding current wire being drawn)
  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    for (const wire of state.wires) {
      if (wire.wireIndex === selectedWire) continue;
      for (const cell of wire.cells) {
        set.add(posKey(cell));
      }
    }
    for (let i = 0; i < pairs.length; i++) {
      if (i === selectedWire) continue;
      set.add(posKey(pairs[i].a));
      set.add(posKey(pairs[i].b));
    }
    return set;
  }, [state.wires, selectedWire, pairs]);

  // Timer
  let timerDisplay = "";
  if (timeLimit > 0 && state.startTime) {
    const elapsed = (Date.now() - new Date(state.startTime).getTime()) / 1000;
    const remaining = Math.max(0, Math.ceil(timeLimit - elapsed));
    timerDisplay = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  }

  // Color maps
  const cellColorMap = new Map<string, string>();
  // Which wire owns each cell — used to drive the per-wire commit pulse.
  const cellWireOwnerMap = new Map<string, number>();
  if (selectedWire !== null) {
    const color = WIRE_COLORS[selectedWire % WIRE_COLORS.length].hex;
    for (const cell of currentPath) cellColorMap.set(posKey(cell), color);
  }
  for (const wire of state.wires) {
    const color = WIRE_COLORS[wire.wireIndex % WIRE_COLORS.length].hex;
    for (const cell of wire.cells) {
      cellColorMap.set(posKey(cell), color);
      cellWireOwnerMap.set(posKey(cell), wire.wireIndex);
    }
  }

  const getEndpointWire = useCallback((r: number, c: number): number => {
    for (let i = 0; i < pairs.length; i++) {
      if ((pairs[i].a[0] === r && pairs[i].a[1] === c) ||
          (pairs[i].b[0] === r && pairs[i].b[1] === c)) return i;
    }
    return -1;
  }, [pairs]);

  // ─── Cell resolution from pointer/touch position ───

  const getCellFromEvent = useCallback((clientX: number, clientY: number): Position | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const cellW = rect.width / gridCols;
    const cellH = rect.height / gridRows;
    const c = Math.floor((clientX - rect.left) / cellW);
    const r = Math.floor((clientY - rect.top) / cellH);
    if (r < 0 || r >= gridRows || c < 0 || c >= gridCols) return null;
    return [r, c];
  }, [gridRows, gridCols]);

  // ─── Server actions (declared before tryExtendPath/handlePointerDown
  //     because those callbacks list them in their dep arrays) ───

  const submitWire = useCallback(async (wireIndex: number, cells: Position[], complete: boolean) => {
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
  }, [session.id]);

  const removeWire = useCallback(async (wireIndex: number) => {
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
  }, [session.id]);

  // ─── Try to extend the current path to a cell ───

  const tryExtendPath = useCallback((r: number, c: number) => {
    if (selectedWire === null || currentPath.length === 0) return;
    const key = posKey([r, c]);
    const last = currentPath[currentPath.length - 1];
    if (last[0] === r && last[1] === c) return; // same cell

    const dr = Math.abs(r - last[0]);
    const dc = Math.abs(c - last[1]);
    if (dr + dc !== 1) return; // not adjacent

    // Check if completing at matching endpoint
    const epIdx = getEndpointWire(r, c);
    if (epIdx === selectedWire) {
      const first = currentPath[0];
      const pair = pairs[selectedWire];
      const startedAtA = first[0] === pair.a[0] && first[1] === pair.a[1];
      const clickingA = r === pair.a[0] && c === pair.a[1];
      if ((startedAtA && !clickingA) || (!startedAtA && clickingA)) {
        const completePath: Position[] = [...currentPath, [r, c]];
        submitWire(selectedWire, completePath, true);
        setIsDragging(false);
        return;
      }
    }

    // Undo: dragging back to previous cell
    if (currentPath.length >= 2) {
      const prev = currentPath[currentPath.length - 2];
      if (prev[0] === r && prev[1] === c) {
        setCurrentPath(currentPath.slice(0, -1));
        return;
      }
    }

    // Extend to empty adjacent cell
    if (!occupiedCells.has(key) && !currentPath.some(([pr, pc]) => pr === r && pc === c)) {
      setCurrentPath([...currentPath, [r, c]]);
    }
  }, [selectedWire, currentPath, pairs, occupiedCells, getEndpointWire, submitWire]);

  // ─── Pointer/touch handlers ───

  const handlePointerDown = useCallback((r: number, c: number) => {
    if (!canInteract) return;
    const epIdx = getEndpointWire(r, c);

    // Start new wire from endpoint
    if (epIdx >= 0 && selectedWire === null) {
      setSelectedWire(epIdx);
      setCurrentPath([[r, c]]);
      setIsDragging(true);
      return;
    }

    // Click on existing wire to remove
    if (selectedWire === null) {
      const existing = state.wires.find((w) =>
        w.cells.some(([wr, wc]) => wr === r && wc === c)
      );
      if (existing) {
        removeWire(existing.wireIndex);
        return;
      }
    }

    // If already drawing, start dragging from current position
    if (selectedWire !== null) {
      setIsDragging(true);
      tryExtendPath(r, c);
    }
  }, [canInteract, selectedWire, state.wires, tryExtendPath, getEndpointWire, removeWire]);

  const handlePointerMove = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    if (!isDragging || selectedWire === null) return;
    e.preventDefault();

    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const cell = getCellFromEvent(clientX, clientY);
    if (cell) tryExtendPath(cell[0], cell[1]);
  }, [isDragging, selectedWire, getCellFromEvent, tryExtendPath]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    // If wire isn't complete, keep the path for click-based editing
  }, []);

  // ─── Click handler (for non-drag interactions) ───

  const handleCellClick = useCallback((r: number, c: number) => {
    if (!canInteract || isDragging) return;

    // If drawing and clicking cells
    if (selectedWire !== null && currentPath.length > 0) {
      tryExtendPath(r, c);
      return;
    }

    // Cancel
    if (selectedWire !== null) {
      setSelectedWire(null);
      setCurrentPath([]);
    }
  }, [canInteract, isDragging, selectedWire, currentPath, tryExtendPath]);

  const showPortraits = !!(player.character || opponent);

  return (
    <div className="flex items-center gap-6 sm:gap-12 xl:gap-20">
      {showPortraits && (
        <PlayerPortrait
          name={player.character}
          title={player.role}
          imageUrl={player.imageUrl}
          group={player.group}
          side="player"
        />
      )}

      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <p className="text-[9px] sm:text-xs tracking-[0.4em] uppercase text-white/20" style={cinzel}>
            Engineering Challenge
          </p>
          {timerDisplay && (
            <span className="text-[9px] sm:text-xs tracking-[0.2em] text-amber-300/50 tabular-nums" style={cinzel}>
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

          <div className="p-3 sm:p-6">
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

              {/* Board — responsive: fills available width on mobile, fixed on desktop */}
              <div
                ref={boardRef}
                className="relative w-[calc(100vw-4rem)] max-w-[560px] touch-none select-none"
                style={{ aspectRatio: `${gridCols} / ${gridRows}` }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onTouchMove={handlePointerMove as unknown as React.TouchEventHandler}
                onTouchEnd={handlePointerUp}
              >
                {/* Grid lines (SVG scales with container) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${gridCols} ${gridRows}`} preserveAspectRatio="none">
                  {Array.from({ length: gridRows + 1 }, (_, i) => (
                    <line key={`h${i}`} x1={0} y1={i} x2={gridCols} y2={i} stroke="rgba(255,255,255,0.04)" strokeWidth={0.03} />
                  ))}
                  {Array.from({ length: gridCols + 1 }, (_, i) => (
                    <line key={`v${i}`} x1={i} y1={0} x2={i} y2={gridRows} stroke="rgba(255,255,255,0.04)" strokeWidth={0.03} />
                  ))}
                </svg>

                <style>{`
                  @keyframes ec-wire-pulse {
                    0% { transform: scale(0.6); opacity: 0.2; }
                    50% { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                  }
                  .ec-wire-pulse {
                    transform-origin: center;
                    animation: ec-wire-pulse 700ms cubic-bezier(0.2, 0.8, 0.2, 1);
                  }
                `}</style>

                {/* Cells */}
                {Array.from({ length: gridRows }, (_, r) =>
                  Array.from({ length: gridCols }, (_, c) => {
                    const key = posKey([r, c]);
                    const wireColor = cellColorMap.get(key);
                    const cellWireIdx = cellWireOwnerMap.get(key);
                    const epIdx = getEndpointWire(r, c);
                    const isEndpoint = epIdx >= 0;
                    const epColor = isEndpoint ? WIRE_COLORS[epIdx % WIRE_COLORS.length].hex : null;
                    const isCompleted = isEndpoint && state.wires.some((w) => w.wireIndex === epIdx && w.complete);
                    const wirePulses =
                      pulsingWireIndex !== null &&
                      ((cellWireIdx !== undefined && cellWireIdx === pulsingWireIndex) ||
                        (isEndpoint && epIdx === pulsingWireIndex && isCompleted));

                    return (
                      <div
                        key={key}
                        className={`absolute ${canInteract ? "cursor-pointer" : ""}`}
                        style={{
                          left: `${(c / gridCols) * 100}%`,
                          top: `${(r / gridRows) * 100}%`,
                          width: `${(1 / gridCols) * 100}%`,
                          height: `${(1 / gridRows) * 100}%`,
                        }}
                        onPointerDown={() => handlePointerDown(r, c)}
                        onClick={() => handleCellClick(r, c)}
                      >
                        {wireColor && !isEndpoint && (
                          <div
                            className={`absolute inset-[15%] rounded-sm ${wirePulses ? "ec-wire-pulse" : ""}`}
                            style={{ background: `${wireColor}44`, boxShadow: `0 0 6px ${wireColor}22` }}
                          />
                        )}

                        {isEndpoint && epColor && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div
                              className={`w-[70%] aspect-square rounded-full border-2 flex items-center justify-center ${wirePulses ? "ec-wire-pulse" : ""}`}
                              style={{
                                borderColor: isCompleted ? epColor : `${epColor}99`,
                                background: isCompleted ? `${epColor}44` : `${epColor}22`,
                                boxShadow: isCompleted ? `0 0 12px ${epColor}66` : `0 0 8px ${epColor}33`,
                              }}
                            >
                              {isCompleted && (
                                <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke={epColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
          <p className="text-[8px] sm:text-[9px] tracking-[0.25em] uppercase text-white/25" style={cinzel}>
            {submitting ? "Submitting..." :
              selectedWire !== null ? "Draw path to matching endpoint" :
              isDesignatedPlayer ? "Tap an endpoint to start wiring" :
              `${completedCount} of ${config.wireCount} wires routed`}
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
