"use client";

import { useEffect, useState } from "react";
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
  /** Narrow screens stack the sections; the same three states size the height
   *  instead of the width. Decided in CampaignTrackers, which owns the row. */
  stacked: boolean;
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
  stacked,
  onToggle,
  editable,
  onChange,
}: Props) {
  const accent = ACCENT[category];

  // The row only wraps once the panel has finished widening.
  //
  // Two cards fit a line at a third of the row and six at full width, so a
  // wrapping row reflows on every frame of the transition and the cards hop
  // between lines. Held to one line they keep their positions and the panel's
  // edge simply uncovers them; the wrap comes back at the end, by which point
  // it changes nothing unless there are more cards than fit a line.
  //
  // 520ms is the 500ms flex transition in .ct-panel plus a frame.
  const [settled, setSettled] = useState(open);
  useEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 520);
    return () => clearTimeout(timer);
  }, [open]);

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
  return (
    <section
      className="ct-panel relative flex min-w-0 flex-col overflow-hidden border backdrop-blur-[2px] transition-[flex,border-color,background] duration-500"
      style={{
        // Three states along one axis — width in a row, height in a stack.
        // Inline rather than in a stylesheet: this ships with the component, so
        // a section can never end up with no sizing at all because the CSS
        // bundle lagged behind the JS.
        flex: stacked
          ? open
            ? "1 1 auto"
            : collapsed
              ? "0 0 3rem"
              : "0 0 9rem"
          : collapsed
            ? "0 0 3.25rem"
            : "1 1 0%",
        borderColor: open ? `${accent}66` : `${accent}2e`,
        // A shut section is a plate, not an outline: without a fill of its own
        // the cover's linework floats on the starfield and the thirds do not
        // read as three things. Opened, it lightens off — the cards bring their
        // own faces and a heavy ground behind them muddies the crests.
        background: open
          ? `linear-gradient(150deg, ${accent}10, transparent 60%), rgba(5, 8, 18, 0.66)`
          : `linear-gradient(150deg, ${accent}1f, transparent 62%), rgba(7, 11, 24, 0.86)`,
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
            // Turned on its side only in a sliver, which exists in the row
            // layout; a stacked band is shut into a bar and reads across.
            writingMode: collapsed && !stacked ? "vertical-rl" : "horizontal-tb",
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
        <div // overflow-x is hidden explicitly: a visible x-axis computes to auto
        // beside an auto y-axis, and while the row is held to one line the
        // cards overflow it — which put a scrollbar along the foot of the
        // panel for the length of the animation.
        className="ct-band ct-panel-body relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pb-4 pt-6">
          {ordered.length === 0 ? (
            <p className="py-8 text-center text-[11px] italic text-white/30">
              No standing with anyone here yet.
            </p>
          ) : (
            // pr-2 is room for the withhold control, which sits half off the top
            // right corner of a card.
            // m-auto rather than centred alignment: with room to spare the row
            // sits in the middle of the taller panel, and when it overflows the
            // margins collapse instead of clipping the first line out of reach.
            <div
              // Deaf to the pointer until it settles, too: the panel's edge
              // sweeps the cards past a stationary cursor as it widens, and
              // each one it passes would take the hover and lift.
              className={`m-auto flex w-full gap-3 pr-2 sm:gap-4 ${
                settled ? "flex-wrap" : "flex-nowrap pointer-events-none"
              }`}
            >
              {ordered.map((standing) => (
                // 160px, not the 176 the old columns used: six of them and
                // their gaps have to clear the open panel, and Imperial
                // holds six. A section that fits on one line should not
                // wrap one card onto a second.
                <div key={standing.slug} className="w-40 shrink-0">
                  <FactionStandingCard
                    standing={standing}
                    description={standing.description}
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
