"use client";

import { useState, useRef } from "react";
import type { Chapter } from "@/types/investigation";
import type { StoryEntry } from "@/types/story";
import ChapterDropdown, { toRoman } from "@/components/investigation/ChapterDropdown";
import { PAGE_BREAK, imageToken } from "@/lib/story";
import StoryImagePicker from "@/components/admin/StoryImagePicker";

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
  isPublic: boolean;
  assignedUsernames: string[];
}

type EditorState =
  | { mode: "new"; form: Form }
  | { mode: "edit"; id: number; form: Form }
  | null;

function audienceLabel(entry: StoryEntry): string {
  if (entry.isPublic) return "All players";
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function startAdd() {
    setError(null);
    setEditor({
      mode: "new",
      form: {
        chapter: defaultChapter,
        sessionNumber: "",
        title: "",
        body: "",
        isPublic: false,
        assignedUsernames: [],
      },
    });
  }

  function startEdit(entry: StoryEntry) {
    setError(null);
    setEditor({
      mode: "edit",
      id: entry.id,
      form: {
        chapter: entry.chapter,
        sessionNumber: entry.sessionNumber !== null ? String(entry.sessionNumber) : "",
        title: entry.title,
        body: entry.body,
        isPublic: entry.isPublic,
        assignedUsernames: entry.assignedUsernames,
      },
    });
  }

  function patchForm(patch: Partial<Form>) {
    setEditor((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
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
      isPublic: form.isPublic,
      assignedUsernames: form.isPublic ? [] : form.assignedUsernames,
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
          className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => setEditor(null)}
        >
          <div
            className="w-full max-w-2xl my-8 p-5 rounded border border-amber-400/30"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(145deg, rgba(14,11,6,0.98), rgba(6,5,3,0.98))",
              boxShadow: "0 0 30px rgba(180,150,80,0.18)",
            }}
          >
            <h3 className="text-[10px] tracking-[0.3em] uppercase text-white/65 mb-4" style={cinzel}>
              {editor.mode === "edit" ? "Edit Entry" : "New Entry"}
            </h3>

            <div className="flex flex-col gap-3">
              {/* Title */}
              <input
                value={editor.form.title}
                onChange={(e) => patchForm({ title: e.target.value })}
                maxLength={200}
                placeholder="Entry title…"
                className="w-full bg-white/[0.04] border border-white/15 rounded p-2 text-white/90 text-sm focus:outline-none focus:border-amber-400/40"
                autoFocus
              />

              {/* Chapter + session */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] tracking-[0.2em] uppercase text-white/45" style={cinzel}>
                    Chapter
                  </span>
                  <ChapterDropdown
                    chapters={chapters}
                    current={editor.form.chapter}
                    onSelect={(n) => patchForm({ chapter: n })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] tracking-[0.2em] uppercase text-white/45" style={cinzel}>
                    Session #
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={editor.form.sessionNumber}
                    onChange={(e) => patchForm({ sessionNumber: e.target.value })}
                    placeholder="optional"
                    className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-400/40"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] tracking-[0.2em] uppercase text-white/45" style={cinzel}>
                    Story text
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => insertAtCursor(PAGE_BREAK)}
                      className="text-[9px] tracking-[0.15em] uppercase text-amber-200/70 hover:text-amber-200 border border-amber-400/25 hover:border-amber-400/50 rounded px-2 py-1 cursor-pointer"
                      style={cinzel}
                    >
                      + Page break
                    </button>
                    <button
                      type="button"
                      onClick={() => insertAtCursor("# Heading")}
                      className="text-[9px] tracking-[0.15em] uppercase text-white/50 hover:text-white/85 border border-white/15 hover:border-white/35 rounded px-2 py-1 cursor-pointer"
                      style={cinzel}
                    >
                      + Heading
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPicker(true)}
                      disabled={editor.form.chapter === null}
                      title={editor.form.chapter === null ? "Pick a chapter first" : "Insert an image"}
                      className="text-[9px] tracking-[0.15em] uppercase text-amber-200/70 hover:text-amber-200 border border-amber-400/25 hover:border-amber-400/50 rounded px-2 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      style={cinzel}
                    >
                      + Image
                    </button>
                  </div>
                </div>
                <textarea
                  ref={bodyRef}
                  value={editor.form.body}
                  onChange={(e) => patchForm({ body: e.target.value })}
                  rows={12}
                  maxLength={40000}
                  placeholder={`Write the story…\n\nSeparate paragraphs with a blank line.\nStart a page with "# Heading" for a centred title.\nInsert ${PAGE_BREAK} on its own line to force a new page.`}
                  className="w-full bg-white/[0.04] border border-white/15 rounded p-3 text-white/85 text-sm leading-relaxed focus:outline-none focus:border-amber-400/40 font-mono"
                />
                <p className="text-[9px] text-white/30" style={cinzel}>
                  Content flows to the reader&apos;s screen; page breaks force a new leaf of the book.
                </p>
              </div>

              {/* Audience */}
              <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editor.form.isPublic}
                    onChange={(e) => patchForm({ isPublic: e.target.checked })}
                    className="accent-amber-400"
                  />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-white/70" style={cinzel}>
                    Visible to all players
                  </span>
                </label>

                {!editor.form.isPublic && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] tracking-[0.2em] uppercase text-white/40" style={cinzel}>
                      Assigned players
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
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
                  </div>
                )}
              </div>

              {error && (
                <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-red-300 text-xs">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setEditor(null)}
                className="px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
                style={cinzel}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !editor.form.title.trim() || editor.form.chapter === null}
                className="px-4 py-1.5 rounded border border-amber-400/40 text-[10px] tracking-[0.2em] uppercase text-amber-200 hover:bg-amber-400/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={cinzel}
              >
                {saving ? "Saving…" : editor.mode === "edit" ? "Save" : "Create"}
              </button>
            </div>
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
