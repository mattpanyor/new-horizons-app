"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { ArcaneCardState, ArcaneCardPlayerState, SideCard, PlayedCard } from "@/types/game";
import type { GameBoardProps } from "./gameComponents";
import { MainCard, SideCardView } from "./ArcaneCardPieces";
import PlayerPortrait from "./PlayerPortrait";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const ANIM_STEP_MS = 550;

// ─── Helpers ───

function totalOf(played: PlayedCard[]): number {
  let t = 0;
  for (const p of played) {
    if (p.kind === "main") t += p.value;
    else if (p.playedAs === "positive") t += p.card.value;
    else t -= p.card.value;
  }
  return t;
}

// Apply a single played-card entry to a snapshot of state, updating played and hand.
// Used to stage animation snapshots between previous and current state.
function applyCardToSide(
  current: ArcaneCardState,
  side: "player" | "opponent",
  card: PlayedCard
): ArcaneCardState {
  const sidePlayer = current[side];
  const newPlayed = [...sidePlayer.played, card];
  let newHand = sidePlayer.hand;
  if (card.kind === "side") {
    newHand = sidePlayer.hand.filter((h) => h.id !== card.card.id);
  }
  return {
    ...current,
    [side]: { ...sidePlayer, played: newPlayed, hand: newHand },
  };
}

// ─── Art-deco golden divider ───

function ArtDecoDivider() {
  const gold = "rgba(212, 175, 55, 0.65)";
  const goldFaint = "rgba(212, 175, 55, 0.35)";
  const goldFill = "rgba(212, 175, 55, 0.12)";
  return (
    <div className="relative self-stretch flex items-center justify-center" style={{ width: 32 }}>
      {/* Vertical line */}
      <div
        className="absolute inset-y-6 w-px"
        style={{
          background: `linear-gradient(to bottom, transparent, ${gold} 8%, ${gold} 92%, transparent)`,
        }}
      />
      {/* Top cap */}
      <div className="absolute top-2 flex flex-col items-center gap-1">
        <div className="w-5 h-px" style={{ background: gold }} />
        <div className="w-2 h-2 rotate-45 border" style={{ borderColor: gold, background: goldFill }} />
        <div className="w-3 h-px" style={{ background: goldFaint }} />
      </div>
      {/* Upper accent diamond */}
      <div
        className="absolute w-2 h-2 rotate-45 border"
        style={{ top: "24%", borderColor: goldFaint, background: goldFill }}
      />
      {/* Center ornament */}
      <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center">
        <div
          className="relative w-6 h-6 rotate-45 border"
          style={{ borderColor: gold, background: goldFill, borderWidth: "1.5px" }}
        >
          <div className="absolute inset-1 border" style={{ borderColor: goldFaint }} />
          <div
            className="absolute inset-0 m-auto w-1.5 h-1.5 rounded-full"
            style={{ background: gold }}
          />
        </div>
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-px"
          style={{ background: goldFaint }}
        />
      </div>
      {/* Lower accent diamond */}
      <div
        className="absolute w-2 h-2 rotate-45 border"
        style={{ bottom: "24%", borderColor: goldFaint, background: goldFill }}
      />
      {/* Bottom cap */}
      <div className="absolute bottom-2 flex flex-col items-center gap-1">
        <div className="w-3 h-px" style={{ background: goldFaint }} />
        <div className="w-2 h-2 rotate-45 border" style={{ borderColor: gold, background: goldFill }} />
        <div className="w-5 h-px" style={{ background: gold }} />
      </div>
    </div>
  );
}

// ─── Sub-component: a single player's panel ───

interface PlayerPanelProps {
  state: ArcaneCardPlayerState;
  side: "player" | "opponent";
  hideHand: boolean;
  selectedHandId: string | null;
  flipState: Record<string, "positive" | "negative">;
  canInteract: boolean;
  onHandClick?: (cardId: string) => void;
  onFlip?: (cardId: string) => void;
}

function PlayerPanel({
  state,
  side,
  hideHand,
  selectedHandId,
  flipState,
  canInteract,
  onHandClick,
  onFlip,
}: PlayerPanelProps) {
  const total = totalOf(state.played);
  const isPlayer = side === "player";
  const bust = total > 20;
  const accent = bust ? "text-red-400" : isPlayer ? "text-amber-300/80" : "text-purple-300/80";
  const lineColor = isPlayer ? "rgba(212, 175, 55, 0.3)" : "rgba(139, 92, 246, 0.3)";

  return (
    <div
      className="flex flex-col items-center gap-3 p-4 rounded-lg min-w-[340px]"
      style={{
        background: "linear-gradient(145deg, rgba(8, 12, 28, 0.85), rgba(4, 6, 18, 0.9))",
        border: `1px solid ${lineColor}`,
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Big row: all committed cards */}
      <div
        className="flex flex-wrap justify-center gap-2 min-h-[112px] w-full"
        style={{ maxWidth: 340 }}
      >
        {state.played.map((p, idx) => (
          <div key={`c${idx}`} className="arcane-card-enter">
            {p.kind === "main" ? (
              <MainCard value={p.value} />
            ) : (
              <SideCardView card={p.card} playAs={p.playedAs} />
            )}
          </div>
        ))}
      </div>

      {/* Total + status */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-[0.25em] uppercase text-white/30" style={cinzel}>
            Total
          </span>
          <span className={`text-2xl font-semibold ${accent}`} style={cinzel}>
            {total}
          </span>
        </div>
        {state.standing && !bust && (
          <span className="text-[8px] tracking-[0.3em] uppercase text-white/40" style={cinzel}>
            Holding
          </span>
        )}
        {bust && (
          <span className="text-[8px] tracking-[0.3em] uppercase text-red-400/80" style={cinzel}>
            Bust
          </span>
        )}
      </div>

      {/* Divider */}
      <div
        className="w-full h-px"
        style={{ background: `linear-gradient(to right, transparent, ${lineColor}, transparent)` }}
      />

      {/* Small row: hand */}
      <div className="flex gap-2 justify-center min-h-[108px] items-center">
        {state.hand.length === 0 && (
          <span className="text-[8px] tracking-[0.25em] uppercase text-white/20" style={cinzel}>
            Hand Empty
          </span>
        )}
        {state.hand.map((card) => {
          const isSelected = selectedHandId === card.id;
          const playAs: "positive" | "negative" =
            card.kind === "mixed" ? flipState[card.id] ?? "positive" : (card.kind as "positive" | "negative");
          return (
            <div key={card.id} className="flex flex-col items-center gap-1">
              <SideCardView
                card={card}
                playAs={playAs}
                selected={isSelected}
                hidden={hideHand}
                onClick={canInteract && !hideHand ? () => onHandClick?.(card.id) : undefined}
              />
              {isSelected && card.kind === "mixed" && canInteract && onFlip && (
                <button
                  type="button"
                  onClick={() => onFlip(card.id)}
                  className="text-[8px] tracking-[0.2em] uppercase text-amber-300/70 hover:text-amber-300 cursor-pointer px-2 py-0.5 rounded border border-amber-400/30 hover:border-amber-400/60"
                  style={cinzel}
                >
                  Flip
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main board ───

export default function ArcaneCardBoard({
  session,
  player,
  opponent,
  isDesignatedPlayer,
  isMyTurn,
  victoryText,
}: GameBoardProps) {
  const sessionState = session.state as ArcaneCardState;

  // ─── Animation layer ───
  // latestState holds the most recent authoritative state we know about: either
  // from polling (session.state) or from a POST response. Whichever has the higher
  // moveCount wins. displayState is the state currently rendered on screen — it
  // gets advanced through snapshots when latestState moves ahead, producing the
  // step-by-step card appearances.
  const [latestState, setLatestState] = useState<ArcaneCardState>(sessionState);
  const [displayState, setDisplayState] = useState<ArcaneCardState>(sessionState);
  const [animating, setAnimating] = useState(false);
  const lastAnimatedMoveCountRef = useRef<number>(sessionState.moveCount);
  const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Records "sessionId:moveCount" pairs we've already fired a rematch POST for,
  // so effect re-runs (e.g. on session object identity change from polling)
  // don't queue a duplicate trigger.
  const rematchFiredForRef = useRef<string | null>(null);

  // Ingest polling updates into latestState when they're newer
  useEffect(() => {
    if (sessionState.moveCount > latestState.moveCount) {
      setLatestState(sessionState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState.moveCount]);

  // Diff and animate when latestState moves ahead of what we've already animated
  useEffect(() => {
    if (latestState.moveCount === lastAnimatedMoveCountRef.current) return;

    // Cancel any pending animations from a previous diff
    animTimeoutsRef.current.forEach(clearTimeout);
    animTimeoutsRef.current = [];

    const prev = displayState;
    const playerDiff = latestState.player.played.slice(prev.player.played.length);
    const opponentDiff = latestState.opponent.played.slice(prev.opponent.played.length);

    // If there's no card diff (e.g. a pure standing change), just jump
    if (playerDiff.length === 0 && opponentDiff.length === 0) {
      setDisplayState(latestState);
      lastAnimatedMoveCountRef.current = latestState.moveCount;
      return;
    }

    // Build snapshots with pairwise interleave: player's i-th new card, then
    // opponent's i-th new card, and so on. This produces the sequence
    //   p action → ai action → p next-card → ai next-card
    // for the normal case, and "all ai cards in chronological order" for the
    // solo case where player has no new entries.
    const snapshots: ArcaneCardState[] = [];
    let current = prev;
    const maxSteps = Math.max(playerDiff.length, opponentDiff.length);
    for (let i = 0; i < maxSteps; i++) {
      if (i < playerDiff.length) {
        current = applyCardToSide(current, "player", playerDiff[i]);
        snapshots.push(current);
      }
      if (i < opponentDiff.length) {
        current = applyCardToSide(current, "opponent", opponentDiff[i]);
        snapshots.push(current);
      }
    }

    setAnimating(true);

    snapshots.forEach((snap, idx) => {
      const timer = setTimeout(() => {
        setDisplayState(snap);
      }, (idx + 1) * ANIM_STEP_MS);
      animTimeoutsRef.current.push(timer);
    });

    // Final sync: ensure displayState matches latestState exactly (standing labels,
    // winner state, hand state drift, etc.) and clear the animating flag.
    const finalTimer = setTimeout(() => {
      setDisplayState(latestState);
      setAnimating(false);
      lastAnimatedMoveCountRef.current = latestState.moveCount;
    }, (snapshots.length + 1) * ANIM_STEP_MS);
    animTimeoutsRef.current.push(finalTimer);

    return () => {
      animTimeoutsRef.current.forEach(clearTimeout);
      animTimeoutsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestState.moveCount]);

  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [flipState, setFlipState] = useState<Record<string, "positive" | "negative">>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rematchCountdown, setRematchCountdown] = useState<number | null>(null);
  // Serialize set-preview POSTs so they land in click order even when the
  // player rapidly flips back and forth.
  const previewSyncChainRef = useRef<Promise<unknown>>(Promise.resolve());

  const canInteract =
    isDesignatedPlayer &&
    isMyTurn &&
    !submitting &&
    !session.winner &&
    !displayState.player.standing &&
    !animating;

  // The selection actually rendered on screen: optimistic local for the
  // designated player; server-synced playerSelection for observers.
  const observedSelection = !isDesignatedPlayer ? latestState.playerSelection ?? null : null;
  const effectiveSelectedId: string | null = isDesignatedPlayer
    ? selectedHandId
    : observedSelection?.cardId ?? null;
  const effectiveFlipState: Record<string, "positive" | "negative"> = isDesignatedPlayer
    ? flipState
    : observedSelection
      ? { [observedSelection.cardId]: observedSelection.playAs }
      : {};

  const selectedCard = useMemo<SideCard | null>(() => {
    if (!effectiveSelectedId) return null;
    return displayState.player.hand.find((c) => c.id === effectiveSelectedId) ?? null;
  }, [effectiveSelectedId, displayState.player.hand]);

  // Compute what the server's playerSelection should be for the given local
  // (cardId, flipState) and fire a set-preview POST. Fire-and-forget; the chain
  // ref keeps requests serialized.
  const syncPreview = useCallback(
    (cardId: string | null, currentFlip: Record<string, "positive" | "negative">) => {
      let preview: { cardId: string; playAs: "positive" | "negative" } | null = null;
      if (cardId) {
        const card = displayState.player.hand.find((c) => c.id === cardId);
        if (card) {
          const playAs: "positive" | "negative" =
            card.kind === "mixed"
              ? currentFlip[card.id] ?? "positive"
              : (card.kind as "positive" | "negative");
          preview = { cardId, playAs };
        }
      }
      previewSyncChainRef.current = previewSyncChainRef.current.then(() =>
        fetch("/api/games/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            action: "set-preview",
            preview,
          }),
        }).catch(() => {})
      );
    },
    [displayState.player.hand, session.id]
  );

  const handleHandClick = useCallback(
    (cardId: string) => {
      if (!canInteract) return;
      setSelectedHandId((prev) => {
        const next = prev === cardId ? null : cardId;
        syncPreview(next, flipState);
        return next;
      });
    },
    [canInteract, flipState, syncPreview]
  );

  const handleFlip = useCallback((cardId: string) => {
    setFlipState((prev) => {
      const next = {
        ...prev,
        [cardId]: prev[cardId] === "negative" ? "positive" : "negative" as "positive" | "negative",
      };
      // Push the new flip state to the server tied to the same selected card.
      syncPreview(cardId, next);
      return next;
    });
  }, [syncPreview]);

  const submitMove = useCallback(
    async (terminal: "end-turn" | "hold") => {
      if (!canInteract) return;
      setSubmitting(true);
      setErrorMsg(null);

      let playSide: { cardId: string; playAs: "positive" | "negative" } | undefined;
      if (selectedCard) {
        const playAs: "positive" | "negative" =
          selectedCard.kind === "mixed"
            ? flipState[selectedCard.id] ?? "positive"
            : (selectedCard.kind as "positive" | "negative");
        playSide = { cardId: selectedCard.id, playAs };
      }

      try {
        const res = await fetch("/api/games/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            moveVersion: latestState.moveCount,
            playSide,
            terminal,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setErrorMsg(data?.error ?? "Move failed");
        } else {
          const data = await res.json().catch(() => null);
          setSelectedHandId(null);
          // Feed the POST response directly into latestState so animation kicks off
          // immediately instead of waiting for the next poll.
          if (data?.state && data.state.moveCount > latestState.moveCount) {
            setLatestState(data.state as ArcaneCardState);
          }
        }
      } finally {
        setSubmitting(false);
      }
    },
    [canInteract, selectedCard, flipState, session.id, latestState.moveCount]
  );

  // Victory overlay state
  const showVictory = !!session.winner;
  const playerWon = session.winner === "player";
  const isDraw = session.winner === "draw";

  // Auto-rematch on stalemate — designated player fires the POST, both sides see the countdown
  useEffect(() => {
    if (!isDraw) {
      setRematchCountdown(null);
      return;
    }
    setRematchCountdown(3);

    const ticks = [
      setTimeout(() => setRematchCountdown(2), 1000),
      setTimeout(() => setRematchCountdown(1), 2000),
      setTimeout(() => setRematchCountdown(0), 3000),
    ];

    const stalemateKey = `${session.id}:${sessionState.moveCount}`;
    let triggerTimer: ReturnType<typeof setTimeout> | null = null;
    if (isDesignatedPlayer && rematchFiredForRef.current !== stalemateKey) {
      triggerTimer = setTimeout(async () => {
        // Mark as fired immediately when the timer actually runs — the server
        // guard (409) handles the case where another tab beat us to it.
        rematchFiredForRef.current = stalemateKey;
        try {
          const res = await fetch("/api/games/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session.id,
              action: "rematch",
            }),
          });
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data?.state) {
              setLatestState((prev) => {
                const nextState = data.state as ArcaneCardState;
                return nextState.moveCount > prev.moveCount ? nextState : prev;
              });
            }
          }
        } catch {
          /* polling will surface the error state if any */
        }
      }, 3500);
    }

    return () => {
      ticks.forEach(clearTimeout);
      if (triggerTimer) clearTimeout(triggerTimer);
    };
  }, [isDraw, isDesignatedPlayer, session.id, sessionState.moveCount]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <style>{`
        @keyframes arcaneCardIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .arcane-card-enter { animation: arcaneCardIn 380ms ease-out; }
      `}</style>
      {/* Title */}
      <p className="text-xs tracking-[0.4em] uppercase text-white/20" style={cinzel}>
        Arcane Card
      </p>

      {/* Top bar: turn indicator + controls OR victory overlay */}
      <div className="flex flex-col items-center gap-2 min-h-[72px] justify-center">
        {showVictory ? (
          <div
            className="flex flex-col items-center gap-1"
            style={{ animation: "arcaneVictoryIn 0.5s ease-out" }}
          >
            <style>{`@keyframes arcaneVictoryIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }`}</style>
            <h2
              className={`text-4xl sm:text-5xl font-semibold tracking-[0.3em] ${
                isDraw ? "text-white/60" : playerWon ? "text-amber-300/80" : "text-purple-400/80"
              }`}
              style={cinzel}
            >
              {isDraw ? "STALEMATE" : playerWon ? "VICTORY" : "DEFEAT"}
            </h2>
            <p className="text-xs text-white/50 text-center max-w-[320px]" style={cinzel}>
              {isDraw
                ? victoryText.draw
                : isDesignatedPlayer
                ? playerWon
                  ? victoryText.playerWin
                  : victoryText.playerLose
                : playerWon
                ? victoryText.spectatorWin
                : victoryText.spectatorLose}
            </p>
            {isDraw && rematchCountdown !== null && (
              <p
                className="mt-1 text-[9px] tracking-[0.25em] uppercase text-amber-300/70"
                style={cinzel}
              >
                {rematchCountdown > 0
                  ? `Reshuffling in ${rematchCountdown}...`
                  : "Reshuffling..."}
              </p>
            )}
          </div>
        ) : (
          <>
            <span className="text-[9px] tracking-[0.3em] uppercase text-white/40" style={cinzel}>
              {animating
                ? "Resolving..."
                : isMyTurn
                ? "Your Turn"
                : displayState.turn === "player"
                ? `${player.character ?? player.username}'s Turn`
                : `${opponent?.name ?? "Opponent"}'s Turn`}
            </span>
            {canInteract && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => submitMove("end-turn")}
                  disabled={submitting}
                  className="px-8 py-3 rounded border border-indigo-400/40 text-[13px] tracking-[0.3em] uppercase text-indigo-300/80 hover:text-indigo-200 hover:border-indigo-400/70 hover:bg-indigo-400/10 disabled:opacity-30 cursor-pointer transition-all"
                  style={cinzel}
                >
                  Call
                </button>
                <button
                  type="button"
                  onClick={() => submitMove("hold")}
                  disabled={submitting}
                  className="px-4 py-1.5 rounded border border-amber-400/40 text-[9px] tracking-[0.2em] uppercase text-amber-300/80 hover:text-amber-200 hover:border-amber-400/70 hover:bg-amber-400/10 disabled:opacity-30 cursor-pointer transition-all"
                  style={cinzel}
                >
                  Hold
                </button>
              </div>
            )}
            {selectedCard && canInteract && (
              <p className="text-[8px] text-white/30" style={cinzel}>
                Card selected — Call or Hold to play it
              </p>
            )}
            {errorMsg && (
              <p className="text-[9px] text-red-400/80" style={cinzel}>
                {errorMsg}
              </p>
            )}
          </>
        )}
      </div>

      {/* Main area: two panels with art-deco divider */}
      <div className="flex items-stretch gap-3">
        {/* Player portrait (left) */}
        <PlayerPortrait
          name={player.character}
          title={player.role}
          imageUrl={player.imageUrl}
          group={player.group}
          side="player"
        />

        {/* Player panel — selection state is mirrored from the server when the
            viewer isn't the designated player, so observers see the same card
            highlighted and the same flip preview the player is deliberating on. */}
        <div
          className="transition-[filter] duration-500"
          style={{ filter: showVictory ? "blur(2.25px)" : "none" }}
        >
          <PlayerPanel
            state={displayState.player}
            side="player"
            hideHand={false}
            selectedHandId={effectiveSelectedId}
            flipState={effectiveFlipState}
            canInteract={canInteract}
            onHandClick={handleHandClick}
            onFlip={handleFlip}
          />
        </div>

        {/* Art-deco golden divider */}
        <ArtDecoDivider />

        {/* Opponent panel */}
        <div
          className="transition-[filter] duration-500"
          style={{ filter: showVictory ? "blur(2.25px)" : "none" }}
        >
          <PlayerPanel
            state={displayState.opponent}
            side="opponent"
            hideHand={true}
            selectedHandId={null}
            flipState={{}}
            canInteract={false}
          />
        </div>

        {/* Opponent portrait (right) */}
        {opponent && (
          <PlayerPortrait
            name={opponent.name}
            title={opponent.title}
            imageUrl={opponent.imageUrl}
            side="opponent"
          />
        )}
      </div>
    </div>
  );
}
