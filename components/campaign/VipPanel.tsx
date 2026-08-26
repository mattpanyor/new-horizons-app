"use client";

import { useState } from "react";
import type { Vip, VipDossier } from "@/types/campaign";
import { INTEGRITY_CELLS, countIntact, integrityTier } from "@/lib/campaign/integrity";
import { VIP_BLURB_MAX, VIP_TAGLINE_MAX } from "@/lib/campaign/constants";
import IntegrityHexCluster from "./IntegrityHexCluster";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };
// Equilateral pointy-top hexagon. The vertices are inset to 6.7%/93.3%
// horizontally because a regular hexagon is only 0.866 as wide as it is tall —
// stretching one to fill a square box makes the four slanted sides 11.8% longer
// than the two vertical ones, which reads as a slightly bloated hex.
// components/HexAvatar.tsx still uses the square-filling version; this is
// deliberately local until that convention is changed app-wide.
const HEX_CLIP = "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)";

/** Framed portrait with counter-rotating rings — the panel's focal object. */
function Portrait({ dossier, color }: { dossier: VipDossier; color: string }) {
  return (
    <div className="relative w-52 h-52 sm:w-60 sm:h-60 shrink-0">
      {/* Rotating tick rings */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        <g className="ct-ring-cw">
          <circle
            cx="100" cy="100" r="94"
            fill="none" stroke={color} strokeOpacity="0.28"
            strokeWidth="0.8" strokeDasharray="2 10"
          />
        </g>
        <g className="ct-ring-ccw">
          <circle
            cx="100" cy="100" r="86"
            fill="none" stroke={color} strokeOpacity="0.4"
            strokeWidth="1" strokeDasharray="34 14 6 14"
          />
        </g>
      </svg>

      {/* Corner brackets, matching the tactical frame used on HexAvatar */}
      <div className="absolute top-1 left-1 w-4 h-4 border-t border-l" style={{ borderColor: `${color}88` }} />
      <div className="absolute top-1 right-1 w-4 h-4 border-t border-r" style={{ borderColor: `${color}88` }} />
      <div className="absolute bottom-1 left-1 w-4 h-4 border-b border-l" style={{ borderColor: `${color}88` }} />
      <div className="absolute bottom-1 right-1 w-4 h-4 border-b border-r" style={{ borderColor: `${color}88` }} />

      <div
        className="absolute inset-6 p-[2px] transition-all duration-500"
        style={{
          clipPath: HEX_CLIP,
          background: `${color}88`,
          filter: `drop-shadow(0 0 22px ${color}55)`,
        }}
      >
        <div
          className="w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center"
          style={{ clipPath: HEX_CLIP }}
        >
          {dossier.imageUrl ? (
            <img
              src={dossier.imageUrl}
              alt={dossier.name}
              className="w-full h-full object-cover object-top"
              style={{ filter: "contrast(1.05) saturate(0.92)" }}
            />
          ) : (
            <span className="text-4xl text-white/45" style={cinzel}>
              {dossier.name.charAt(0)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** One labelled figure in the readout strip. */
function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] tracking-[0.3em] uppercase text-white/45" style={cinzel}>
        {label}
      </span>
      <span
        className="text-sm tracking-[0.14em] uppercase"
        style={{ ...cinzel, color: color ?? "rgba(255,255,255,0.88)" }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Lock toggle. Locked hides the subject and its whole anonymity log from every
 * player; unlocked publishes both to the table.
 *
 * It states the consequence rather than the state — "players cannot see this"
 * is what a GM needs to know at a glance, and a padlock alone reads as a thing
 * you must open before you can look, which is not what it means.
 */
function LockToggle({
  locked,
  onSet,
}: {
  locked: boolean;
  onSet: (locked: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSet(!locked);
    } finally {
      setBusy(false);
    }
  };

  const accent = locked ? "#94a3b8" : "#34d399";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      title={
        locked
          ? "Locked — only superadmins see this subject. Click to reveal it to all players."
          : "Visible to all players. Click to hide it again."
      }
      className="group/lock inline-flex items-center gap-2 rounded border px-3 py-1.5 transition-all duration-300 disabled:opacity-40"
      style={{ borderColor: `${accent}44`, background: `${accent}0f` }}
    >
      {locked ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2">
          <rect x="4" y="11" width="16" height="10" rx="1.5" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2">
          <rect x="4" y="11" width="16" height="10" rx="1.5" />
          <path d="M8 11V7a4 4 0 0 1 8 0" />
        </svg>
      )}
      <span
        className="text-[9px] tracking-[0.2em] uppercase whitespace-nowrap"
        style={{ ...cinzel, color: accent }}
      >
        {locked ? "Hidden from players" : "Visible to players"}
      </span>
    </button>
  );
}

/**
 * The subject's description: read-only text that a superadmin can click to
 * rewrite in place.
 *
 * Same interaction as the anonymity log — click the text, edit, Enter to save,
 * Escape to cancel — so the two editable surfaces on this page behave the same
 * way rather than each inventing their own.
 */
function BlurbEditor({
  blurb,
  editable,
  onSave,
}: {
  blurb: string;
  editable: boolean;
  /** Resolves true when the write landed. False leaves the draft alone. */
  onSave: (blurb: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(blurb);
  const [busy, setBusy] = useState(false);

  if (!editable) {
    if (!blurb) return null;
    return (
      <p className="mt-4 max-w-md mx-auto sm:mx-0 text-[13px] leading-relaxed text-white/70">
        {blurb}
      </p>
    );
  }

  if (editing) {
    const commit = async () => {
      if (busy) return;
      setBusy(true);
      try {
        // Keep the editor open when the write is refused, so the text the
        // error refers to is still there to fix.
        if (!(await onSave(draft))) return;
        setEditing(false);
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="mt-4 max-w-md mx-auto sm:mx-0 flex flex-col gap-2">
        <textarea
          value={draft}
          autoFocus
          rows={4}
          maxLength={VIP_BLURB_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              setDraft(blurb);
              setEditing(false);
            }
          }}
          className="w-full resize-none rounded border border-white/15 bg-black/40 px-2.5 py-2 text-[13px] leading-relaxed text-white/85 outline-none focus:border-indigo-400/50"
          placeholder="Describe this subject…"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void commit()}
            className="text-[9px] tracking-[0.22em] uppercase text-indigo-300/80 hover:text-indigo-200 disabled:opacity-40"
            style={cinzel}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(blurb);
              setEditing(false);
            }}
            className="text-[9px] tracking-[0.22em] uppercase text-white/45 hover:text-white/80"
            style={cinzel}
          >
            Cancel
          </button>
          <span className="ml-auto font-mono text-[9px] tabular-nums text-white/40">
            {draft.trim().length}/{VIP_BLURB_MAX}
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        // Re-seed from props: the value may have changed since this mounted.
        setDraft(blurb);
        setEditing(true);
      }}
      title="Click to edit"
      className="mt-4 block max-w-md mx-auto sm:mx-0 text-center sm:text-left text-[13px] leading-relaxed transition-colors hover:text-white/70"
      style={{ color: blurb ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)" }}
    >
      {blurb || "Add a description…"}
    </button>
  );
}

/** The constant half of the eyebrow. Every subject on this page is one. */
const EYEBROW_PREFIX = "Unique Asset";

/**
 * "UNIQUE ASSET — CONTINUITY CRITICAL".
 *
 * The prefix is fixed in code; only what follows the dash is stored per VIP,
 * because what a subject *is* to the campaign differs and being a unique asset
 * does not. Clearing the tagline drops the separator with it.
 */
function Eyebrow({
  tagline,
  editable,
  onSave,
}: {
  tagline: string;
  editable: boolean;
  /** Resolves true when the write landed. False leaves the draft alone. */
  onSave: (tagline: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tagline);
  const [busy, setBusy] = useState(false);

  const label = tagline ? `${EYEBROW_PREFIX} — ${tagline}` : EYEBROW_PREFIX;
  const cls = "text-[9px] tracking-[0.45em] uppercase";

  if (!editable) {
    return (
      <span className={`${cls} text-white/50`} style={cinzel}>
        {label}
      </span>
    );
  }

  if (editing) {
    const commit = async () => {
      if (busy) return;
      setBusy(true);
      try {
        // Keep the editor open when the write is refused, so the text the
        // error refers to is still there to fix.
        if (!(await onSave(draft))) return;
        setEditing(false);
      } finally {
        setBusy(false);
      }
    };

    return (
      <span className="flex items-center justify-center sm:justify-start gap-2">
        <span className={`${cls} text-white/50 shrink-0`} style={cinzel}>
          {EYEBROW_PREFIX} —
        </span>
        <input
          value={draft}
          autoFocus
          maxLength={VIP_TAGLINE_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              setDraft(tagline);
              setEditing(false);
            }
          }}
          placeholder="tagline"
          className={`${cls} min-w-0 flex-1 max-w-[16rem] rounded border border-white/15 bg-black/40 px-2 py-1 text-white/80 outline-none focus:border-indigo-400/50`}
          style={cinzel}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        // Re-seed from props: the value may have changed since this mounted.
        setDraft(tagline);
        setEditing(true);
      }}
      title="Click to edit"
      className={`${cls} text-white/50 hover:text-white/80 transition-colors`}
      style={cinzel}
    >
      {label}
    </button>
  );
}

interface Props {
  vip: Vip;
  editable: boolean;
  onToggleCell: (index: number, intact: boolean) => void;
  onSetLocked: (locked: boolean) => Promise<void>;
  /** Resolve true when the write landed; false keeps the editor open. */
  onSetBlurb: (blurb: string) => Promise<boolean>;
  onSetTagline: (tagline: string) => Promise<boolean>;
}

export default function VipPanel({
  vip,
  editable,
  onToggleCell,
  onSetLocked,
  onSetBlurb,
  onSetTagline,
}: Props) {
  const { dossier } = vip;
  const intact = countIntact(vip.cells);
  const tier = integrityTier(intact);
  const pct = Math.round((intact / INTEGRITY_CELLS) * 100);
  const dead = intact <= 0;

  return (
    <div
      className="ct-scan ct-sweep relative overflow-hidden rounded-xl border bg-slate-950/78 backdrop-blur-xl"
      style={{ borderColor: `${tier.color}33` }}
    >
      {/* Tier colour bleeding in from the top edge */}
      <div
        className="absolute inset-x-0 top-0 h-40 pointer-events-none transition-colors duration-700"
        style={{ background: `linear-gradient(to bottom, ${tier.color}14, transparent)` }}
      />
      <div className="ct-weave absolute inset-0 opacity-60 pointer-events-none" />

      {editable && (
        <div className="absolute top-4 right-4 z-[3]">
          <LockToggle locked={vip.minAccessLevel > 0} onSet={onSetLocked} />
        </div>
      )}

      <div className="relative z-[2] p-6 sm:p-9">
        {/* Three columns only at xl — at lg the identity block gets squeezed
            under its own paragraph width, so the cluster drops below instead. */}
        <div className="flex flex-col xl:flex-row items-center xl:items-start gap-9 xl:gap-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 flex-1 min-w-0">
            <Portrait dossier={dossier} color={tier.color} />

            {/* Identity + status */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <Eyebrow tagline={vip.tagline} editable={editable} onSave={onSetTagline} />

              <h3
                className="mt-2 text-3xl sm:text-4xl tracking-[0.2em] uppercase text-white/90"
                style={cinzel}
              >
                {dossier.name}
              </h3>

              {dossier.title && (
                <p
                  className="mt-1.5 text-xs tracking-[0.2em] uppercase text-white/60"
                  style={cinzel}
                >
                  {dossier.title}
                </p>
              )}

              <BlurbEditor blurb={vip.blurb} editable={editable} onSave={onSetBlurb} />

              <div className="mt-7 flex flex-wrap justify-center sm:justify-start gap-x-10 gap-y-5">
                <Readout label="Status" value={tier.label} color={tier.color} />
                <Readout label="Integrity" value={`${intact} / ${INTEGRITY_CELLS}`} />
                <Readout label="Margin" value={`${pct}%`} color={tier.color} />
              </div>

              {dossier.kankaUrl && (
                <a
                  href={dossier.kankaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 inline-flex items-center gap-2 text-[9px] tracking-[0.3em] uppercase text-white/50 hover:text-indigo-300 transition-colors"
                  style={cinzel}
                >
                  Open dossier
                  <svg
                    width="10" height="10" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Integrity cluster */}
          <div className="flex flex-col items-center gap-4 shrink-0">
            <span className="text-[9px] tracking-[0.36em] uppercase text-white/45" style={cinzel}>
              Integrity
            </span>
            <IntegrityHexCluster
              cells={vip.cells}
              onToggle={editable ? onToggleCell : undefined}
            />


            {editable && (
              <span className="text-[9px] tracking-[0.14em] uppercase text-white/40" style={cinzel}>
                Click a cell to toggle it
              </span>
            )}
          </div>
        </div>

        {dead && (
          <div className="mt-8 rounded-lg border border-red-500/40 bg-red-950/30 px-5 py-3.5 text-center">
            <span
              className="text-[11px] tracking-[0.35em] uppercase text-red-300/90 combat-status-pulse"
              style={cinzel}
            >
              Integrity zero — campaign terminated
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
