"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type {
  HexCoord,
  IsolationMoveEvent,
  IsolationProtocolConfig,
  IsolationProtocolState,
} from "@/types/game";
import type { GameBoardProps } from "./gameComponents";
import PlayerPortrait from "./PlayerPortrait";
import {
  getShapeData,
  neighbors,
} from "@/lib/games/isolationProtocol";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const HEX_SIZE = 22; // radius in pixels
const SQRT3 = Math.sqrt(3);

// Pointy-top axial → pixel.
function axialToPixel(c: HexCoord): { x: number; y: number } {
  const x = HEX_SIZE * (SQRT3 * c.q + (SQRT3 / 2) * c.r);
  const y = HEX_SIZE * (1.5 * c.r);
  return { x, y };
}

function hexPath(size: number): string {
  // Pointy-top hex vertices, centered on (0, 0).
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(size * Math.cos(angle)).toFixed(3)},${(size * Math.sin(angle)).toFixed(3)}`);
  }
  return `M${pts.join("L")}Z`;
}

function keyOf(c: HexCoord): string {
  return `${c.q},${c.r}`;
}

// ─── Component ───

export default function IsolationProtocolBoard({
  session,
  player,
  opponent,
  isDesignatedPlayer,
  isMyTurn,
  victoryText,
}: GameBoardProps) {
  const config = session.config as IsolationProtocolConfig;
  const state = session.state as IsolationProtocolState;

  const shapeData = useMemo(() => getShapeData(config.shape), [config.shape]);

  // ─── Replay-driven animation ───
  //
  // `latestState` is the newest authoritative state (from polling or POST).
  // `displayShields` / `displayEnemy` are what's visually on screen right now —
  // they lag latestState while we play out any unseen `recentMoves` in sequence
  // (shield pulses on, then ~280ms later the enemy hops). This gives spectators
  // a clear per-step view even if multiple moves arrived in one poll window.
  const [latestState, setLatestState] = useState<IsolationProtocolState>(state);
  const [displayShields, setDisplayShields] = useState<HexCoord[]>(state.shields);
  const [displayEnemy, setDisplayEnemy] = useState<HexCoord>(state.enemy);
  const [newShieldKey, setNewShieldKey] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const lastPlayedMoveCountRef = useRef<number>(state.moveCount);
  const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Ingest newer states (polling or POST) into latestState.
  useEffect(() => {
    if (state.moveCount > latestState.moveCount) {
      setLatestState(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.moveCount]);

  // Replay events in sequence whenever latestState pulls ahead of what we've
  // already rendered.
  useEffect(() => {
    if (latestState.moveCount <= lastPlayedMoveCountRef.current) return;

    animTimeoutsRef.current.forEach(clearTimeout);
    animTimeoutsRef.current = [];

    const events: IsolationMoveEvent[] = (latestState.recentMoves ?? [])
      .filter((e) => e.moveCount > lastPlayedMoveCountRef.current)
      .sort((a, b) => a.moveCount - b.moveCount);

    // If the ring buffer doesn't cover the gap (e.g. spectator tabbed away and
    // many moves passed), snap to the latest state rather than skipping steps.
    const coversGap =
      events.length > 0 && events[events.length - 1].moveCount >= latestState.moveCount;

    if (!coversGap) {
      setDisplayShields(latestState.shields);
      setDisplayEnemy(latestState.enemy);
      setNewShieldKey(null);
      setAnimating(false);
      lastPlayedMoveCountRef.current = latestState.moveCount;
      return;
    }

    // Per-step timings.
    const SHIELD_IN = 0;        // shield pops into place immediately
    const ENEMY_HOP_AT = 280;   // ~fade finishes before enemy starts moving
    const STEP_END_AT = 780;    // after the CSS transition (~450ms) completes

    setAnimating(true);
    let cursor = 0;

    for (const ev of events) {
      const shieldKey = `${ev.shield.q},${ev.shield.r}`;

      animTimeoutsRef.current.push(
        setTimeout(() => {
          setDisplayShields((prev) => {
            const exists = prev.some((s) => `${s.q},${s.r}` === shieldKey);
            return exists ? prev : [...prev, { q: ev.shield.q, r: ev.shield.r }];
          });
          setNewShieldKey(shieldKey);
        }, cursor + SHIELD_IN)
      );

      if (ev.enemyTo) {
        const target = ev.enemyTo;
        animTimeoutsRef.current.push(
          setTimeout(() => {
            setDisplayEnemy(target);
          }, cursor + ENEMY_HOP_AT)
        );
      }

      animTimeoutsRef.current.push(
        setTimeout(() => {
          setNewShieldKey((cur) => (cur === shieldKey ? null : cur));
          lastPlayedMoveCountRef.current = ev.moveCount;
        }, cursor + STEP_END_AT)
      );

      cursor += STEP_END_AT;
    }

    // Final sync in case the ring buffer's latest moveCount equals latestState
    // but there's any drift (rare — defensive).
    animTimeoutsRef.current.push(
      setTimeout(() => {
        setDisplayShields(latestState.shields);
        setDisplayEnemy(latestState.enemy);
        setAnimating(false);
        lastPlayedMoveCountRef.current = latestState.moveCount;
      }, cursor + 30)
    );

    return () => {
      animTimeoutsRef.current.forEach(clearTimeout);
      animTimeoutsRef.current = [];
    };
  }, [latestState]);

  const shieldSet = useMemo(
    () => new Set(displayShields.map(keyOf)),
    [displayShields]
  );

  const initialShieldSet = useMemo(
    () => new Set(config.initialShields.map(keyOf)),
    [config.initialShields]
  );

  // Compute SVG viewport by scanning all cell pixel coords.
  const { viewBox, cellPixels } = useMemo(() => {
    const pxs = shapeData.cells.map((c) => ({ c, ...axialToPixel(c) }));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pxs) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = HEX_SIZE + 6;
    return {
      cellPixels: pxs,
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    };
  }, [shapeData]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const canInteract =
    isDesignatedPlayer && isMyTurn && !submitting && !session.winner && !animating;

  // Cells adjacent to the displayed enemy — highlighted for the player as the
  // "hot zone". Follows the visual enemy so the highlight moves with the hop.
  const enemyNeighborSet = useMemo(() => {
    const s = new Set<string>();
    for (const n of neighbors(displayEnemy)) {
      s.add(keyOf(n));
    }
    return s;
  }, [displayEnemy]);

  const submitShield = useCallback(
    async (coord: HexCoord) => {
      if (!canInteract) return;
      setSubmitting(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/games/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            moveVersion: latestState.moveCount,
            shield: coord,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setErrorMsg(data?.error ?? "Move failed");
        } else {
          const data = await res.json().catch(() => null);
          if (data?.state && data.state.moveCount > latestState.moveCount) {
            setLatestState(data.state as IsolationProtocolState);
          }
        }
      } finally {
        setSubmitting(false);
      }
    },
    [canInteract, session.id, latestState.moveCount]
  );

  const handleCellClick = useCallback(
    (cell: HexCoord) => {
      if (!canInteract) return;
      const k = keyOf(cell);
      if (shieldSet.has(k)) return;
      if (cell.q === displayEnemy.q && cell.r === displayEnemy.r) return;
      submitShield(cell);
    },
    [canInteract, shieldSet, displayEnemy, submitShield]
  );

  const enemyPos = axialToPixel(displayEnemy);

  // Victory overlay
  const showVictory = !!session.winner;
  const playerWon = session.winner === "player";
  const isDraw = session.winner === "draw";

  let turnText = "";
  if (session.winner) turnText = "";
  else if (animating) turnText = "Resolving...";
  else if (isMyTurn) turnText = "Your Turn";
  else turnText = "Opponent's Turn";

  return (
    <div className="flex items-center gap-12 xl:gap-20">
      <PlayerPortrait
        name={player.character}
        title={player.role}
        imageUrl={player.imageUrl}
        group={player.group}
        side="player"
      />

      <div className="flex flex-col items-center gap-4">
        <p className="text-xs tracking-[0.4em] uppercase text-white/20" style={cinzel}>
          Isolation Protocol
        </p>

        {/* Turn indicator */}
        <div className="min-h-[24px] flex items-center">
          <span className="text-[9px] tracking-[0.3em] uppercase text-white/40" style={cinzel}>
            {turnText}
          </span>
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

          <div className="p-6 sm:p-8">
            <div className="relative">
              {/* Victory overlay */}
              {showVictory && (() => {
                let subtitle: string;
                if (isDraw) subtitle = victoryText.draw;
                else if (isDesignatedPlayer) subtitle = playerWon ? victoryText.playerWin : victoryText.playerLose;
                else subtitle = playerWon ? victoryText.spectatorWin : victoryText.spectatorLose;
                const title = isDraw ? "STALEMATE" : playerWon ? "VICTORY" : "DEFEAT";
                const titleColor = isDraw
                  ? "text-white/60"
                  : playerWon
                  ? "text-amber-300/80"
                  : "text-purple-400/80";
                const lineColor = isDraw
                  ? "rgba(99, 102, 241, 0.3)"
                  : playerWon
                  ? "rgba(212, 175, 55, 0.4)"
                  : "rgba(139, 92, 246, 0.4)";
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

              <svg
                viewBox={viewBox}
                style={{ width: "clamp(320px, 60vw, 640px)", height: "auto" }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <style>{`
                  @keyframes ip-shield-in {
                    0% { opacity: 0; transform: scale(0.2); }
                    60% { opacity: 1; transform: scale(1.25); }
                    100% { opacity: 1; transform: scale(1); }
                  }
                  .ip-shield-pulse {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: ip-shield-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
                  }
                `}</style>
                <defs>
                  <radialGradient id="ip-enemy-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(239, 68, 68, 0.8)" />
                    <stop offset="60%" stopColor="rgba(239, 68, 68, 0.25)" />
                    <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                  </radialGradient>
                  <linearGradient id="ip-shield-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(99, 102, 241, 0.55)" />
                    <stop offset="100%" stopColor="rgba(99, 102, 241, 0.25)" />
                  </linearGradient>
                  <linearGradient id="ip-border-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(245, 158, 11, 0.18)" />
                    <stop offset="100%" stopColor="rgba(245, 158, 11, 0.08)" />
                  </linearGradient>
                </defs>

                {/* Cells */}
                {cellPixels.map(({ c, x, y }) => {
                  const k = keyOf(c);
                  const isShield = shieldSet.has(k);
                  const isInitialShield = initialShieldSet.has(k);
                  const isBorder = shapeData.borderSet.has(k);
                  const isHover = hoveredKey === k;
                  const isEnemyNeighbor = enemyNeighborSet.has(k);

                  // Base fill
                  let fill = "rgba(255, 255, 255, 0.03)";
                  let stroke = "rgba(255, 255, 255, 0.10)";
                  if (isBorder) {
                    fill = "url(#ip-border-grad)";
                    stroke = "rgba(245, 158, 11, 0.30)";
                  }
                  if (isEnemyNeighbor && !isShield) {
                    stroke = "rgba(239, 68, 68, 0.35)";
                  }
                  if (isShield) {
                    fill = "url(#ip-shield-grad)";
                    stroke = isInitialShield
                      ? "rgba(99, 102, 241, 0.85)"
                      : "rgba(99, 102, 241, 0.55)";
                  }

                  const clickable = canInteract && !isShield;
                  const hoverFill =
                    clickable && isHover ? "rgba(99, 102, 241, 0.25)" : fill;

                  return (
                    <g
                      key={k}
                      transform={`translate(${x}, ${y})`}
                      onMouseEnter={() => clickable && setHoveredKey(k)}
                      onMouseLeave={() => setHoveredKey((cur) => (cur === k ? null : cur))}
                      onClick={() => handleCellClick(c)}
                      style={{ cursor: clickable ? "pointer" : "default" }}
                    >
                      <path
                        d={hexPath(HEX_SIZE - 1)}
                        fill={hoverFill}
                        stroke={stroke}
                        strokeWidth={isInitialShield ? 1.5 : 1}
                      />
                      {isShield && (
                        <g className={newShieldKey === k ? "ip-shield-pulse" : ""}>
                          <path
                            d={hexPath(HEX_SIZE * 0.45)}
                            fill="rgba(165, 180, 252, 0.5)"
                            stroke="rgba(224, 231, 255, 0.8)"
                            strokeWidth={1}
                          />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Enemy marker — rendered last so it's on top. Animates via
                    CSS transition on the translation. */}
                <g
                  style={{
                    transform: `translate(${enemyPos.x}px, ${enemyPos.y}px)`,
                    transition: "transform 450ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <circle r={HEX_SIZE * 1.2} fill="url(#ip-enemy-glow)" />
                  <circle
                    r={HEX_SIZE * 0.45}
                    fill="rgba(239, 68, 68, 0.85)"
                    stroke="rgba(254, 202, 202, 0.9)"
                    strokeWidth={1.5}
                  />
                  <circle r={HEX_SIZE * 0.15} fill="rgba(255, 255, 255, 0.85)" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Error line */}
        <div className="min-h-[14px]">
          {errorMsg && (
            <p className="text-[9px] text-red-400/80" style={cinzel}>
              {errorMsg}
            </p>
          )}
        </div>
      </div>

      {opponent && (
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
