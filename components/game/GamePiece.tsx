"use client";

import { memo } from "react";
import type { PieceOwner } from "@/types/game";

interface GamePieceProps {
  owner: PieceOwner;
  selected?: boolean;
  interactive?: boolean;
}

function SwordShape({ color, selected }: { color: string; selected?: boolean }) {
  return (
    <>
      {/* Blade */}
      <path
        d="M20 4 L23 8 L22 24 L20 26 L18 24 L17 8 Z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth="1"
        strokeOpacity={0.8}
        strokeLinejoin="round"
      />
      {/* Blade center line */}
      <line x1="20" y1="6" x2="20" y2="24" stroke={color} strokeWidth="0.5" strokeOpacity={0.4} />
      {/* Cross guard */}
      <path
        d="M13 25 L27 25 L26 27 L14 27 Z"
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth="0.8"
        strokeOpacity={0.7}
        strokeLinejoin="round"
      />
      {/* Guard gem */}
      <circle cx="20" cy="26" r="1.5" fill={color} fillOpacity={selected ? 0.7 : 0.4} />
      {/* Grip */}
      <rect x="19" y="27" width="2" height="6" rx="0.5" fill={color} fillOpacity={0.25} stroke={color} strokeWidth="0.5" strokeOpacity={0.5} />
      {/* Pommel */}
      <circle cx="20" cy="35" r="2" fill={color} fillOpacity={0.2} stroke={color} strokeWidth="0.8" strokeOpacity={0.6} />
    </>
  );
}

function TripleDiamondShape({ color, selected }: { color: string; selected?: boolean }) {
  return (
    <>
      {/* Left diamond */}
      <path
        d="M9 20 L14 12 L19 20 L14 28 Z"
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth="0.8"
        strokeOpacity={0.7}
        strokeLinejoin="round"
      />
      {/* Center diamond (slightly overlapping, larger) */}
      <path
        d="M13 20 L20 9 L27 20 L20 31 Z"
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth="1"
        strokeOpacity={0.85}
        strokeLinejoin="round"
      />
      {/* Right diamond */}
      <path
        d="M21 20 L26 12 L31 20 L26 28 Z"
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth="0.8"
        strokeOpacity={0.7}
        strokeLinejoin="round"
      />
      {/* Center gem */}
      <circle cx="20" cy="20" r="2.5" fill={color} fillOpacity={selected ? 0.6 : 0.35} />
    </>
  );
}

function GamePiece({ owner, selected, interactive }: GamePieceProps) {
  const isPlayer = owner === "player";

  const baseColor = isPlayer ? "#D4AF37" : "#8B5CF6";
  const glowColor = isPlayer ? "rgba(255, 215, 0, 0.4)" : "rgba(139, 92, 246, 0.4)";
  const selectedGlow = isPlayer ? "rgba(255, 215, 0, 0.7)" : "rgba(139, 92, 246, 0.7)";

  return (
    <button
      className={`w-full h-full flex items-center justify-center transition-transform duration-200 ${
        interactive ? "cursor-pointer hover:scale-110" : "cursor-default pointer-events-none"
      }`}
    >
      <svg viewBox="0 0 40 40" className="w-full h-full">
        {/* Glow */}
        <defs>
          <radialGradient id={`glow-${owner}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={selected ? selectedGlow : glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill={`url(#glow-${owner})`} opacity={selected ? 1 : 0.5} />

        {/* Shape */}
        {isPlayer ? (
          <SwordShape color={baseColor} selected={selected} />
        ) : (
          <TripleDiamondShape color={baseColor} selected={selected} />
        )}

        {/* Pulse animation when selected */}
        {selected && (
          <circle cx="20" cy="20" r="16" fill="none" stroke={baseColor} strokeWidth="1" strokeOpacity="0.5">
            <animate attributeName="r" from="14" to="20" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </button>
  );
}

export default memo(GamePiece);
