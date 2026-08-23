"use client";

import { useState } from "react";
import type { AnonymityEntry, AnonymityKind } from "@/types/campaign";
import { ANONYMITY_TEXT_MAX } from "@/lib/campaign/constants";
import { parseClueText } from "@/lib/investigation/clueText";
import MentionField from "./MentionField";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const KIND_STYLE = {
  confirmed: {
    title: "Confirmed",
    caption: "Established in play — they know",
    accent: "#f87171",
    border: "border-red-500/25",
    dot: "bg-red-400/70",
    empty: "Nobody is known to have seen through them.",
  },
  suspicion: {
    title: "Suspected",
    caption: "Unproven — who or what might be aware",
    accent: "#a5b4fc",
    border: "border-indigo-400/25",
    dot: "bg-indigo-300/60",
    empty: "No standing suspicions on record.",
  },
} as const;

/**
 * Renders @[Name](kanka:ID) markup as links out to the campaign wiki.
 *
 * The same markup and parser the investigation board uses, so a line copied
 * between the two renders identically. The anchor stops propagation because the
 * row around it is click-to-edit.
 */
function TextWithMentions({ text }: { text: string }) {
  return (
    <>
      {parseClueText(text).map((tok, i) =>
        tok.kind === "text" ? (
          <span key={i}>{tok.value}</span>
        ) : (
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
        )
      )}
    </>
  );
}

/** A single line: read-only until clicked, then an inline editor. */
function EntryRow({
  entry,
  index,
  dot,
  onSave,
  onDelete,
}: {
  entry: AnonymityEntry;
  index: number;
  dot: string;
  onSave: (id: number, text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.text);
  const [busy, setBusy] = useState(false);

  const commit = async () => {
    const text = draft.trim();
    if (!text || text === entry.text) {
      setDraft(entry.text);
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(entry.id, text);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  // Only shown when someone other than the author last touched the line — an
  // author editing their own entry adds no information worth a second name.
  const editedBy =
    entry.updatedBy && entry.updatedBy !== entry.createdBy ? entry.updatedBy : null;

  return (
    <li className="group relative flex gap-3 px-4 py-3 border-t border-white/[0.05] first:border-t-0 hover:bg-white/[0.02] transition-colors">
      <span
        className="mt-[7px] shrink-0 font-mono text-[9px] tabular-nums text-white/20"
        aria-hidden
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className={`mt-[9px] shrink-0 w-1 h-1 rotate-45 ${dot}`} aria-hidden />

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <MentionField
              multiline
              value={draft}
              autoFocus
              rows={2}
              maxLength={ANONYMITY_TEXT_MAX}
              onChange={setDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void commit();
                }
                if (e.key === "Escape") {
                  setDraft(entry.text);
                  setEditing(false);
                }
              }}
              className="w-full resize-none rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-[13px] text-white/85 outline-none focus:border-indigo-400/50"
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
                  setDraft(entry.text);
                  setEditing(false);
                }}
                className="text-[9px] tracking-[0.22em] uppercase text-white/25 hover:text-white/60"
                style={cinzel}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          // A div rather than a button: mention links live inside this text,
          // and an anchor nested in a button is invalid and unclickable.
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              // Re-seed from the entry: someone else may have rewritten this
              // line since the row mounted, and `draft` would still hold the
              // text it had then.
              setDraft(entry.text);
              setEditing(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setDraft(entry.text);
                setEditing(true);
              }
            }}
            className="block w-full cursor-pointer text-left text-[13px] leading-relaxed text-white/80 hover:text-white transition-colors"
            title="Click to edit"
          >
            <TextWithMentions text={entry.text} />
          </div>
        )}

        {!editing && (
          <div className="mt-1 flex items-center gap-2 text-[9px] tracking-[0.16em] uppercase text-white/40">
            <span style={cinzel}>{entry.createdBy}</span>
            {editedBy && (
              <>
                <span aria-hidden>·</span>
                <span style={cinzel}>ed. {editedBy}</span>
              </>
            )}
          </div>
        )}
      </div>

      {!editing && (
        <button
          type="button"
          onClick={() => void onDelete(entry.id)}
          className="shrink-0 self-start mt-1 opacity-0 group-hover:opacity-100 focus:opacity-100 text-white/25 hover:text-red-300/90 transition-all"
          title="Delete this line"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </li>
  );
}

function Composer({
  vipSlug,
  kind,
  onAdd,
}: {
  vipSlug: string;
  kind: AnonymityKind;
  onAdd: (vipSlug: string, kind: AnonymityKind, text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onAdd(vipSlug, kind, trimmed);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.05]">
      <span className="text-white/20 text-sm leading-none" aria-hidden>
        +
      </span>
      <div className="flex-1">
        <MentionField
          value={text}
          maxLength={ANONYMITY_TEXT_MAX}
          onChange={setText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={
            kind === "confirmed"
              ? "Who has confirmed knowledge… (@ to mention)"
              : "Who might suspect… (@ to mention)"
          }
          className="w-full bg-transparent text-[13px] text-white/80 placeholder:text-white/35 outline-none"
        />
      </div>
      {text.trim() && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="shrink-0 text-[9px] tracking-[0.22em] uppercase text-indigo-300/80 hover:text-indigo-200 disabled:opacity-40"
          style={cinzel}
        >
          Log
        </button>
      )}
    </div>
  );
}

function LogTable({
  vipSlug,
  kind,
  entries,
  onAdd,
  onSave,
  onDelete,
}: {
  vipSlug: string;
  kind: AnonymityKind;
  entries: AnonymityEntry[];
  onAdd: (vipSlug: string, kind: AnonymityKind, text: string) => Promise<void>;
  onSave: (id: number, text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const style = KIND_STYLE[kind];

  return (
    <div className={`relative rounded-xl border ${style.border} bg-slate-950/78 backdrop-blur-xl overflow-hidden`}>
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${style.accent}66, transparent)` }}
      />

      <header className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h4
            className="text-[11px] tracking-[0.35em] uppercase"
            style={{ ...cinzel, color: style.accent }}
          >
            {style.title}
          </h4>
          <span className="font-mono text-[10px] tabular-nums text-white/20">
            {String(entries.length).padStart(2, "0")}
          </span>
        </div>
        <p className="mt-1 text-[10px] tracking-[0.1em] uppercase text-white/45" style={cinzel}>
          {style.caption}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="px-4 pb-1 pt-2 border-t border-white/[0.05] text-[12px] italic text-white/40">
          {style.empty}
        </p>
      ) : (
        <ul>
          {entries.map((entry, i) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              index={i}
              dot={style.dot}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      <Composer vipSlug={vipSlug} kind={kind} onAdd={onAdd} />
    </div>
  );
}

interface Props {
  vipSlug: string;
  entries: AnonymityEntry[];
  onAdd: (vipSlug: string, kind: AnonymityKind, text: string) => Promise<void>;
  onSave: (id: number, text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function AnonymityLog({ vipSlug, entries, onAdd, onSave, onDelete }: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <LogTable
        vipSlug={vipSlug}
        kind="confirmed"
        entries={entries.filter((e) => e.kind === "confirmed")}
        onAdd={onAdd}
        onSave={onSave}
        onDelete={onDelete}
      />
      <LogTable
        vipSlug={vipSlug}
        kind="suspicion"
        entries={entries.filter((e) => e.kind === "suspicion")}
        onAdd={onAdd}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
