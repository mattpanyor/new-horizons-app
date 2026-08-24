"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { FactionStanding } from "@/types/campaign";
import { standingVerdict, type StandingTone } from "@/lib/campaign/standing";
import StandingBar from "./StandingBar";
import FactionModal from "./FactionModal";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// A playing card, dealt into one of the three standing columns. Proportions are
// a real card's 5:7 and the sigil hangs off the top edge, so a column reads as a
// hand rather than as a list of panels. The verdict is still the largest thing
// on the face — the bar is the evidence, the word is the point.

// Only the verdict word is coloured by the standing. Everything else on the
// card — frame, edge light, halo, wash — is the faction's own colour, so a
// column of cards reads as a row of houses rather than a block of red or green.
export const VERDICT_COLOR = {
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
              filter: `drop-shadow(0 10px 16px rgba(2,6,23,0.75)) drop-shadow(0 0 12px ${standing.color}4d)`,
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

/**
 * Rounded to two places, and that is load-bearing rather than tidiness.
 *
 * Math.sin and Math.cos are allowed to differ in the last bit between engines,
 * and the server renders this in Node while the browser re-renders it in
 * Chrome. An unrounded coordinate serialises as 49.72492184598873 on one side
 * and ...74 on the other, which React reports as a hydration mismatch.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The card's ornament: chamfered frame, corner brackets, a sunburst behind the
 * crest and a stepped base under the standing bar.
 *
 * Drawn as one SVG rather than a stack of bordered boxes, because none of these
 * shapes are rectangles. The viewBox is the card's own 5:7, so the scale is
 * uniform at every card width and a stroke of 1 unit is the same weight on a
 * 9rem card as on a 12rem one — and the chamfer here lands exactly on the one
 * the face is clipped to, which is stated in percentages for the same reason.
 */
function DecoFrame({ accent }: { accent: string }) {
  // The eight-sided silhouette: 7 units of corner taken off a 100x175 field.
  const outline = "M7 0 H93 L100 7 V168 L93 175 H7 L0 168 V7 Z";
  const inner = "M11 4 H89 L96 11 V164 L89 171 H11 L4 164 V11 Z";

  // Rays climbing out from behind the crest. Struck from an inner radius so the
  // sigil is never sitting on their common point.
  const rays = Array.from({ length: 13 }, (_, i) => {
    const deg = -78 + i * 13;
    const rad = (deg * Math.PI) / 180;
    const [cx, cy] = [50, 34];
    return {
      x1: r2(cx + Math.sin(rad) * 11),
      y1: r2(cy - Math.cos(rad) * 11),
      x2: r2(cx + Math.sin(rad) * 34),
      y2: r2(cy - Math.cos(rad) * 34),
    };
  });

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      viewBox="0 0 100 175"
      fill="none"
      aria-hidden
    >
      <g stroke={accent}>
        {rays.map((r, i) => (
          <line key={i} {...r} strokeWidth="0.5" opacity="0.16" />
        ))}

        {/* Fluting, the way a deco panel is ribbed */}
        {Array.from({ length: 13 }, (_, i) => (
          <line
            key={`f${i}`}
            x1={10 + i * 6.7}
            y1="62"
            x2={10 + i * 6.7}
            y2="150"
            strokeWidth="0.5"
            opacity="0.05"
          />
        ))}

        <path d={outline} strokeWidth="0.9" opacity="0.5" />
        <path d={inner} strokeWidth="0.45" opacity="0.3" />

        {/* Corner brackets, doubled inward — the deco stack */}
        <g strokeWidth="1.1" opacity="0.85" strokeLinecap="square">
          <path d="M11 4 H23 M4 11 V23" />
          <path d="M89 4 H77 M96 11 V23" />
          <path d="M11 171 H23 M4 164 V152" />
          <path d="M89 171 H77 M96 164 V152" />
        </g>
      </g>
    </svg>
  );
}

/** A rule with a lozenge struck through it — the divider, deco-fashion. */
function DecoRule({ accent }: { accent: string }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      <span
        className="h-px w-6"
        style={{ background: `linear-gradient(to right, transparent, ${accent}aa)` }}
      />
      <span className="h-[3px] w-[3px] rotate-45" style={{ background: `${accent}cc` }} />
      <span
        className="h-px w-6"
        style={{ background: `linear-gradient(to left, transparent, ${accent}aa)` }}
      />
    </span>
  );
}

interface Props {
  standing: FactionStanding;
  /**
   * The faction's description, shown in its modal. Nothing supplies one yet —
   * the modal prints what it is waiting for when this is null.
   */
  description?: string | null;
  /** Superadmins set the cells and hide factions; everyone else reads. */
  editable: boolean;
  onChange: (slug: string, fields: { red?: number; green?: number; hidden?: boolean }) => void;
}

export default function FactionStandingCard({
  standing,
  description = null,
  editable,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
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
    <div className="fc-slot relative pt-[31%]" style={{ "--fc-halo": `${accent}99` } as CSSProperties}>
      <article
        ref={cardRef}
        onPointerMove={track}
        onPointerLeave={release}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`${standing.name} — open dossier`}
        className="fc-card group relative aspect-[4/7]"
      >
        {/* The face — everything that has to stay inside the card's frame.
            Clipped to the deco silhouette rather than a rounded rectangle; the
            frame drawn over it in DecoFrame follows the same eight sides. */}
        <div
          className="absolute inset-0 overflow-hidden bg-[#060a16]/90"
          style={{ clipPath: "var(--fc-cut)" }}
        >
          {/* Faction colour washing down from the top edge */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(115% 62% at 50% 0%, ${accent}3d, transparent 64%)`,
            }}
          />

          {/* Foot shadow, so the bar sits on something */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />

          {/* Lit top edge in the verdict's colour */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${accent}c0, transparent)` }}
          />
        </div>

        <DecoFrame accent={accent} />

        <FactionSigil standing={standing} />

        {/* Withhold. Sits half off the corner, the way a card is plucked out of
            a hand by its edge, and only a superadmin is ever offered it. */}
        {editable && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange(standing.slug, { hidden: true });
            }}
            className="absolute -right-2 -top-2 z-[7] grid h-[18px] w-[18px] rotate-45 place-items-center border border-white/20 bg-slate-950/90 text-white/45 transition-colors hover:border-red-400/70 hover:bg-red-950/80 hover:text-red-200 focus-visible:border-red-400/70 focus-visible:text-red-200"
            title="Withhold this faction — moves it to the list below, out of the players' view"
            aria-label={`Withhold ${standing.name}`}
          >
            <span className="-rotate-45 text-[10px] leading-none">×</span>
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
            <DecoRule accent={accent} />
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
            <DecoRule accent={accent} />
          </div>

          {/* Read-only here, for everyone. The cells are set in the modal, so a
              click anywhere on the card means the same thing: open it. */}
          <StandingBar red={standing.red} green={standing.green} />
        </div>
      </article>

      {open && (
        <FactionModal
          standing={standing}
          description={description}
          editable={editable}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
