"use client";

import { STANDING_MAX } from "@/lib/campaign/standing";

// The two-way standing meter: four red cells on the left, four green on the
// right. Both sides fill from their outer edge inward, so the two fronts
// advance toward the spine and a strong standing squeezes the neutral gap in
// the middle shut.
//
// Red and green are independent — a faction can hold two grudges and one debt
// at once — so this is two meters sharing a spine, not one slider.

const CELL_COUNTS = [1, 2, 3, 4] as const;

export type BarSize = "sm" | "lg";

const SIZE_CLASS: Record<BarSize, { cell: string; spine: string; gap: string; spineMx: string }> = {
  // `sm` is sized to the foot of a standing card: eight cells, both spines and
  // every gap have to clear the card's 5:7 width with its padding taken off.
  sm: { cell: "h-5 w-3", spine: "h-6", gap: "gap-[2px]", spineMx: "mx-1.5" },
  lg: { cell: "h-8 w-7 sm:h-9 sm:w-9", spine: "h-11", gap: "gap-[4px]", spineMx: "mx-2" },
};

interface CellProps {
  /** This cell's count, 1-4. */
  value: number;
  /** The side's current count, so the cell knows whether it is the top one. */
  current: number;
  side: "red" | "green";
  size: BarSize;
  onSet?: (value: number) => void;
}

const FILL = {
  red: {
    on: "bg-red-500/85 border-red-400/70 shadow-[0_0_10px_rgba(239,68,68,0.45)]",
    off: "bg-white/[0.04] border-white/10",
    hover: "hover:bg-red-500/40 hover:border-red-400/50",
  },
  green: {
    on: "bg-emerald-500/85 border-emerald-400/70 shadow-[0_0_10px_rgba(16,185,129,0.45)]",
    off: "bg-white/[0.04] border-white/10",
    hover: "hover:bg-emerald-500/40 hover:border-emerald-400/50",
  },
} as const;

function Cell({ value, current, side, size, onSet }: CellProps) {
  const tone = FILL[side];
  const filled = value <= current;
  const className = `${SIZE_CLASS[size].cell} border transition-all duration-300 ${
    filled ? tone.on : tone.off
  }`;
  const style = { transform: "skewX(-12deg)" };

  if (!onSet) {
    return <div className={className} style={style} aria-hidden />;
  }

  // Clicking the topmost filled cell steps back down, which is the only way to
  // reach zero without a separate reset control.
  const next = value === current ? value - 1 : value;

  return (
    <button
      type="button"
      onClick={() => onSet(next)}
      className={`${className} ${tone.hover} cursor-pointer`}
      style={style}
      title={`Set ${side} to ${next}`}
    />
  );
}

interface StandingBarProps {
  red: number;
  green: number;
  size?: BarSize;
  /** Omit to render read-only. */
  onChange?: (fields: { red?: number; green?: number }) => void;
}

export default function StandingBar({ red, green, size = "sm", onChange }: StandingBarProps) {
  // Each side counts up from its own outer edge: cell 1 is the leftmost red and
  // the rightmost green, so both meters grow inward toward the spine.
  const greenCells = [...CELL_COUNTS].reverse();

  return (
    <div className={`flex items-center ${SIZE_CLASS[size].gap}`}>
      {CELL_COUNTS.map((n) => (
        <Cell
          key={`r${n}`}
          value={n}
          current={red}
          side="red"
          size={size}
          onSet={onChange ? (value) => onChange({ red: value }) : undefined}
        />
      ))}

      {/* Spine — the neutral gap both fronts advance toward */}
      <div
        className={`w-px bg-white/25 ${SIZE_CLASS[size].spineMx} ${SIZE_CLASS[size].spine}`}
      />

      {greenCells.map((n) => (
        <Cell
          key={`g${n}`}
          value={n}
          current={green}
          side="green"
          size={size}
          onSet={onChange ? (value) => onChange({ green: value }) : undefined}
        />
      ))}
    </div>
  );
}

export { STANDING_MAX };
