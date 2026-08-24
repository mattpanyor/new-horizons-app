"use client";

import { useRef, type CSSProperties, type PointerEvent } from "react";
import type { FactionStanding } from "@/types/campaign";
import { standingVerdict, type StandingTone } from "@/lib/campaign/standing";
import StandingBar from "./StandingBar";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// A playing card, dealt into one of the three standing columns. Proportions are
// a real card's 5:7 and the sigil hangs off the top edge, so a column reads as a
// hand rather than as a list of panels. The verdict is still the largest thing
// on the face — the bar is the evidence, the word is the point.

// Only the verdict word is coloured by the standing. Everything else on the
// card — frame, edge light, halo, wash — is the faction's own colour, so a
// column of cards reads as a row of houses rather than a block of red or green.
const VERDICT_COLOR = {
  hostile: "#fca5a5",
  friendly: "#6ee7b7",
  neutral: "rgba(255,255,255,0.5)",
} as const satisfies Record<StandingTone, string>;

/**
 * The faction's sigil, standing up out of the top of the card.
 *
 * It sits inside the card element so it tilts with it, but outside the clipped
 * face — the overhang is the point, and the slot above reserves room for it.
 * The art is the only mark on the card now, so it is drawn at full strength
 * with a shadow under it to lift it off the face.
 */
function FactionSigil({ standing }: { standing: FactionStanding }) {
  const logo = standing.logoUrl?.trim() ? standing.logoUrl : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[4] flex justify-center">
      <div className="w-[92%] aspect-square -translate-y-[33%] transition-transform duration-500 group-hover:-translate-y-[38%]">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="w-full h-full object-contain transition-all duration-500 group-hover:brightness-115"
            style={{
              filter: `drop-shadow(0 10px 16px rgba(2,6,23,0.75)) drop-shadow(0 0 22px ${standing.color}55)`,
            }}
          />
        ) : (
          // No art on file: the initial, set as large as the sigil would be.
          <div className="flex h-full w-full items-end justify-center">
            <span
              className="text-5xl leading-none"
              style={{
                ...cinzel,
                color: standing.color,
                textShadow: `0 0 26px ${standing.color}66`,
              }}
            >
              {standing.name.replace(/^House\s+/i, "").charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  standing: FactionStanding;
  /** Superadmins set the cells and hide factions; everyone else reads. */
  editable: boolean;
  onChange: (slug: string, fields: { red?: number; green?: number; hidden?: boolean }) => void;
}

export default function FactionStandingCard({ standing, editable, onChange }: Props) {
  const verdict = standingVerdict(standing.red, standing.green);
  const verdictColor = VERDICT_COLOR[verdict.tone];
  const accent = standing.color;
  const cardRef = useRef<HTMLElement>(null);

  // Written straight onto the node: the cursor moves far more often than
  // anything on this card changes, and a state update per pointer event would
  // re-render every column. See .fc-card in globals.css for what reads them.
  const track = (event: PointerEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    el.style.setProperty("--fc-px", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--fc-py", `${(y * 100).toFixed(1)}%`);
    el.style.setProperty("--fc-rx", `${((0.5 - y) * 8).toFixed(2)}deg`);
    el.style.setProperty("--fc-ry", `${((x - 0.5) * 10).toFixed(2)}deg`);
  };

  // Back to the class defaults — the card settles flat rather than holding the
  // last angle the pointer left it at.
  const release = () => {
    const el = cardRef.current;
    if (!el) return;
    for (const prop of ["--fc-px", "--fc-py", "--fc-rx", "--fc-ry"]) {
      el.style.removeProperty(prop);
    }
  };

  return (
    // The slot reserves the overhang, so the sigil of a card in the second row
    // never lands on the card above it.
    <div className="relative pt-[31%]">
      <article
        ref={cardRef}
        onPointerMove={track}
        onPointerLeave={release}
        className="fc-card group relative aspect-[5/7] rounded-xl border border-white/[0.09] hover:border-white/25 hover:z-10"
        style={{ "--fc-edge": `${accent}80`, "--fc-halo": `${accent}99` } as CSSProperties}
      >
        {/* The face — everything that has to stay inside the card's frame. */}
        <div className="absolute inset-0 overflow-hidden rounded-xl bg-[#060a16]/85 backdrop-blur-md">
          {/* Faction colour washing down from the top edge */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(115% 62% at 50% 0%, ${accent}3d, transparent 64%)`,
            }}
          />

          <div className="ct-weave absolute inset-0 opacity-40" aria-hidden />

          {/* Foot shadow, so the bar sits on something */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />

          {/* Lit top edge in the verdict's colour */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${accent}c0, transparent)` }}
          />
        </div>

        {/* Inner rule, the way a card frames its art */}
        <div
          className="pointer-events-none absolute inset-[5px] rounded-[9px] border transition-colors duration-500"
          style={{ borderColor: `${accent}33` }}
        />

        <FactionSigil standing={standing} />

        {/* Withhold. Sits half off the corner, the way a card is plucked out of
            a hand by its edge, and only a superadmin is ever offered it. */}
        {editable && (
          <button
            type="button"
            onClick={() => onChange(standing.slug, { hidden: true })}
            className="absolute -right-2 -top-2 z-[7] grid h-5 w-5 place-items-center rounded-full border border-white/15 bg-slate-950/90 text-[10px] leading-none text-white/45 shadow-[0_2px_8px_rgba(2,6,23,0.8)] transition-colors hover:border-red-400/60 hover:bg-red-950/70 hover:text-red-200 focus-visible:border-red-400/60 focus-visible:text-red-200"
            title="Withhold this faction — moves it to the list below, out of the players' view"
            aria-label={`Withhold ${standing.name}`}
          >
            ×
          </button>
        )}

        <div
          className="relative z-[3] flex h-full flex-col items-center px-3 pb-3 pt-[68%] text-center"
          style={{ containerType: "inline-size" }}
        >
          <h3
            className="line-clamp-3 text-[11px] leading-[1.35] tracking-[0.09em] uppercase text-white/75 transition-colors duration-500 group-hover:text-white"
            style={cinzel}
            title={standing.name}
          >
            {standing.name}
          </h3>

          <div className="my-auto flex flex-col items-center gap-2">
            <span
              className="h-px w-7"
              style={{ background: `linear-gradient(to right, transparent, ${accent}aa)` }}
            />
            <span
              className="block text-[clamp(15px,11cqw,19px)] leading-none tracking-[0.1em] uppercase transition-colors duration-500"
              style={{
                ...cinzel,
                color: verdictColor,
                textShadow: verdict.tone === "neutral" ? "none" : `0 0 24px ${verdictColor}66`,
              }}
            >
              {verdict.label}
            </span>
            <span
              className="h-px w-7"
              style={{ background: `linear-gradient(to left, transparent, ${accent}aa)` }}
            />
          </div>

          <StandingBar
            red={standing.red}
            green={standing.green}
            onChange={editable ? (fields) => onChange(standing.slug, fields) : undefined}
          />
        </div>
      </article>
    </div>
  );
}
