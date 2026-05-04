"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FactionPicker from "./FactionPicker";
import MentionPicker, { type MentionEntity } from "./MentionPicker";
import { buildMentionMarkup, parseClueText } from "@/lib/investigation/clueText";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// Both the textarea and the highlight overlay must use IDENTICAL font/size/
// padding so the highlight spans line up exactly with the rendered text.
// These values mirror the rendered ClueTile <p> (text-[10px] leading-snug, body font).
const TEXT_BOX_STYLE: React.CSSProperties = {
  fontSize: "10px",
  lineHeight: "1.375",
  padding: "8px",
  margin: 0,
  border: "none",
};

interface ClueEditorProps {
  initialText: string;
  initialFactionSlugs: string[];
  onSave: (text: string, factionSlugs: string[]) => void | Promise<void>;
  onCancel: () => void;
  /** When true, an empty submit becomes a cancel instead of a save */
  emptyMeansCancel?: boolean;
  autoFocusText?: boolean;
}

interface MentionState {
  query: string;
  atIndex: number;   // Position of '@' in the text
  endIndex: number;  // Cursor position (end of query)
}

function detectMention(text: string, cursor: number): MentionState | null {
  const pre = text.slice(0, cursor);
  // @ must be at the start of the text or preceded by whitespace,
  // and the query (after @) must contain no whitespace yet.
  const match = /(?:^|\s)@([^\s\n]*)$/.exec(pre);
  if (!match) return null;
  const matchStart = match.index;
  const leadingWs = match[0].length - match[1].length - 1; // 0 or 1
  const atIndex = matchStart + leadingWs;
  return { query: match[1], atIndex, endIndex: cursor };
}

export default function ClueEditor({
  initialText,
  initialFactionSlugs,
  onSave,
  onCancel,
  emptyMeansCancel,
  autoFocusText,
}: ClueEditorProps) {
  const [text, setText] = useState(initialText);
  const [factionSlugs, setFactionSlugs] = useState<string[]>(initialFactionSlugs);
  const [busy, setBusy] = useState(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [entities, setEntities] = useState<MentionEntity[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlighterInnerRef = useRef<HTMLDivElement | null>(null);

  function syncHighlighterScroll() {
    const inner = highlighterInnerRef.current;
    const ta = textareaRef.current;
    if (inner && ta) {
      inner.style.transform = `translateY(${-ta.scrollTop}px)`;
    }
  }

  // Re-sync whenever text changes (insert may auto-scroll)
  useEffect(() => {
    syncHighlighterScroll();
  }, [text]);

  // Fetch mention entities once when editor mounts
  useEffect(() => {
    let cancelled = false;
    fetch("/api/investigation/mentions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((data) => {
        if (!cancelled) setEntities(data.entities ?? []);
      })
      .catch(() => {
        // Silent — picker will just show "No matches" when triggered
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (autoFocusText) {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }
  }, [autoFocusText]);

  const isUnchanged =
    text.trim() === initialText.trim() &&
    factionSlugs.length === initialFactionSlugs.length &&
    factionSlugs.every((s, i) => s === initialFactionSlugs[i]);

  const commit = useCallback(async () => {
    if (busy) return;
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      if (emptyMeansCancel) {
        onCancel();
        return;
      }
      onCancel();
      return;
    }

    if (isUnchanged) {
      onCancel();
      return;
    }

    setBusy(true);
    try {
      await onSave(trimmed, factionSlugs);
    } finally {
      setBusy(false);
    }
  }, [busy, text, factionSlugs, emptyMeansCancel, isUnchanged, onSave, onCancel]);

  // Click outside → commit (save or close)
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commit();
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [commit]);

  // Esc → cancel without save (only when mention picker is closed; otherwise
  // MentionPicker's own capture-phase Esc handler closes itself first)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !mention) {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel, mention]);

  function refreshMention() {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? text.length;
    const next = detectMention(ta.value, cursor);
    setMention(next);
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    // Defer until React has flushed the textarea so selectionStart is accurate
    queueMicrotask(refreshMention);
  }

  function handleTextareaSelect() {
    refreshMention();
  }

  function handlePick(entity: MentionEntity) {
    if (!mention) return;
    const markup = buildMentionMarkup(entity.name, entity.entityId);
    const before = text.slice(0, mention.atIndex);
    const after = text.slice(mention.endIndex);
    const newText = `${before}${markup}${after}`;
    setText(newText);
    setMention(null);

    // Restore cursor at end of inserted markup
    const newCursor = mention.atIndex + markup.length;
    queueMicrotask(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(newCursor, newCursor);
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative z-30 flex flex-col gap-2 p-3 rounded"
      style={{
        background: "linear-gradient(155deg, rgba(99,102,241,0.08), rgba(8,12,28,0.92))",
        border: "1px solid rgba(99,102,241,0.45)",
        boxShadow: "0 0 24px rgba(99,102,241,0.18)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="relative rounded"
        style={{
          background: "rgba(0,0,0,0.28)",
          boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.18)",
        }}
      >
        {/* Highlight overlay — same geometry as the textarea, transparent text,
            colored spans show through behind the typed text. */}
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none"
          style={TEXT_BOX_STYLE}
        >
          <div
            ref={highlighterInnerRef}
            className="whitespace-pre-wrap break-words"
            style={{ color: "transparent" }}
          >
            {parseClueText(text).map((tok, i) =>
              tok.kind === "mention" ? (
                <span
                  key={i}
                  style={{
                    background: "rgba(129,140,248,0.22)",
                    borderRadius: 2,
                  }}
                >
                  {`@[${tok.name}](kanka:${tok.entityId})`}
                </span>
              ) : (
                <span key={i}>{tok.value}</span>
              )
            )}
            {/* Trailing space so a final newline still gets line-height */}
            {text.endsWith("\n") ? "​" : null}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextareaChange}
          onScroll={syncHighlighterScroll}
          onSelect={handleTextareaSelect}
          onKeyUp={handleTextareaSelect}
          onClick={handleTextareaSelect}
          placeholder="Record a clue…  (type @ to mention a Kanka entity)"
          className="relative w-full bg-transparent outline-none resize-none text-white/65 placeholder:text-white/25"
          style={TEXT_BOX_STYLE}
          rows={4}
          maxLength={2000}
          disabled={busy}
        />
        {mention && (
          <MentionPicker
            entities={entities}
            query={mention.query}
            onPick={handlePick}
            onClose={() => setMention(null)}
          />
        )}
      </div>
      <FactionPicker
        selected={factionSlugs}
        onChange={setFactionSlugs}
      />
      <p className="text-[7px] tracking-[0.2em] uppercase text-white/25 mt-1" style={cinzel}>
        Click outside to save · Esc to cancel · @ to mention
      </p>
    </div>
  );
}
