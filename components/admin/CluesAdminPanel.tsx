"use client";

import { useState, useEffect, useCallback } from "react";
import type { Chapter, Clue } from "@/types/investigation";
import ChapterDropdown, { toRoman } from "@/components/investigation/ChapterDropdown";
import FactionPicker from "@/components/investigation/FactionPicker";
import { ALLEGIANCES, type AllegianceKey } from "@/lib/allegiances";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface UserOption {
  username: string;
  character: string | null;
  imageUrl: string | null;
}

interface CluesAdminPanelProps {
  chapters: Chapter[];
  users: UserOption[];
}

interface FormState {
  text: string;
  factionSlugs: string[];
  createdBy: string;
}

function UserAvatar({ user, size = 20 }: { user: UserOption | undefined; size?: number }) {
  if (!user) return <span className="text-white/30">—</span>;
  if (user.imageUrl) {
    return (
      <img
        src={user.imageUrl}
        alt={user.username}
        title={user.username}
        className="rounded-full object-cover border border-white/15"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={user.username}
      className="rounded-full flex items-center justify-center text-[8px] uppercase border border-white/15 bg-white/5 text-white/55"
      style={{ width: size, height: size, ...cinzel }}
    >
      {user.username.charAt(0).toUpperCase()}
    </span>
  );
}

function UserSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: UserOption[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-white/40"
      style={cinzel}
    >
      <option value="" disabled className="bg-gray-900">
        Pick author…
      </option>
      {options.map((u) => (
        <option key={u.username} value={u.username} className="bg-gray-900">
          {u.username}
          {u.character ? ` — ${u.character}` : ""}
        </option>
      ))}
    </select>
  );
}

export default function CluesAdminPanel({ chapters, users }: CluesAdminPanelProps) {
  const usersByName = new Map(users.map((u) => [u.username, u]));
  const defaultChapter = chapters.length > 0 ? chapters[chapters.length - 1].number : null;

  const [selectedChapter, setSelectedChapter] = useState<number | null>(defaultChapter);
  const [clues, setClues] = useState<Clue[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ id: number; form: FormState } | null>(null);
  const [adding, setAdding] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClues = useCallback(async (chapter: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigation/clues?chapter=${chapter}`);
      if (res.ok) {
        const data = await res.json();
        setClues(data.clues);
      } else {
        setError("Failed to load clues");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChapter !== null) loadClues(selectedChapter);
  }, [selectedChapter, loadClues]);

  async function handleSaveEdit() {
    if (!editing) return;
    setError(null);
    const res = await fetch(`/api/admin/investigation/clues/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: editing.form.text,
        factionSlugs: editing.form.factionSlugs,
        createdBy: editing.form.createdBy,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Failed to save");
      return;
    }
    setClues((prev) => prev.map((c) => (c.id === editing.id ? data.clue : c)));
    setEditing(null);
  }

  async function handleAdd() {
    if (!adding || selectedChapter === null) return;
    setError(null);
    const res = await fetch("/api/admin/investigation/clues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapter: selectedChapter,
        text: adding.text,
        factionSlugs: adding.factionSlugs,
        createdBy: adding.createdBy,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Failed to add");
      return;
    }
    setClues((prev) => [data.clue, ...prev]);
    setAdding(null);
  }

  async function handleDelete(clue: Clue) {
    if (!confirm(`Delete clue #${clue.id}? This cannot be undone.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/investigation/clues/${clue.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to delete");
      return;
    }
    setClues((prev) => prev.filter((c) => c.id !== clue.id));
  }

  function startAdd() {
    setAdding({
      text: "",
      factionSlugs: [],
      createdBy: users[0]?.username ?? "",
    });
    setEditing(null);
  }

  function startEdit(clue: Clue) {
    setEditing({
      id: clue.id,
      form: {
        text: clue.text,
        factionSlugs: clue.factionSlugs,
        createdBy: clue.createdBy,
      },
    });
    setAdding(null);
  }

  const noChapters = chapters.length === 0;

  return (
    <section className="max-w-5xl flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[10px] tracking-[0.3em] uppercase text-white/55" style={cinzel}>
          Clues
        </h2>
        <div className="flex items-center gap-2">
          {!noChapters && (
            <ChapterDropdown
              chapters={chapters}
              current={selectedChapter}
              onSelect={setSelectedChapter}
            />
          )}
          <button
            onClick={startAdd}
            disabled={selectedChapter === null}
            className="px-4 py-2 rounded border border-indigo-400/30 text-indigo-300/85 hover:text-indigo-300 hover:border-indigo-400/60 hover:bg-indigo-400/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={cinzel}
          >
            <span className="text-[10px] tracking-[0.25em] uppercase">+ Add Clue</span>
          </button>
        </div>
      </div>

      {error && (
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
            No chapters exist yet
          </p>
        ) : loading ? (
          <p className="px-4 py-6 text-[10px] tracking-[0.2em] uppercase text-white/30 text-center" style={cinzel}>
            Loading…
          </p>
        ) : clues.length === 0 ? (
          <p className="px-4 py-6 text-[10px] tracking-[0.2em] uppercase text-white/30 text-center" style={cinzel}>
            No clues in Chapter {selectedChapter !== null ? toRoman(selectedChapter) : ""}
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {clues.map((clue) => {
              const isEditing = editing?.id === clue.id;
              const author = usersByName.get(clue.createdBy);
              if (isEditing && editing) {
                return (
                  <li key={clue.id} className="px-4 py-4 flex flex-col gap-2 bg-indigo-500/5">
                    <textarea
                      value={editing.form.text}
                      onChange={(e) =>
                        setEditing({ ...editing, form: { ...editing.form, text: e.target.value } })
                      }
                      rows={3}
                      maxLength={2000}
                      className="w-full bg-white/[0.04] border border-white/15 rounded p-2 text-white/85 text-sm focus:outline-none focus:border-indigo-400/40"
                    />
                    <FactionPicker
                      selected={editing.form.factionSlugs}
                      onChange={(next) =>
                        setEditing({ ...editing, form: { ...editing.form, factionSlugs: next } })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] tracking-[0.2em] uppercase text-white/45 w-20" style={cinzel}>
                        Author
                      </span>
                      <UserSelect
                        value={editing.form.createdBy}
                        options={users}
                        onChange={(v) =>
                          setEditing({ ...editing, form: { ...editing.form, createdBy: v } })
                        }
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                      <button
                        onClick={() => setEditing(null)}
                        className="px-3 py-1 text-[9px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
                        style={cinzel}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 rounded border border-indigo-400/40 text-[9px] tracking-[0.2em] uppercase text-indigo-300 hover:bg-indigo-400/10 cursor-pointer"
                        style={cinzel}
                      >
                        Save
                      </button>
                    </div>
                  </li>
                );
              }
              return (
                <li key={clue.id} className="px-4 py-3 flex items-start gap-3">
                  <UserAvatar user={author} />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[12px] text-white/80 leading-snug">
                      {clue.text}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {clue.factionSlugs.length === 0 ? (
                        <span className="text-[8px] tracking-[0.2em] uppercase text-white/20" style={cinzel}>
                          untagged
                        </span>
                      ) : (
                        clue.factionSlugs.map((slug) => {
                          const f = ALLEGIANCES[slug as AllegianceKey];
                          if (!f) return null;
                          return (
                            <span
                              key={slug}
                              className="text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded-sm"
                              style={{ ...cinzel, background: `${f.color}25`, color: f.color }}
                            >
                              {f.name}
                            </span>
                          );
                        })
                      )}
                    </div>
                    <span className="text-[8px] tracking-[0.15em] uppercase text-white/30" style={cinzel}>
                      by {clue.createdBy}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(clue)}
                      className="px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
                      style={cinzel}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(clue)}
                      className="px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-white/30 hover:text-red-400 cursor-pointer"
                      style={cinzel}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add modal */}
      {adding && selectedChapter !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setAdding(null)}
        >
          <div
            className="w-full max-w-lg p-5 rounded border border-indigo-400/40"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(145deg, rgba(8,12,28,0.98), rgba(4,6,18,0.98))",
              boxShadow: "0 0 30px rgba(99,102,241,0.18)",
            }}
          >
            <h3
              className="text-[10px] tracking-[0.3em] uppercase text-white/65 mb-3"
              style={cinzel}
            >
              New Clue — Chapter {toRoman(selectedChapter)}
            </h3>
            <div className="flex flex-col gap-2">
              <textarea
                value={adding.text}
                onChange={(e) => setAdding({ ...adding, text: e.target.value })}
                rows={4}
                maxLength={2000}
                placeholder="Clue text…"
                className="w-full bg-white/[0.04] border border-white/15 rounded p-2 text-white/85 text-sm focus:outline-none focus:border-indigo-400/40"
                autoFocus
              />
              <FactionPicker
                selected={adding.factionSlugs}
                onChange={(next) => setAdding({ ...adding, factionSlugs: next })}
              />
              <div className="flex items-center gap-2">
                <span className="text-[9px] tracking-[0.2em] uppercase text-white/45 w-20" style={cinzel}>
                  Author
                </span>
                <UserSelect
                  value={adding.createdBy}
                  options={users}
                  onChange={(v) => setAdding({ ...adding, createdBy: v })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setAdding(null)}
                className="px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
                style={cinzel}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!adding.text.trim() || !adding.createdBy}
                className="px-3 py-1.5 rounded border border-indigo-400/40 text-[10px] tracking-[0.2em] uppercase text-indigo-300 hover:bg-indigo-400/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={cinzel}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
