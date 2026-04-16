"use client";

import { memo } from "react";
import Image from "next/image";
import type { SideCard } from "@/types/game";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const CARD_W = 72;
const CARD_H = 108;

// ─── Main deck card (light gold frame with a single center number) ───

interface MainCardProps {
  value: number; // +1..+10
  dimmed?: boolean;
}

function MainCardInner({ value, dimmed }: MainCardProps) {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: CARD_W,
        height: CARD_H,
        filter: dimmed ? "brightness(0.6) saturate(0.6)" : undefined,
      }}
    >
      <Image
        src="/games/arcanecard/fullcard1_small.png"
        alt=""
        fill
        sizes={`${CARD_W}px`}
        className="pointer-events-none select-none object-contain"
        draggable={false}
      />
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={cinzel}
      >
        <span
          className="text-2xl font-semibold"
          style={{ color: "#8B6F1F", textShadow: "0 1px 2px rgba(255, 230, 150, 0.3)" }}
        >
          +{value}
        </span>
      </div>
    </div>
  );
}

export const MainCard = memo(MainCardInner);

// ─── Side deck card (black frame, two stacked boxes) ───

interface SideCardViewProps {
  card: SideCard;
  playAs?: "positive" | "negative"; // for mixed cards or played cards
  selected?: boolean;
  hidden?: boolean;                  // renders as a card back (no number)
  onClick?: () => void;
  dimmed?: boolean;
}

function SideCardViewInner({ card, playAs, selected, hidden, onClick, dimmed }: SideCardViewProps) {
  // Determine which box gets the number
  let effectiveSign: "positive" | "negative" | null = null;
  if (!hidden) {
    if (card.kind === "positive") effectiveSign = "positive";
    else if (card.kind === "negative") effectiveSign = "negative";
    else effectiveSign = playAs ?? "positive";
  }

  const topValue = effectiveSign === "positive" ? `+${card.value}` : null;
  const bottomValue = effectiveSign === "negative" ? `-${card.value}` : null;

  const isClickable = !!onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`relative shrink-0 transition-transform ${
        isClickable ? "cursor-pointer hover:-translate-y-1" : "cursor-default"
      } ${selected ? "-translate-y-2" : ""}`}
      style={{
        width: CARD_W,
        height: CARD_H,
        filter: selected
          ? "drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))"
          : dimmed
          ? "brightness(0.55) saturate(0.6)"
          : undefined,
      }}
    >
      <Image
        src="/games/arcanecard/fullcard2_small.png"
        alt=""
        fill
        sizes={`${CARD_W}px`}
        className="pointer-events-none select-none object-contain"
        draggable={false}
      />
      {/* Top box overlay */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: "18%",
          right: "18%",
          top: "14%",
          height: "34%",
          ...cinzel,
        }}
      >
        {topValue && (
          <span
            className="text-xl font-semibold"
            style={{ color: "#7DB8FF", textShadow: "0 0 8px rgba(125, 184, 255, 0.5)" }}
          >
            {topValue}
          </span>
        )}
      </div>
      {/* Bottom box overlay */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: "18%",
          right: "18%",
          bottom: "14%",
          height: "34%",
          ...cinzel,
        }}
      >
        {bottomValue && (
          <span
            className="text-xl font-semibold"
            style={{ color: "#FF7D7D", textShadow: "0 0 8px rgba(255, 125, 125, 0.5)" }}
          >
            {bottomValue}
          </span>
        )}
      </div>
    </button>
  );
}

export const SideCardView = memo(SideCardViewInner);

// ─── Dimensions export for layout math ───

export const ARCANE_CARD_W = CARD_W;
export const ARCANE_CARD_H = CARD_H;
