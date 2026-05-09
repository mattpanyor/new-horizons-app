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
      href="/ship"
      title="Ship"
      className="fixed top-20 right-3 sm:right-6 z-40 flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 hover:bg-white/5 transition-all"
      style={{ backdropFilter: "blur(8px)", background: "rgba(10,10,30,0.5)" }}
    >
      <svg width="32" height="32" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Simple spaceship */}
        <path d="M24 8 L28 20 L26 24 L22 24 L20 20 Z" fill="currentColor" fillOpacity="0.08" strokeOpacity="0.6" />
        <line x1="24" y1="8" x2="24" y2="24" strokeWidth="0.6" strokeOpacity="0.3" />
        <line x1="21" y1="24" x2="19" y2="27" strokeOpacity="0.4" />
        <line x1="27" y1="24" x2="29" y2="27" strokeOpacity="0.4" />
        {/* Orbit line below */}
        <ellipse cx="24" cy="36" rx="16" ry="5" strokeOpacity="0.3" strokeDasharray="2 3" />
      </svg>
      <span
        className="text-[7px] tracking-[0.15em] uppercase"
        style={cinzel}
      >
        Ship
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
          <p className="text-white/30 text-lg tracking-[0.4em] uppercase" style={cinzel}>
            Awaiting Transmission
          </p>
        </div>
      </>
    );
  }

  // Active game
  const { session, player, opponent, viewer } = data as ActiveGameResponse;
  const isDesignatedPlayer = username === session.designatedPlayer;
  const isMyTurn = isDesignatedPlayer && "turn" in session.state && session.state.turn === "player";

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
        key={session.id}
        session={session}
        player={player}
        opponent={opponent}
        viewer={viewer}
        isDesignatedPlayer={isDesignatedPlayer}
        isMyTurn={isMyTurn}
        username={username}
        victoryText={gameDef.victoryText}
      />
    </div>
  );
}
