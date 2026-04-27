"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Sigil, RunePokerConfig, RunePokerState } from "@/types/game";
import { handLabel } from "@/lib/games/runePoker";
import PlayerPortrait from "./PlayerPortrait";
import type { GameBoardProps } from "./gameComponents";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// ─── Sigil SVG icons ───

function SigilIcon({ sigil, size = 32 }: { sigil: Sigil; size?: number }) {
  const s = size;
  const half = s / 2;
  const props = {
    width: s,
    height: s,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (sigil) {
    case "flame":
      return (
        <svg {...props}>
          <path d="M16 4c0 0-8 8-8 16a8 8 0 0 0 16 0c0-8-8-16-8-16z" fill="currentColor" fillOpacity={0.15} />
          <path d="M16 12c0 0-3 4-3 8a3 3 0 0 0 6 0c0-4-3-8-3-8z" fill="currentColor" fillOpacity={0.25} />
        </svg>
      );
    case "void":
      return (
        <svg {...props}>
          <circle cx={half} cy={half} r="10" fill="currentColor" fillOpacity={0.1} />
          <path d="M16 6a10 10 0 0 1 0 20" strokeDasharray="2 2" />
          <path d="M16 6a10 10 0 0 0 0 20" />
          <circle cx={half} cy={half} r="3" fill="currentColor" fillOpacity={0.3} />
        </svg>
      );
    case "storm":
      return (
        <svg {...props}>
          <path d="M18 4L12 16h8L14 28" fill="currentColor" fillOpacity={0.15} />
          <path d="M18 4L12 16h8L14 28" />
        </svg>
      );
    case "earth":
      return (
        <svg {...props}>
          <path d="M4 26L16 6l12 20H4z" fill="currentColor" fillOpacity={0.12} />
          <path d="M10 26L16 14l6 12" fill="currentColor" fillOpacity={0.15} />
        </svg>
      );
    case "star":
      return (
        <svg {...props}>
          <path
            d="M16 4l3.5 8.5L28 14l-6.5 5.5L23 28l-7-4.5L9 28l1.5-8.5L4 14l8.5-1.5z"
            fill="currentColor"
            fillOpacity={0.15}
          />
        </svg>
      );
    case "crown":
      return (
        <svg {...props}>
          <path d="M4 24V12l6 6 6-10 6 10 6-6v12H4z" fill="currentColor" fillOpacity={0.15} />
          <rect x="4" y="24" width="24" height="3" rx="1" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
  }
}

const SIGIL_COLORS: Record<Sigil, string> = {
  flame: "#EF4444",
  void: "#8B5CF6",
  storm: "#3B82F6",
  earth: "#22C55E",
  star: "#EAB308",
  crown: "#F59E0B",
};

const SIGIL_LABELS: Record<Sigil, string> = {
  flame: "Flame",
  void: "Void",
  storm: "Storm",
  earth: "Earth",
  star: "Star",
  crown: "Crown",
};

// ─── Coin column with outer kept-tray ───
// keptSide: which side the kept coins slide to ("left" = tray on left, "right" = tray on right)
//
// Layout strategy: single absolute-positioned container with a fixed 2-column grid
// of slot positions. Each coin computes its target (x, y) from its lock state and
// transitions smoothly when locked/unlocked. Stable React keys keep the DOM node
// identity, so the transform transition runs across the lock toggle.

const COIN_PX = 56;
const ROW_GAP = 6;
const STEP = COIN_PX + ROW_GAP;
const COL_GAP = 12;
const COL_X_NEAR = 0;
const COL_X_FAR = COIN_PX + COL_GAP;
const COLUMN_WIDTH = COL_X_FAR + COIN_PX;
const COLUMN_HEIGHT = 340;

function centeredTop(count: number, slot: number) {
  return (COLUMN_HEIGHT - count * STEP + ROW_GAP) / 2 + slot * STEP;
}

function CoinColumn({
  coins,
  lockedCoins,
  owner,
  canLock,
  onToggleLock,
  flipping,
  label,
  handRank,
  keptSide,
}: {
  coins: Sigil[];
  lockedCoins: boolean[];
  owner: "player" | "opponent";
  canLock: boolean;
  onToggleLock?: (idx: number) => void;
  flipping: boolean;
  label: string;
  handRank: string | null;
  keptSide: "left" | "right";
}) {
  const isPlayer = owner === "player";
  const borderActive = isPlayer ? "border-amber-400/50" : "border-purple-400/50";
  const borderDim = "border-white/10";
  const glowColor = isPlayer ? "rgba(212, 175, 55, 0.25)" : "rgba(139, 92, 246, 0.25)";
  const bgActive = isPlayer ? "rgba(212, 175, 55, 0.06)" : "rgba(139, 92, 246, 0.06)";
  const accentText = isPlayer ? "text-amber-300/30" : "text-purple-300/30";
  const handText = isPlayer ? "text-amber-300/50" : "text-purple-300/50";

  const hasCoins = coins.length > 0;
  const trayX = keptSide === "left" ? COL_X_NEAR : COL_X_FAR;
  const mainX = keptSide === "left" ? COL_X_FAR : COL_X_NEAR;

  // Compute kept and unkept slot order so each coin knows where to sit.
  const keptSlots: number[] = [];
  const mainSlots: number[] = [];
  for (let i = 0; i < coins.length; i++) {
    if (lockedCoins[i]) keptSlots.push(i);
    else mainSlots.push(i);
  }

  const positionFor = (idx: number) => {
    const isKept = lockedCoins[idx];
    const list = isKept ? keptSlots : mainSlots;
    const slot = list.indexOf(idx);
    return {
      left: isKept ? trayX : mainX,
      top: centeredTop(list.length, slot),
    };
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className={`text-[7px] sm:text-[8px] tracking-[0.2em] uppercase ${accentText}`} style={cinzel}>
        {label}
      </p>

      <div
        style={{
          position: "relative",
          width: COLUMN_WIDTH,
          height: COLUMN_HEIGHT,
        }}
      >
        {!hasCoins &&
          Array.from({ length: 5 }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="rounded-full border border-white/8 bg-white/[0.02]"
              style={{
                position: "absolute",
                width: COIN_PX,
                height: COIN_PX,
                left: mainX,
                top: centeredTop(5, i),
              }}
            />
          ))}

        {hasCoins &&
          coins.map((sigil, i) => {
            const { left, top } = positionFor(i);
            const isKept = lockedCoins[i];
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: COIN_PX,
                  height: COIN_PX,
                  transform: `translate(${left}px, ${top}px)`,
                  transition: "transform 500ms cubic-bezier(0.4, 0.0, 0.2, 1)",
                }}
              >
                <button
                  onClick={canLock && onToggleLock ? () => onToggleLock(i) : undefined}
                  className={`w-full h-full rounded-full border-2 ${
                    isKept ? borderActive : borderDim
                  } flex items-center justify-center transition-[background,border-color,box-shadow,transform] duration-300 ${
                    canLock ? "cursor-pointer hover:scale-110" : "cursor-default"
                  }`}
                  style={{
                    background: isKept ? bgActive : "rgba(255, 255, 255, 0.03)",
                    boxShadow: isKept ? `0 0 12px ${glowColor}` : "none",
                    // Only re-rolled coins flip — kept coins held their face,
                    // so flipping them looks wrong and would clash with any
                    // in-flight slide on neighboring coins.
                    animation: flipping && !isKept ? "coinFlip 0.6s ease-in-out" : undefined,
                  }}
                  title={SIGIL_LABELS[sigil]}
                >
                  <div style={{ color: SIGIL_COLORS[sigil] }}>
                    <SigilIcon sigil={sigil} size={26} />
                  </div>
                </button>
              </div>
            );
          })}
      </div>

      {handRank && (
        <p className={`text-[8px] sm:text-[9px] tracking-[0.15em] uppercase ${handText}`} style={cinzel}>
          {handRank}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───

const FLIP_DURATION = 600;

export default function RunePokerBoard({
  session,
  player,
  opponent,
  isDesignatedPlayer,
  victoryText,
}: GameBoardProps) {
  const config = session.config as RunePokerConfig;
  const state = session.state as RunePokerState;

  const [lockedCoins, setLockedCoins] = useState<boolean[]>([false, false, false, false, false]);
  const [submitting, setSubmitting] = useState(false);
  const [flipping, setFlipping] = useState(false);
  // Serialize lock-sync POSTs so they reach the server in click order.
  const lockSyncChainRef = useRef<Promise<unknown>>(Promise.resolve());

  // Trigger flip animation when a cast/recast happens (castsRemaining, round, or phase changes)
  const prevCastKeyRef = useRef<string>("");

  useEffect(() => {
    const castKey = `${state.round}-${state.castsRemaining}-${state.phase}`;
    if (prevCastKeyRef.current && prevCastKeyRef.current !== castKey && state.playerCoins.length > 0) {
      setFlipping(true);
      const timer = setTimeout(() => setFlipping(false), FLIP_DURATION);
      prevCastKeyRef.current = castKey;
      return () => clearTimeout(timer);
    }
    prevCastKeyRef.current = castKey;
  }, [state.round, state.castsRemaining, state.phase, state.playerCoins.length]);

  // Reset locks when entering keeping phase (new round)
  useEffect(() => {
    if (state.phase === "keeping") {
      setLockedCoins([false, false, false, false, false]);
    }
  }, [state.phase, state.round]);

  const canInteract = isDesignatedPlayer && !submitting && !session.winner;

  const toggleLock = useCallback((idx: number) => {
    if (!canInteract || state.phase !== "keeping") return;
    setLockedCoins((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      // Sync to server so observers see the selection live. Chain to preserve order.
      lockSyncChainRef.current = lockSyncChainRef.current.then(() =>
        fetch("/api/games/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            action: "set-locks",
            lockedCoins: next,
          }),
        }).catch(() => {})
      );
      return next;
    });
  }, [canInteract, state.phase, session.id]);

  const sendAction = useCallback(async (action: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/games/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action,
          lockedCoins,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error("Move failed:", data?.error);
      }
    } finally {
      setSubmitting(false);
    }
  }, [session.id, lockedCoins]);

  const showPortraits = !!(player.character || opponent);

  // Phase-specific UI text
  let phaseText = "";
  if (session.winner) {
    phaseText = "";
  } else if (!isDesignatedPlayer) {
    switch (state.phase) {
      case "casting":
        phaseText = state.round > 1 ? "Awaiting next cast" : "Awaiting cast";
        break;
      case "keeping":
        phaseText = `Choosing keeps · ${state.castsRemaining} recast${state.castsRemaining !== 1 ? "s" : ""} left`;
        break;
      case "showdown":
        phaseText = "";
        break;
      case "round-end":
        phaseText = "Round complete";
        break;
    }
  } else {
    switch (state.phase) {
      case "casting":
        phaseText = state.round > 1 ? "Ready for next round" : "Cast the runes to begin";
        break;
      case "keeping":
        phaseText = `${state.castsRemaining} recast${state.castsRemaining !== 1 ? "s" : ""} remaining — tap coins to keep`;
        break;
      case "showdown":
        phaseText = "";
        break;
      case "round-end":
        phaseText = "Round complete";
        break;
    }
  }

  // Round result text
  let roundResultEl: React.ReactNode = null;
  if ((state.phase === "showdown" || state.phase === "round-end") && state.playerHand && state.opponentHand && !session.winner) {
    const handOrder = ["nothing", "one-pair", "two-pair", "three-of-a-kind", "full-house", "four-of-a-kind", "straight", "five-of-a-kind"];
    const cmp = handOrder.indexOf(state.playerHand) - handOrder.indexOf(state.opponentHand);
    const text = cmp > 0 ? "You win this round!" : cmp < 0 ? "Opponent wins this round" : "Round tied";
    const color = cmp > 0 ? "text-amber-300/60" : cmp < 0 ? "text-purple-300/60" : "text-white/40";
    roundResultEl = (
      <p className={`text-[9px] sm:text-xs tracking-[0.2em] uppercase ${color}`} style={cinzel}>
        {isDesignatedPlayer ? text : (cmp > 0 ? `${player.character ?? player.username} wins` : cmp < 0 ? "Opponent wins" : "Tied")}
      </p>
    );
  }

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

      <div className="flex flex-col items-center gap-4 sm:gap-5">
        {/* Score + title */}
        <div className="flex flex-col items-center gap-2">
          {config.roundCount > 1 && (
            <p className="text-xl sm:text-2xl tracking-[0.15em] text-white/50 tabular-nums" style={cinzel}>
              {state.playerWins} – {state.opponentWins}
            </p>
          )}
          <p className="text-[9px] sm:text-xs tracking-[0.4em] uppercase text-white/20" style={cinzel}>
            Rune Poker
          </p>
          {config.roundCount > 1 && (
            <p className="text-xs sm:text-sm tracking-[0.25em] uppercase text-white/40 tabular-nums" style={cinzel}>
              Round {state.round} of {config.roundCount}
            </p>
          )}
        </div>

        {/* Board panel */}
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

          <div className="p-5 sm:p-8 relative">
            {/* Victory overlay */}
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
              const title = isDraw ? "DRAW" : (playerWon ? "VICTORY" : "DEFEAT");
              const titleColor = isDraw
                ? "text-white/60"
                : playerWon ? "text-amber-300/80" : "text-purple-400/80";
              const lineColor = isDraw
                ? "rgba(99, 102, 241, 0.3)"
                : playerWon ? "rgba(212, 175, 55, 0.4)" : "rgba(139, 92, 246, 0.4)";

              return (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-[2px] rounded-xl"
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

            <div className="flex flex-col items-center gap-4 sm:gap-5">
              {/* Side-by-side coin columns: player (left) | divider | opponent (right) */}
              <div className="flex items-start gap-4 sm:gap-6">
                {/* Player: kept tray on the LEFT (outer side) */}
                <CoinColumn
                  coins={state.playerCoins}
                  lockedCoins={
                    isDesignatedPlayer
                      ? lockedCoins
                      : (state.lockedCoins ?? [false, false, false, false, false])
                  }
                  owner="player"
                  canLock={canInteract && state.phase === "keeping"}
                  onToggleLock={toggleLock}
                  flipping={flipping}
                  label={isDesignatedPlayer ? "You" : (player.character ?? player.username)}
                  handRank={state.playerHand ? handLabel(state.playerHand) : null}
                  keptSide="left"
                />

                {/* Vertical divider */}
                <div className="self-stretch flex items-center">
                  <div className="w-px h-full min-h-[280px]" style={{ background: "linear-gradient(to bottom, transparent, rgba(99, 102, 241, 0.25), transparent)" }} />
                </div>

                {/* Opponent: kept tray on the RIGHT (outer side) */}
                <CoinColumn
                  coins={state.opponentCoins}
                  lockedCoins={state.opponentLockedCoins ?? [false, false, false, false, false]}
                  owner="opponent"
                  canLock={false}
                  flipping={flipping}
                  label={opponent?.name ?? "Opponent"}
                  handRank={state.opponentHand ? handLabel(state.opponentHand) : null}
                  keptSide="right"
                />
              </div>

              {/* Round result */}
              {roundResultEl}

              {/* Action buttons */}
              {canInteract && (
                <div className="flex gap-3">
                  {(state.phase === "casting" || state.phase === "round-end") && (
                    <button
                      onClick={() => sendAction("cast")}
                      disabled={submitting}
                      className="px-5 py-2 rounded-lg border border-amber-400/30 text-amber-300/70 hover:text-amber-300 hover:border-amber-400/50 hover:bg-amber-400/10 disabled:opacity-30 cursor-pointer transition-all text-[9px] sm:text-[10px] tracking-[0.15em] uppercase"
                      style={cinzel}
                    >
                      {submitting ? "Casting..." : state.phase === "round-end" ? "Next Round" : "Cast the Runes"}
                    </button>
                  )}

                  {state.phase === "keeping" && (
                    <>
                      <button
                        onClick={() => sendAction("recast")}
                        disabled={submitting || state.castsRemaining <= 0}
                        className="px-5 py-2 rounded-lg border border-amber-400/30 text-amber-300/70 hover:text-amber-300 hover:border-amber-400/50 hover:bg-amber-400/10 disabled:opacity-30 cursor-pointer transition-all text-[9px] sm:text-[10px] tracking-[0.15em] uppercase"
                        style={cinzel}
                      >
                        {submitting ? "Recasting..." : "Recast"}
                      </button>
                      <button
                        onClick={() => sendAction("end-turn")}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg border border-white/15 text-white/35 hover:text-white/60 hover:border-white/25 hover:bg-white/5 disabled:opacity-30 cursor-pointer transition-all text-[9px] sm:text-[10px] tracking-[0.15em] uppercase"
                        style={cinzel}
                      >
                        Stand
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phase text */}
        {phaseText && (
          <p className="text-[8px] sm:text-[9px] tracking-[0.25em] uppercase text-white/25" style={cinzel}>
            {phaseText}
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

      {/* Animations */}
      <style>{`
        @keyframes coinFlip {
          0% { transform: perspective(400px) rotateY(0deg); }
          50% { transform: perspective(400px) rotateY(180deg); opacity: 0.6; }
          100% { transform: perspective(400px) rotateY(360deg); }
        }
      `}</style>
    </div>
  );
}
