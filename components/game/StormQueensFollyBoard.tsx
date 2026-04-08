"use client";

import { useState, useCallback } from "react";
import type { Position, ActiveGameResponse } from "@/types/game";
import type { VictoryText } from "@/lib/games/registry";
import GamePiece from "./GamePiece";
import PlayerPortrait from "./PlayerPortrait";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// Board layout: 9 nodes on a 3x3 grid
// Positions in SVG coordinates (300x300 viewbox)
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
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

// Connection lines (adjacency)
const CONNECTIONS: [string, string][] = [
  // Rows
  ["0,0", "0,1"], ["0,1", "0,2"],
  ["1,0", "1,1"], ["1,1", "1,2"],
  ["2,0", "2,1"], ["2,1", "2,2"],
  // Columns
  ["0,0", "1,0"], ["1,0", "2,0"],
  ["0,1", "1,1"], ["1,1", "2,1"],
  ["0,2", "1,2"], ["1,2", "2,2"],
  // Diagonals through center
  ["0,0", "1,1"], ["1,1", "2,2"],
  ["0,2", "1,1"], ["1,1", "2,0"],
];

// Adjacency for move validation on client (mirrors server)
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

interface StormQueensFollyBoardProps {
  session: ActiveGameResponse["session"];
  player: ActiveGameResponse["player"];
  opponent: ActiveGameResponse["opponent"];
  isDesignatedPlayer: boolean;
  isMyTurn: boolean;
  username: string;
  victoryText: VictoryText;
}

export default function StormQueensFollyBoard({
  session,
  player,
  opponent,
  isDesignatedPlayer,
  isMyTurn,
  victoryText,
}: StormQueensFollyBoardProps) {
  const [selectedPos, setSelectedPos] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const board = session.state.board;
  const canInteract = isDesignatedPlayer && isMyTurn && !submitting && !session.winner;

  // Get valid destinations for selected piece
  const validDestinations: Set<string> = new Set();
  if (selectedPos && canInteract) {
    const adj = ADJACENCY[selectedPos] ?? [];
    for (const key of adj) {
      const [r, c] = key.split(",").map(Number);
      if (board[r][c] === null) {
        validDestinations.add(key);
      }
    }
  }

  const handleNodeClick = useCallback(async (r: number, c: number) => {
    if (!canInteract) return;

    const key = posKey(r, c);
    const cell = board[r][c];

    // Clicking own piece — select it
    if (cell === "player") {
      setSelectedPos(selectedPos === key ? null : key);
      return;
    }

    // Clicking empty cell with a piece selected — try to move
    if (cell === null && selectedPos && validDestinations.has(key)) {
      const [fromR, fromC] = selectedPos.split(",").map(Number);
      setSubmitting(true);
      setSelectedPos(null);

      try {
        const res = await fetch("/api/games/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            from: [fromR, fromC] as Position,
            to: [r, c] as Position,
            moveVersion: session.state.moveHistory.length,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          console.error("Move failed:", data?.error);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Clicking elsewhere — deselect
    setSelectedPos(null);
  }, [canInteract, board, selectedPos, validDestinations, session.id]);

  const showPortraits = !!(player.character || opponent);

  // Turn indicator
  let turnText = "";
  if (session.winner) {
    turnText = "";
  } else if (isDesignatedPlayer) {
    turnText = isMyTurn ? "Your Turn" : "Opponent's Turn";
  } else {
    turnText = session.state.turn === "player" ? `${player.character ?? player.username}'s Turn` : "Opponent's Turn";
  }

  return (
    <div className="flex items-center gap-12 xl:gap-20">
      {/* Left portrait */}
      {showPortraits && (
        <PlayerPortrait
          name={player.character}
          title={player.role}
          imageUrl={player.imageUrl}
          group={player.group}
          side="player"
        />
      )}

      {/* Board */}
      <div className="flex flex-col items-center gap-4">
        {/* Title */}
        <p className="text-xs tracking-[0.4em] uppercase text-white/20" style={cinzel}>
          Storm Queen&apos;s Folly
        </p>

        {/* Board card */}
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
          {/* Corner brackets */}
          <div className="absolute top-1 left-1 w-4 h-4 border-t border-l border-indigo-500/25" />
          <div className="absolute top-1 right-1 w-4 h-4 border-t border-r border-indigo-500/25" />
          <div className="absolute bottom-1 left-1 w-4 h-4 border-b border-l border-indigo-500/25" />
          <div className="absolute bottom-1 right-1 w-4 h-4 border-b border-r border-indigo-500/25" />

          <div className="p-6 sm:p-8">
            {session.winner ? (() => {
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
                  className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] flex flex-col items-center justify-center gap-4"
                  style={{ animation: "victoryIn 0.5s ease-out" }}
                >
                  <style>{`@keyframes victoryIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
                  <h2
                    className={`text-2xl sm:text-3xl font-semibold tracking-[0.3em] ${titleColor}`}
                    style={cinzel}
                  >
                    {title}
                  </h2>
                  <div className="w-24 h-px" style={{ background: `linear-gradient(to right, transparent, ${lineColor}, transparent)` }} />
                  <p className="text-white/40 text-sm text-center max-w-[240px]" style={cinzel}>
                    {subtitle}
                  </p>
                </div>
              );
            })() : (
            <svg
              viewBox="0 0 300 300"
              className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px]"
            >
              {/* Connection lines */}
              {CONNECTIONS.map(([a, b]) => {
                const pa = NODE_POSITIONS[a];
                const pb = NODE_POSITIONS[b];
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

              {/* Nodes + pieces */}
              {[0, 1, 2].map((r) =>
                [0, 1, 2].map((c) => {
                  const key = posKey(r, c);
                  const pos = NODE_POSITIONS[key];
                  const cell = board[r][c];
                  const isSelected = selectedPos === key;
                  const isValidDest = validDestinations.has(key);

                  return (
                    <g key={key}>
                      {/* Node circle */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isValidDest ? 12 : 6}
                        fill={isValidDest ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.05)"}
                        stroke={isValidDest ? "rgba(99, 102, 241, 0.4)" : "rgba(255,255,255,0.1)"}
                        strokeWidth="1"
                        className={isValidDest && canInteract ? "cursor-pointer" : ""}
                        onClick={() => handleNodeClick(r, c)}
                      />

                      {/* Valid destination indicator */}
                      {isValidDest && canInteract && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="4"
                          fill="rgba(99, 102, 241, 0.5)"
                          className="cursor-pointer"
                          onClick={() => handleNodeClick(r, c)}
                        />
                      )}

                      {/* Piece */}
                      {cell && (
                        <foreignObject
                          x={pos.x - 30}
                          y={pos.y - 30}
                          width="60"
                          height="60"
                          onClick={() => handleNodeClick(r, c)}
                        >
                          <GamePiece
                            owner={cell}
                            selected={isSelected}
                            interactive={canInteract && cell === "player"}
                          />
                        </foreignObject>
                      )}
                    </g>
                  );
                })
              )}
            </svg>
            )}
          </div>
        </div>

        {/* Turn indicator */}
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

      {/* Right portrait */}
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
