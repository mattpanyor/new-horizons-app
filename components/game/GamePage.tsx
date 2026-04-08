"use client";

import Link from "next/link";
import { useGamePolling } from "@/hooks/useGamePolling";
import DotGridAnimation from "@/components/DotGridAnimation";
import { GAME_COMPONENTS } from "./gameComponents";
import { GAME_REGISTRY } from "@/lib/games/registry";
import type { ActiveGameResponse, GameType } from "@/types/game";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface GamePageProps {
  username: string;
}

export default function GamePage({ username }: GamePageProps) {
  const { data, loading } = useGamePolling();

  if (loading) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex items-center justify-center">
        <p className="text-white/30 text-xs tracking-[0.2em] uppercase" style={cinzel}>
          Loading...
        </p>
      </div>
    );
  }

  const gameNav = (
    <Link
      href="/sectors"
      title="Galaxy"
      className="fixed top-20 right-3 sm:right-6 z-40 flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 hover:bg-white/5 transition-all"
      style={{ backdropFilter: "blur(8px)", background: "rgba(10,10,30,0.5)" }}
    >
      <svg width="32" height="32" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Chess piece — king/queen silhouette */}
        <circle cx="24" cy="12" r="4" fill="currentColor" fillOpacity="0.1" />
        <path d="M20 16 L28 16 L30 28 L18 28 Z" fill="currentColor" fillOpacity="0.06" />
        <line x1="24" y1="8" x2="24" y2="6" strokeOpacity="0.6" />
        <line x1="22" y1="7" x2="26" y2="7" strokeOpacity="0.4" />
        <path d="M16 28 L16 32 Q16 34 18 34 L30 34 Q32 34 32 32 L32 28" fill="currentColor" fillOpacity="0.08" />
        <line x1="16" y1="34" x2="32" y2="34" strokeOpacity="0.5" />
        <path d="M14 34 L14 38 L34 38 L34 34" fill="currentColor" fillOpacity="0.05" />
      </svg>
      <span
        className="text-[7px] tracking-[0.15em] uppercase"
        style={cinzel}
      >
        Galaxy
      </span>
    </Link>
  );

  // No active game — show traveller animation
  if (!data || !data.active) {
    return (
      <>
        {gameNav}
        <DotGridAnimation />
        <div className="h-[calc(100dvh-4rem)] flex items-center justify-center">
          <p className="text-white/15 text-xs tracking-[0.3em] uppercase" style={cinzel}>
            Awaiting Orders
          </p>
        </div>
      </>
    );
  }

  // Active game
  const { session, player, opponent } = data as ActiveGameResponse;
  const isDesignatedPlayer = username === session.designatedPlayer;
  const isMyTurn = isDesignatedPlayer && session.state.turn === "player";

  const BoardComponent = GAME_COMPONENTS[session.gameType as GameType];
  if (!BoardComponent) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex items-center justify-center">
        <p className="text-red-400/60 text-xs tracking-[0.2em] uppercase" style={cinzel}>
          Unknown game type
        </p>
      </div>
    );
  }

  const gameDef = GAME_REGISTRY[session.gameType as GameType];

  return (
    <div className="h-[calc(100dvh-4rem)] flex items-center justify-center px-4 relative">
      <BoardComponent
        session={session}
        player={player}
        opponent={opponent}
        isDesignatedPlayer={isDesignatedPlayer}
        isMyTurn={isMyTurn}
        username={username}
        victoryText={gameDef.victoryText}
      />
    </div>
  );
}
