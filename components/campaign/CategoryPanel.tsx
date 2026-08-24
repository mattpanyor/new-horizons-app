"use client";

import type { FactionStanding } from "@/types/campaign";
import type { FactionCategory } from "@/lib/allegiances";
import { standingOrder } from "@/lib/campaign/standing";
import FactionStandingCard from "./FactionStandingCard";
import CategoryCover from "./CategoryCover";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

/** Section chrome. Not the factions' colours — one tone for the whole panel. */
const ACCENT: Record<FactionCategory, string> = {
  external: "#a855f7",
  nobility: "#6f9fd8",
  imperial: "#e6cf8a",
};

/* ------------------------------------------------------------ the section */

interface Props {
  category: FactionCategory;
  label: string;
  standings: FactionStanding[];
  open: boolean;
  /** Another section is open, so this one is down to a sliver. */
  collapsed: boolean;
  onToggle: () => void;
  editable: boolean;
  onChange: (slug: string, fields: { red?: number; green?: number; hidden?: boolean }) => void;
}

export default function CategoryPanel({
  category,
  label,
  standings,
  open,
  collapsed,
  onToggle,
  editable,
  onChange,
}: Props) {
  const accent = ACCENT[category];

  // One row, read left to right: the worst standing in this section at the
  // left, the best at the right. Cards wrap to a second line only when the row
  // runs out of width — nothing is stacked deliberately.
  const ordered = [...standings].sort(
    (a, b) =>
      standingOrder(a.red, a.green) - standingOrder(b.red, b.green) ||
      a.name.localeCompare(b.name),
  );

  // Three states, one axis: a third of the row at rest, a sliver when another
  // section has the floor, everything that is left when this one does.
  const flex = open ? "1 1 0%" : collapsed ? "0 0 3.25rem" : "1 1 0%";

  return (
    <section
      className="ct-panel relative flex min-w-0 flex-col overflow-hidden border transition-[flex,border-color] duration-500"
      style={{
        flex,
        borderColor: open ? `${accent}66` : `${accent}2e`,
        clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)",
      }}
      aria-label={label}
    >
      {/* Cover — the face the section wears while it is shut. It goes on open,
          which is the whole gesture: the art lifts and the cards are behind it. */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          open ? "opacity-0" : collapsed ? "opacity-25" : "opacity-100"
        }`}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(120% 80% at 50% 0%, ${accent}1f, transparent 70%)` }}
        />
        <CategoryCover category={category} accent={accent} />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#04060f] to-transparent" />
      </div>

      {/* Closed: the whole panel is the control. Open: its heading is. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`group relative z-10 flex text-left outline-none ${
          open
            ? "shrink-0 items-center gap-3 px-4 py-3"
            : collapsed
              ? "flex-1 flex-col items-center justify-center p-2"
              : "flex-1 flex-col justify-end p-4"
        }`}
      >
        <span
          className="whitespace-nowrap text-[11px] tracking-[0.34em] uppercase transition-colors group-hover:text-white"
          style={{
            ...cinzel,
            color: open ? "rgba(255,255,255,0.85)" : `${accent}dd`,
            writingMode: collapsed ? "vertical-rl" : "horizontal-tb",
          }}
        >
          {label}
        </span>

        {!collapsed && (
          <span
            className="text-[9px] tracking-[0.2em] uppercase text-white/35"
            style={{ ...cinzel, marginTop: open ? 0 : "0.4rem" }}
          >
            {open ? "Close" : `${standings.length} ${standings.length === 1 ? "faction" : "factions"}`}
          </span>
        )}

        {open && (
          <span
            className="h-px flex-1"
            style={{ background: `linear-gradient(to right, ${accent}55, transparent)` }}
          />
        )}
      </button>

      {/* Open: this section's factions, in order. */}
      {open && (
        <div className="ct-band ct-panel-body relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4">
          {ordered.length === 0 ? (
            <p className="py-8 text-center text-[11px] italic text-white/30">
              No standing with anyone here yet.
            </p>
          ) : (
            // pr-2 is room for the withhold control, which sits half off the top
            // right corner of a card.
            <div className="flex flex-wrap gap-3 pr-2 sm:gap-4">
              {ordered.map((standing) => (
                // 160px, not the 176 the old columns used: six of them and
                // their gaps have to clear the open panel, and Imperial
                // holds six. A section that fits on one line should not
                // wrap one card onto a second.
                <div key={standing.slug} className="w-40">
                  <FactionStandingCard
                    standing={standing}
                    editable={editable}
                    onChange={onChange}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </section>
  );
}
