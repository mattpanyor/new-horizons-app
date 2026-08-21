"use client";

import { useState } from "react";
import { ALLEGIANCES, type AllegianceKey } from "@/lib/allegiances";
import type { Clue } from "@/types/investigation";
import ClueEditor from "./ClueEditor";
import { parseClueText } from "@/lib/investigation/clueText";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// Skip these when reducing a faction name to initials.
const TAG_FILLER = new Set(["of", "and", "the", "for", "in", "on", "at", "to", "a", "an"]);

// Per-slug overrides for the small badge shown on cards. Houses use the
// post-"House" name's prefix instead of "HA"/"HF" etc.
const TAG_OVERRIDES: Record<string, string> = {
  ashford: "ASH",
  fairfield: "FAIR",
  feyrose: "FEY",
  lenard: "LEN",
};

function factionShort(slug: string, name: string): string {
  const override = TAG_OVERRIDES[slug];
  if (override) return override;
  return name
    .split(/\s+/)
    .filter((w) => w && !TAG_FILLER.has(w.toLowerCase()))
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

function ClueTextWithMentions({ text }: { text: string }) {
  const tokens = parseClueText(text);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.kind === "text") {
          return <span key={i}>{tok.value}</span>;
        }
        return (
          <a
            key={i}
            href={tok.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-indigo-300/85 hover:text-indigo-200 underline decoration-dotted underline-offset-2"
          >
            {tok.name}
          </a>
        );
      })}
    </>
  );
}

interface ClueTileProps {
  clue: Clue;
  canDelete: boolean;
  onSave: (
    id: number,
    text: string,
    factionSlugs: string[],
    sessionNumber: number | null
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function CreatorAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        title={name}
        className="w-5 h-5 rounded-full object-cover border border-white/15"
      />
    );
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <span
      title={name}
      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] tracking-[0.1em] uppercase border border-white/15 bg-white/5 text-white/55"
      style={cinzel}
    >
      {initial}
    </span>
  );
}

export default function ClueTile({ clue, canDelete, onSave, onDelete }: ClueTileProps) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (editing) {
    return (
      <div className="relative">
        <ClueEditor
          initialText={clue.text}
          initialFactionSlugs={clue.factionSlugs}
          initialSessionNumber={clue.sessionNumber}
          onSave={async (text, factionSlugs, sessionNumber) => {
            await onSave(clue.id, text, factionSlugs, sessionNumber);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          autoFocusText
        />
      </div>
    );
  }

  const accent = clue.creatorColor ?? "#6366f1";
  // The session line sits below the faction tags, so it only claims a row of
  // vertical space on tiles that actually have one. Clues written before the
  // field existed keep the original layout rather than showing a blank gap.
  const hasSession = clue.sessionNumber !== null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative text-left p-3 rounded transition-all cursor-pointer overflow-hidden group focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/50"
      style={{
        background: `linear-gradient(155deg, ${accent}10, rgba(8,12,28,0.7))`,
        border: `1px solid ${accent}40`,
        minHeight: "108px",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* corner brackets */}
      <span className="absolute top-1 left-1 w-2.5 h-2.5 border-t border-l opacity-50" style={{ borderColor: accent }} />
      <span className="absolute top-1 right-1 w-2.5 h-2.5 border-t border-r opacity-50" style={{ borderColor: accent }} />
      <span className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b border-l opacity-50" style={{ borderColor: accent }} />
      <span className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r opacity-50" style={{ borderColor: accent }} />

      {/* clue text — top-aligned, reserves space at bottom for tags + avatar */}
      <p
        className={`text-[10px] leading-snug text-white/65 group-hover:text-white/90 transition-colors pr-6 ${hasSession ? "pb-12" : "pb-7"}`}
      >
        <ClueTextWithMentions text={clue.text} />
      </p>

      {/* faction tags — single row above the session line, clipped if too many */}
      <div
        className={`absolute left-3 right-9 flex gap-1 overflow-hidden ${hasSession ? "bottom-6" : "bottom-1.5"}`}
      >
        {clue.factionSlugs.map((slug) => {
          const f = ALLEGIANCES[slug as AllegianceKey];
          if (!f) return null;
          const initials = factionShort(slug, f.name);
          return (
            <span
              key={slug}
              title={f.name}
              className="shrink-0 text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-sm whitespace-nowrap"
              style={{ ...cinzel, background: `${f.color}25`, color: f.color }}
            >
              {initials}
            </span>
          );
        })}
      </div>

      {/* session the clue was discovered in — below the tags, omitted when unset */}
      {hasSession && (
        <span
          className="absolute left-3 bottom-1.5 text-[8px] tracking-[0.2em] uppercase text-white/30 whitespace-nowrap"
          style={cinzel}
          title={`Discovered in session ${clue.sessionNumber}`}
        >
          Session {clue.sessionNumber}
        </span>
      )}

      {/* creator avatar bottom-right */}
      <div className="absolute bottom-1.5 right-1.5">
        <CreatorAvatar name={clue.createdBy} imageUrl={clue.creatorImageUrl} />
      </div>

      {/* delete button (shows on hover, ≥66 only) */}
      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete this clue?`)) onDelete(clue.id);
          }}
          className={`absolute top-1.5 right-1.5 p-1 rounded text-white/30 hover:text-red-400 hover:bg-white/10 transition-all cursor-pointer ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          title="Delete clue"
          aria-label="Delete clue"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
