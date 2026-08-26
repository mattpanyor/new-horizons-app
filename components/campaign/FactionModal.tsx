"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { FactionMember, FactionStanding } from "@/types/campaign";
import { standingVerdict } from "@/lib/campaign/standing";
import { VERDICT_COLOR } from "./FactionStandingCard";
import StandingBar from "./StandingBar";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// The card, opened up: the same crest, name, verdict and bar, plus the dossier
// the card has no room for.
//
// Identity still comes from lib/allegiances.ts by way of the standing — the
// modal reads nothing the card does not already hold.

const CUT =
  "polygon(28px 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%, 0 28px)";

/**
 * The dossier itself: the archive's account of a faction.
 *
 * Set in Cinzel rather than the body face. These are short passages — a
 * sentence or three — where the display serif reads as the archive's own hand
 * and not as a wall of text, and it is the same voice the rest of the panel
 * speaks in.
 *
 * The opening letter is dropped and struck in the faction's colour, the one
 * place the crest's hue reaches the prose. Skipped when the passage opens with
 * a bullet or a numeral, where a raised capital would just look like a mistake.
 *
 * Kanka's rich text arrives flattened (see kankaEntryToText), which leaves real
 * newlines: blank lines separate paragraphs and single ones hold list items
 * together. Both are honoured here — a plain <p> would collapse them into one
 * run-on line, which is what this replaced.
 */
function Dossier({ text, accent }: { text: string; accent: string }) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;

  const [first, ...rest] = paragraphs;
  const dropCap = /^\p{L}/u.test(first) ? first.slice(0, 1) : null;

  return (
    <div className="relative">
      {/* A hairline down the left edge, fading out: the margin rule of a page
          in a ledger. Decorative only. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-3 top-1 bottom-1 w-px"
        style={{ background: `linear-gradient(to bottom, ${accent}55, transparent)` }}
      />

      <div style={cinzel} className="space-y-3">
        <p className="whitespace-pre-line text-[14px] leading-7 tracking-[0.015em] text-white/80">
          {dropCap && (
            <span
              className="float-left mr-[6px] mt-[6px] text-[42px] font-semibold leading-[0.72]"
              style={{ color: accent, textShadow: `0 0 24px ${accent}55` }}
              aria-hidden
            >
              {dropCap}
            </span>
          )}
          {dropCap ? first.slice(1) : first}
        </p>

        {rest.map((para, i) => (
          <p
            key={i}
            className="whitespace-pre-line text-[14px] leading-7 tracking-[0.015em] text-white/80"
          >
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * The faction's roll: who Kanka records as belonging to it.
 *
 * Shown whether or not there is a description — a house with no written account
 * still tells you something by who stands in it. Each name links out to the
 * entity in Kanka, which is where the detail lives; this panel is an index, not
 * a copy of the archive.
 *
 * The label under a name is the member's role in this faction, or their own
 * title where the faction gives no role. See toMember in lib/campaign/service.
 */
function MemberRoll({ members, accent }: { members: FactionMember[]; accent: string }) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-3">
        <span
          className="text-[9px] tracking-[0.3em] uppercase"
          style={{ ...cinzel, color: `${accent}cc` }}
        >
          {members.length === 1 ? "Known Member" : "Known Members"}
        </span>
        <span
          className="h-px flex-1"
          style={{ background: `linear-gradient(to right, ${accent}55, transparent)` }}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.entityId} className="flex items-baseline gap-2.5">
            <span
              aria-hidden
              className="mt-[1px] h-[5px] w-[5px] shrink-0 rotate-45 border"
              style={{ borderColor: `${accent}aa`, background: `${accent}22` }}
            />
            <a
              href={m.kankaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            >
              <span
                className="text-[13px] tracking-[0.02em] text-white/85 underline decoration-transparent underline-offset-[3px] transition-all group-hover:text-white group-hover:decoration-current"
                style={cinzel}
              >
                {m.name}
              </span>
              {m.title && (
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-white/40 transition-colors group-hover:text-white/60"
                  style={cinzel}
                >
                  {m.title}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the dossier looks like when there isn't one.
 *
 * Written as the archive would put it rather than as an error, but still red:
 * a faction with no account is either unwritten or a pairing that failed, and
 * the second is worth noticing. It says "under this name" because that is what
 * the lookup will match on — the faction's display name against the archive's
 * — without printing the name back at a reader who can see it above.
 */
function NoDossier() {
  return (
    <div
      className="relative flex h-full min-h-[7rem] flex-col justify-center overflow-hidden border px-4 py-5"
      style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(69,10,10,0.22)" }}
    >
      {/* Corner brackets, in the app's usual language */}
      {[
        "left-0 top-0 border-l border-t",
        "right-0 top-0 border-r border-t",
        "left-0 bottom-0 border-l border-b",
        "right-0 bottom-0 border-r border-b",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`pointer-events-none absolute h-3 w-3 ${pos}`}
          style={{ borderColor: "rgba(248,113,113,0.7)" }}
        />
      ))}

      <div className="ct-scan absolute inset-0 opacity-40" aria-hidden />

      <div className="relative flex items-start gap-3">
        <span
          className="mt-[3px] h-2.5 w-2.5 shrink-0 rotate-45 border"
          style={{ borderColor: "#f87171", boxShadow: "0 0 10px rgba(239,68,68,0.6)" }}
          aria-hidden
        />
        <div className="min-w-0">
          <p
            className="text-[11px] tracking-[0.3em] uppercase text-red-300"
            style={{ ...cinzel, textShadow: "0 0 18px rgba(239,68,68,0.45)" }}
          >
            No dossier on file
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-white/50">
            The archive holds no account under this name.
          </p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  standing: FactionStanding;
  /**
   * The faction's description, once something supplies one. Nothing does yet —
   * see NoDossier for the name the eventual lookup matches on.
   */
  description: string | null;
  editable: boolean;
  onChange: (slug: string, fields: { red?: number; green?: number; hidden?: boolean }) => void;
  onClose: () => void;
}

export default function FactionModal({
  standing,
  description,
  editable,
  onChange,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const verdict = standingVerdict(standing.red, standing.green);
  const accent = standing.color;
  const logo = standing.logoUrl?.trim() ? standing.logoUrl : null;

  // Esc to close, focus trap, scroll lock — the shell this app's modals use.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={standing.name}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-4xl outline-none"
      >
        <div
          className="relative flex min-h-[32rem] flex-col overflow-hidden border"
          style={{
            clipPath: CUT,
            borderColor: `${accent}59`,
            background: "rgba(6,10,22,0.94)",
            boxShadow: `0 30px 70px -30px rgba(2,6,23,0.95), 0 0 40px -14px ${accent}66`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${accent}c0, transparent)` }}
            aria-hidden
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 grid h-6 w-6 rotate-45 place-items-center border border-white/20 bg-slate-950/80 text-white/50 transition-colors hover:border-red-400/70 hover:bg-red-950/70 hover:text-red-200"
          >
            <span className="-rotate-45 text-[12px] leading-none">×</span>
          </button>

          {/* The name reads across the panel, above both columns */}
          <header className="relative shrink-0 px-6 pr-14 pt-6 text-center">
            <h2
              className="text-[22px] leading-snug tracking-[0.12em] uppercase text-white/90 sm:text-[26px]"
              style={{ ...cinzel, textShadow: `0 0 30px ${accent}59` }}
            >
              {standing.name}
            </h2>
          </header>

          <div className="relative flex flex-1 flex-col gap-6 px-6 pb-7 pt-6 md:flex-row md:gap-7">
            {/* The crest, given the room the card could never give it */}
            <div className="flex shrink-0 flex-col items-center justify-center gap-6 self-center md:w-[44%] md:self-stretch">
              {logo ? (
                <img
                  src={logo}
                  alt=""
                  className="w-64 max-w-full md:w-full"
                  style={{ filter: "drop-shadow(0 14px 22px rgba(2,6,23,0.8))" }}
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center">
                  <span className="text-7xl leading-none" style={{ ...cinzel, color: accent }}>
                    {standing.name.replace(/^House\s+/i, "").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              {/* The cells sit with the crest, and this is the only place they
                  can be set — the card's copy is a read-out. */}
              <StandingBar
                red={standing.red}
                green={standing.green}
                size="lg"
                onChange={editable ? (fields) => onChange(standing.slug, fields) : undefined}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Labelled like the dossier below it, so the two blocks in this
                  column read as the same kind of record. */}
              <p
                className="mb-2 text-center text-[9px] tracking-[0.3em] uppercase"
                style={{ ...cinzel, color: `${accent}cc` }}
              >
                Standing
              </p>

              {/* The verdict on its own line, centred, with the rule running out
                  to both edges and a lozenge closing each side. */}
              <div className="flex items-center gap-3">
                <span className="flex flex-1 items-center gap-1.5" aria-hidden>
                  <span
                    className="h-px flex-1"
                    style={{ background: `linear-gradient(to right, transparent, ${accent}aa)` }}
                  />
                  <span className="h-[3px] w-[3px] rotate-45" style={{ background: `${accent}cc` }} />
                </span>

                <span
                  className="whitespace-nowrap text-2xl leading-none tracking-[0.12em] uppercase"
                  style={{
                    ...cinzel,
                    color: VERDICT_COLOR[verdict.tone],
                    textShadow:
                      verdict.tone === "neutral"
                        ? "none"
                        : `0 0 26px ${VERDICT_COLOR[verdict.tone]}66`,
                  }}
                >
                  {verdict.label}
                </span>

                <span className="flex flex-1 items-center gap-1.5" aria-hidden>
                  <span className="h-[3px] w-[3px] rotate-45" style={{ background: `${accent}cc` }} />
                  <span
                    className="h-px flex-1"
                    style={{ background: `linear-gradient(to left, transparent, ${accent}aa)` }}
                  />
                </span>
              </div>

              <div className="mt-6 flex flex-1 flex-col">
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="text-[9px] tracking-[0.3em] uppercase"
                    style={{ ...cinzel, color: `${accent}cc` }}
                  >
                    Dossier
                  </span>
                  <span
                    className="h-px flex-1"
                    style={{ background: `linear-gradient(to right, ${accent}55, transparent)` }}
                  />
                </div>

                <div className="flex flex-1 flex-col">
                  {/* The account grows to fill the panel only when it is the
                      whole of it. NoDossier is h-full by design — alone it
                      should hold the space rather than leave a gap under the
                      rule — but with a roll beneath it that same rule pushed
                      the names out of the panel. Given a roll, this wrapper
                      stays auto-height, so h-full resolves to nothing and
                      NoDossier falls back to its own min-height. */}
                  <div className={standing.members.length > 0 ? undefined : "flex-1"}>
                    {description?.trim() ? (
                      <Dossier text={description} accent={accent} />
                    ) : (
                      <NoDossier />
                    )}
                  </div>
                  {standing.members.length > 0 && (
                    <MemberRoll members={standing.members} accent={accent} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
