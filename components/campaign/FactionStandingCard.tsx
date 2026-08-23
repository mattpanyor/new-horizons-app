"use client";

import type { FactionStanding } from "@/types/campaign";
import { standingVerdict, type StandingTone } from "@/lib/campaign/standing";
import StandingBar from "./StandingBar";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// A card, sized to sit in one of the three standing columns. The verdict is
// the largest thing on it — the bar is the evidence, the word is the point.

const TONE = {
  hostile: { text: "#fca5a5", glow: "rgba(239,68,68,0.18)", edge: "rgba(239,68,68,0.45)" },
  friendly: { text: "#6ee7b7", glow: "rgba(16,185,129,0.18)", edge: "rgba(16,185,129,0.45)" },
  neutral: { text: "rgba(255,255,255,0.45)", glow: "transparent", edge: "rgba(255,255,255,0.14)" },
} as const satisfies Record<StandingTone, { text: string; glow: string; edge: string }>;

// Equilateral pointy-top hexagon. The vertices are inset to 6.7%/93.3%
// horizontally because a regular hexagon is only 0.866 as wide as it is tall —
// stretching one to fill a square box makes the four slanted sides 11.8% longer
// than the two vertical ones, which reads as a slightly bloated hex.
// components/HexAvatar.tsx still uses the square-filling version; this is
// deliberately local until that convention is changed app-wide.
const HEX_CLIP = "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)";

/** The faction's sigil, framed. Falls back to its colour and initial. */
function FactionMark({ standing }: { standing: FactionStanding }) {
  const logo = standing.logoUrl?.trim() ? standing.logoUrl : null;

  return (
    <div className="relative w-12 h-12 shrink-0">
      <div
        className="absolute inset-0 p-[1.5px] transition-all duration-500 group-hover:brightness-125"
        style={{
          clipPath: HEX_CLIP,
          background: `${standing.color}88`,
          filter: `drop-shadow(0 0 10px ${standing.color}44)`,
        }}
      >
        <div
          className="w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden"
          style={{ clipPath: HEX_CLIP }}
        >
          {logo ? (
            <img src={logo} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg leading-none" style={{ ...cinzel, color: standing.color }}>
              {standing.name.replace(/^House\s+/i, "").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
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
  const tone = TONE[verdict.tone];
  const logo = standing.logoUrl?.trim() ? standing.logoUrl : null;

  return (
    <article
      className={`group relative overflow-hidden rounded-lg border border-white/[0.07] bg-slate-950/72 backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-slate-950/82 ${
        standing.hidden ? "opacity-40" : ""
      }`}
    >
      {/* Lit top edge in the verdict's colour */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${tone.edge}, transparent)` }}
      />

      {/* Verdict glow pooling at the top of the card */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 transition-opacity duration-500"
        style={{ background: `linear-gradient(to bottom, ${tone.glow}, transparent)` }}
      />

      {/* Sigil watermark, bleeding off the corner */}
      {logo && (
        <div
          className="pointer-events-none absolute -right-5 -top-4 w-28 h-28 opacity-[0.06] group-hover:opacity-[0.13] transition-opacity duration-700"
          aria-hidden
        >
          <img src={logo} alt="" className="w-full h-full object-contain" />
        </div>
      )}

      <div className="relative px-4 py-4">
        <div className="flex items-center gap-3">
          <FactionMark standing={standing} />

          <div className="min-w-0 flex-1">
            <h3
              className="text-[10px] tracking-[0.18em] uppercase text-white/70 truncate transition-colors duration-500 group-hover:text-white/90"
              style={cinzel}
              title={standing.name}
            >
              {standing.name}
            </h3>
            <span
              className="mt-1 block text-sm lg:text-base tracking-[0.12em] lg:tracking-[0.16em] uppercase leading-none transition-colors duration-500"
              style={{
                ...cinzel,
                color: tone.text,
                textShadow: verdict.tone === "neutral" ? "none" : `0 0 22px ${tone.glow}`,
              }}
            >
              {verdict.label}
            </span>
          </div>

          {editable && (
            <button
              type="button"
              onClick={() => onChange(standing.slug, { hidden: !standing.hidden })}
              className="shrink-0 self-start text-[9px] tracking-[0.18em] uppercase text-white/35 hover:text-white/80 transition-colors"
              style={cinzel}
              title={
                standing.hidden
                  ? "Show this faction to players"
                  : "Hide this faction from players"
              }
            >
              {standing.hidden ? "Hidden" : "Hide"}
            </button>
          )}
        </div>

        <div className="mt-4 flex justify-center">
          <StandingBar
            red={standing.red}
            green={standing.green}
            onChange={editable ? (fields) => onChange(standing.slug, fields) : undefined}
          />
        </div>
      </div>
    </article>
  );
}
