"use client";

import { useState, useRef, useEffect } from "react";
import type { Chapter } from "@/types/investigation";
import type { StoryEntry, StoryVisibility } from "@/types/story";
import ChapterDropdown, { toRoman } from "@/components/investigation/ChapterDropdown";
import { PAGE_BREAK, imageToken } from "@/lib/story";
import StoryImagePicker from "@/components/admin/StoryImagePicker";
import MentionPicker, { type MentionEntity } from "@/components/investigation/MentionPicker";
import {
  detectMention,
  buildMentionMarkup,
  type MentionState,
} from "@/lib/investigation/clueText";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface UserOption {
  username: string;
  character: string | null;
  imageUrl: string | null;
}

interface Props {
  chapters: Chapter[];
  users: UserOption[];
  initialEntries: StoryEntry[];
}

interface Form {
  chapter: number | null;
  sessionNumber: string;
  title: string;
  body: string;
  visibility: StoryVisibility;
  assignedUsernames: string[];
}

const VISIBILITY_OPTIONS: { value: StoryVisibility; label: string; hint: string }[] = [
  { value: "assigned", label: "Assigned", hint: "Only the players you pick" },
  { value: "players", label: "All players", hint: "Any logged-in player" },
  { value: "world", label: "Public link", hint: "Anyone with the link — no login" },
];

type EditorState =
  | { mode: "new"; form: Form }
  | { mode: "edit"; id: number; form: Form }
  | null;

function audienceLabel(entry: StoryEntry): string {
  if (entry.visibility === "world") return "Public link";
  if (entry.visibility === "players") return "All players";
  const n = entry.assignedUsernames.length;
  if (n === 0) return "No one assigned";
  return `${n} player${n === 1 ? "" : "s"}`;
}

export default function StoryAdminPanel({ chapters, users, initialEntries }: Props) {
  const defaultChapter = chapters.length > 0 ? chapters[chapters.length - 1].number : null;

  const [entries, setEntries] = useState<StoryEntry[]>(initialEntries);
  const [editor, setEditor] = useState<EditorState>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [entities, setEntities] = useState<MentionEntity[]>([]);
  const [dirty, setDirty] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Close the editor, guarding unsaved work.
  function requestClose() {
    if (dirty && !confirm("Discard unsaved changes to this entry?")) return;
    setEditor(null);
    setMention(null);
    setDirty(false);
    setError(null);
  }

  // Esc closes the editor — but not while the mention dropdown or the image
  // picker is open (each handles its own Esc), so one Esc can't discard the
  // whole entry.
  useEffect(() => {
    if (!editor) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !mention && !showPicker) {
        e.preventDefault();
        requestClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, mention, showPicker, dirty]);

  // Kanka entities for @mentions (same source as the investigation board).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/investigation/mentions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((data) => {
        if (!cancelled) setEntities(data.entities ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function refreshMention() {
    const ta = bodyRef.current;
    if (!ta) {
      setMention(null);
      return;
    }
    setMention(detectMention(ta.value, ta.selectionStart ?? 0));
  }

  function handleMentionPick(entity: MentionEntity) {
    if (!mention || !editor) return;
    const markup = buildMentionMarkup(entity.name, entity.entityId);
    const body = editor.form.body;
    const next = body.slice(0, mention.atIndex) + markup + body.slice(mention.endIndex);
    patchForm({ body: next });
    setMention(null);
    const pos = mention.atIndex + markup.length;
    queueMicrotask(() => {
      const ta = bodyRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function startAdd() {
    setError(null);
    setDirty(false);
    setMention(null);
    setEditor({
      mode: "new",
      form: {
        chapter: defaultChapter,
        sessionNumber: "",
        title: "",
        body: "",
        visibility: "assigned",
        assignedUsernames: [],
      },
    });
  }

  function startEdit(entry: StoryEntry) {
    setError(null);
    setDirty(false);
    setMention(null);
    setEditor({
      mode: "edit",
      id: entry.id,
      form: {
        chapter: entry.chapter,
        sessionNumber: entry.sessionNumber !== null ? String(entry.sessionNumber) : "",
        title: entry.title,
        body: entry.body,
        visibility: entry.visibility,
        assignedUsernames: entry.assignedUsernames,
      },
    });
  }

  function patchForm(patch: Partial<Form>) {
    setEditor((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
    setDirty(true);
  }

  function insertAtCursor(text: string) {
    const ta = bodyRef.current;
    if (!ta || !editor) return;
    const { selectionStart, selectionEnd, value } = ta;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    // Ensure the token sits on its own line.
    const needsLeadingNL = before.length > 0 && !before.endsWith("\n");
    const snippet = `${needsLeadingNL ? "\n" : ""}${text}\n`;
    const next = before + snippet + after;
    patchForm({ body: next });
    // Restore focus/caret after React re-render.
    requestAnimationFrame(() => {
      ta.focus();
      const pos = (before + snippet).length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function toggleUser(username: string) {
    if (!editor) return;
    const set = editor.form.assignedUsernames;
    patchForm({
      assignedUsernames: set.includes(username)
        ? set.filter((u) => u !== username)
        : [...set, username],
    });
  }

  async function save() {
    if (!editor) return;
    const { form } = editor;
    if (form.chapter === null) {
      setError("Pick a chapter");
      return;
    }
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      chapter: form.chapter,
      title: form.title.trim(),
      body: form.body,
      sessionNumber: form.sessionNumber.trim() === "" ? null : Number(form.sessionNumber),
      visibility: form.visibility,
      assignedUsernames: form.visibility === "assigned" ? form.assignedUsernames : [],
    };

    const url = editor.mode === "edit" ? `/api/admin/story/${editor.id}` : "/api/admin/story";
    const method = editor.mode === "edit" ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.error ?? "Failed to save");
      return;
    }
    const saved: StoryEntry = data.entry;
    setEntries((prev) => {
      const without = prev.filter((e) => e.id !== saved.id);
      return [...without, saved].sort(
        (a, b) => a.chapter - b.chapter || b.createdAt.localeCompare(a.createdAt)
      );
    });
    setDirty(false);
    setMention(null);
    setEditor(null);
  }

  async function remove(entry: StoryEntry) {
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/story/${entry.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to delete");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  }

  async function copyLink(entry: StoryEntry) {
    const url = `${window.location.origin}/storybook/${entry.uid}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(entry.id);
      setTimeout(() => setCopied((c) => (c === entry.id ? null : c)), 1500);
    } catch {
      setError("Could not copy link");
    }
  }

  const noChapters = chapters.length === 0;

  return (
    <section className="max-w-5xl flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[10px] tracking-[0.3em] uppercase text-white/55" style={cinzel}>
          Story Entries
        </h2>
        <button
          onClick={startAdd}
          disabled={noChapters}
          className="px-4 py-2 rounded border border-amber-400/30 text-amber-200/85 hover:text-amber-200 hover:border-amber-400/60 hover:bg-amber-400/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={cinzel}
        >
          <span className="text-[10px] tracking-[0.25em] uppercase">+ New Entry</span>
        </button>
      </div>

      {error && !editor && (
        <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-red-300 text-xs">
          {error}
        </div>
      )}

      <div
        className="rounded border border-white/10 overflow-hidden"
        style={{ background: "rgba(8,12,28,0.6)", backdropFilter: "blur(8px)" }}
      >
        {noChapters ? (
          <p className="px-4 py-6 text-[10px] tracking-[0.2em] uppercase text-white/30 text-center" style={cinzel}>
            Create a chapter first (Investigation settings)
          </p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-6 text-[10px] tracking-[0.2em] uppercase text-white/30 text-center" style={cinzel}>
            No story entries yet
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {entries.map((entry) => (
              <li key={entry.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] text-white/85 font-medium">{entry.title}</span>
                    <span
                      className="text-[8px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-sm bg-white/5 text-white/50"
                      style={cinzel}
                    >
                      Ch. {toRoman(entry.chapter)}
                    </span>
                    {entry.sessionNumber !== null && (
                      <span
                        className="text-[8px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-sm bg-amber-400/10 text-amber-200/70"
                        style={cinzel}
                      >
                        Session {entry.sessionNumber}
                      </span>
                    )}
                    <span
                      className="text-[8px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-sm bg-indigo-400/10 text-indigo-200/70"
                      style={cinzel}
                    >
                      {audienceLabel(entry)}
                    </span>
                  </div>
                  <button
                    onClick={() => copyLink(entry)}
                    className="self-start flex items-center gap-1.5 text-[10px] text-white/40 hover:text-amber-200/80 transition-colors cursor-pointer font-mono"
                    title="Copy shareable link"
                  >
                    <span className="truncate max-w-[320px]">/storybook/{entry.uid}</span>
                    <span className="text-[9px] tracking-[0.15em] uppercase shrink-0" style={cinzel}>
                      {copied === entry.id ? "✓ Copied" : "Copy"}
                    </span>
                  </button>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a
                    href={`/storybook/${entry.uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
                    style={cinzel}
                  >
                    Open
                  </a>
                  <button
                    onClick={() => startEdit(entry)}
                    className="px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
                    style={cinzel}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(entry)}
                    className="px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-white/30 hover:text-red-400 cursor-pointer"
                    style={cinzel}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editor && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "linear-gradient(160deg, rgba(12,10,6,0.99), rgba(4,3,2,0.99))" }}
        >
          {/* Header — title, dirty flag, and actions (no accidental close) */}
          <header className="shrink-0 flex items-center justify-between gap-3 h-14 px-4 sm:px-6 border-b border-amber-400/15">
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="shrink-0 text-[10px] tracking-[0.3em] uppercase text-amber-200/70" style={cinzel}>
                {editor.mode === "edit" ? "Edit Entry" : "New Entry"}
              </span>
              {editor.form.title.trim() && (
                <span className="truncate text-sm text-white/45" style={cinzel}>
                  {editor.form.title}
                </span>
              )}
              {dirty && (
                <span className="shrink-0 text-[8px] tracking-[0.25em] uppercase text-amber-300/60" style={cinzel}>
                  • unsaved
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={requestClose}
                className="px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
                style={cinzel}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !editor.form.title.trim() || editor.form.chapter === null}
                className="px-5 py-1.5 rounded border border-amber-400/40 text-[10px] tracking-[0.2em] uppercase text-amber-200 hover:bg-amber-400/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={cinzel}
              >
                {saving ? "Saving…" : editor.mode === "edit" ? "Save" : "Create"}
              </button>
            </div>
          </header>

          {error && (
            <div className="shrink-0 px-4 sm:px-6 py-2 bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            {/* Main editing column */}
            <div className="flex flex-col gap-3 p-4 sm:p-6 min-h-0 lg:flex-1">
              <input
                value={editor.form.title}
                onChange={(e) => patchForm({ title: e.target.value })}
                maxLength={200}
                placeholder="Entry title…"
                className="w-full bg-transparent border-b border-white/10 focus:border-amber-400/40 pb-2 text-white/90 text-xl focus:outline-none"
                style={cinzel}
                autoFocus
              />

              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => insertAtCursor(PAGE_BREAK)}
                  className="text-[9px] tracking-[0.15em] uppercase text-amber-200/70 hover:text-amber-200 border border-amber-400/25 hover:border-amber-400/50 rounded px-2.5 py-1.5 cursor-pointer"
                  style={cinzel}
                >
                  + Page break
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor("# Heading")}
                  className="text-[9px] tracking-[0.15em] uppercase text-white/50 hover:text-white/85 border border-white/15 hover:border-white/35 rounded px-2.5 py-1.5 cursor-pointer"
                  style={cinzel}
                >
                  + Heading
                </button>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  disabled={editor.form.chapter === null}
                  title={editor.form.chapter === null ? "Pick a chapter first" : "Insert an image"}
                  className="text-[9px] tracking-[0.15em] uppercase text-amber-200/70 hover:text-amber-200 border border-amber-400/25 hover:border-amber-400/50 rounded px-2.5 py-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={cinzel}
                >
                  + Image
                </button>
                <span className="ml-auto text-[9px] tracking-[0.15em] uppercase text-white/25" style={cinzel}>
                  @ mention · &quot;…&quot; dialogue
                </span>
              </div>

              {/* Body — fills the available height */}
              <div className="relative flex-1 min-h-[45vh] lg:min-h-0">
                <textarea
                  ref={bodyRef}
                  value={editor.form.body}
                  onChange={(e) => {
                    patchForm({ body: e.target.value });
                    queueMicrotask(refreshMention);
                  }}
                  onSelect={refreshMention}
                  onKeyUp={refreshMention}
                  onClick={refreshMention}
                  maxLength={40000}
                  placeholder={`Write the story…\n\nSeparate paragraphs with a blank line.\nType @ to mention a Kanka entity, and wrap speech in "quotes".\nUse the toolbar for headings, page breaks and images.`}
                  className="absolute inset-0 w-full h-full resize-none bg-white/[0.03] border border-white/12 rounded p-4 text-white/85 text-[13px] leading-[1.7] focus:outline-none focus:border-amber-400/40 font-mono"
                />
                {mention && (
                  <div className="absolute left-3 right-3 top-3 z-40">
                    <div className="relative">
                      <MentionPicker
                        entities={entities}
                        query={mention.query}
                        onPick={handleMentionPick}
                        onClose={() => setMention(null)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Settings sidebar */}
            <aside className="shrink-0 lg:w-96 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-white/10 bg-black/25 p-4 sm:p-6 flex flex-col gap-6">
              {/* Placement */}
              <div className="flex flex-col gap-3">
                <span className="text-[9px] tracking-[0.25em] uppercase text-white/40" style={cinzel}>
                  Placement
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] tracking-[0.15em] uppercase text-white/55" style={cinzel}>
                    Chapter
                  </span>
                  <ChapterDropdown
                    chapters={chapters}
                    current={editor.form.chapter}
                    onSelect={(n) => patchForm({ chapter: n })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] tracking-[0.15em] uppercase text-white/55" style={cinzel}>
                    Session #
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={editor.form.sessionNumber}
                    onChange={(e) => patchForm({ sessionNumber: e.target.value })}
                    placeholder="optional"
                    className="w-28 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-400/40"
                  />
                </div>
              </div>

              {/* Audience */}
              <div className="flex flex-col gap-2 border-t border-white/10 pt-5">
                <span className="text-[9px] tracking-[0.25em] uppercase text-white/40" style={cinzel}>
                  Audience
                </span>
                <div className="flex flex-col gap-1.5">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const on = editor.form.visibility === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => patchForm({ visibility: opt.value })}
                        aria-pressed={on}
                        className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded border text-left transition-colors cursor-pointer ${
                          on
                            ? "border-amber-400/50 bg-amber-400/10"
                            : "border-white/12 bg-white/[0.03] hover:border-white/25"
                        }`}
                      >
                        <span
                          className={`text-[10px] tracking-[0.2em] uppercase ${
                            on ? "text-amber-100" : "text-white/70"
                          }`}
                          style={cinzel}
                        >
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-white/40 normal-case tracking-normal">
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {editor.form.visibility === "world" && (
                  <p className="text-[10px] text-amber-200/60 leading-relaxed mt-0.5">
                    Anyone with the link can read this entry without logging in. The
                    rest of the site stays private.
                  </p>
                )}

                {editor.form.visibility === "assigned" && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {users.map((u) => {
                      const on = editor.form.assignedUsernames.includes(u.username);
                      return (
                        <button
                          key={u.username}
                          type="button"
                          onClick={() => toggleUser(u.username)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[11px] transition-colors cursor-pointer ${
                            on
                              ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                              : "border-white/12 bg-white/[0.03] text-white/55 hover:text-white/85 hover:border-white/25"
                          }`}
                        >
                          {u.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={u.imageUrl}
                              alt=""
                              className="w-4 h-4 rounded-full object-cover border border-white/15"
                            />
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[7px] uppercase">
                              {u.username.charAt(0)}
                            </span>
                          )}
                          <span>{u.character ?? u.username}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Formatting legend */}
              <div className="flex flex-col gap-2 border-t border-white/10 pt-5">
                <span className="text-[9px] tracking-[0.25em] uppercase text-white/40" style={cinzel}>
                  Formatting
                </span>
                <ul className="flex flex-col gap-1.5 text-[11px] text-white/45 leading-relaxed">
                  <li><span className="text-white/60">blank line</span> — new paragraph</li>
                  <li><code className="text-amber-200/70 font-mono"># Heading</code> — centred title (anywhere)</li>
                  <li><code className="text-amber-200/70 font-mono">---PAGE---</code> — start a new section</li>
                  <li><code className="text-amber-200/70 font-mono">@</code> — mention a Kanka entity</li>
                  <li><span className="italic text-white/60">&quot;spoken&quot;</span> — dialogue is italicised</li>
                  <li>Pages flow automatically to fit the book.</li>
                </ul>
              </div>

              {/* Share link (edit mode) */}
              {editor.mode === "edit" && (() => {
                const ent = entries.find((e) => e.id === editor.id);
                if (!ent) return null;
                return (
                  <div className="flex flex-col gap-2 border-t border-white/10 pt-5">
                    <span className="text-[9px] tracking-[0.25em] uppercase text-white/40" style={cinzel}>
                      Share link
                    </span>
                    <button
                      onClick={() => copyLink(ent)}
                      className="self-start flex items-center gap-1.5 text-[11px] text-white/40 hover:text-amber-200/80 transition-colors cursor-pointer font-mono"
                      title="Copy shareable link"
                    >
                      <span className="truncate max-w-[240px]">/storybook/{ent.uid}</span>
                      <span className="shrink-0 text-[9px] tracking-[0.15em] uppercase" style={cinzel}>
                        {copied === ent.id ? "✓ Copied" : "Copy"}
                      </span>
                    </button>
                  </div>
                );
              })()}
            </aside>
          </div>
        </div>
      )}

      {showPicker && editor && editor.form.chapter !== null && (
        <StoryImagePicker
          chapter={editor.form.chapter}
          onSelect={(url) => {
            insertAtCursor(imageToken(url));
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </section>
  );
}
