"use client";

import { useState } from "react";
import type { Chapter } from "@/types/investigation";
import { toRoman } from "@/components/investigation/ChapterDropdown";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface ChaptersAdminPanelProps {
  initialChapters: Chapter[];
  initialClueCounts: Record<number, number>;
}

export default function ChaptersAdminPanel({ initialChapters, initialClueCounts }: ChaptersAdminPanelProps) {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [clueCounts, setClueCounts] = useState<Record<number, number>>(initialClueCounts);
  const [newTitle, setNewTitle] = useState("");
  const [editing, setEditing] = useState<{ number: number; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const nextNumber = chapters.length === 0 ? 1 : Math.max(...chapters.map((c) => c.number)) + 1;

  const handleAdvance = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/investigation/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? "Failed to create chapter");
        return;
      }
      setChapters((prev) => [...prev, data.chapter]);
      setClueCounts((prev) => ({ ...prev, [data.chapter.number]: 0 }));
      setNewTitle("");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (number: number, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/investigation/chapters/${number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? "Failed to rename chapter");
        return;
      }
      setChapters((prev) => prev.map((c) => (c.number === number ? data.chapter : c)));
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (chapter: Chapter) => {
    const count = clueCounts[chapter.number] ?? 0;
    const expected = chapter.title;
    const typed = window.prompt(
      count > 0
        ? `This chapter has ${count} clue${count === 1 ? "" : "s"} that will be permanently deleted.\n\nType the chapter title exactly to confirm:\n${expected}`
        : `Delete chapter "${expected}"? Type the chapter title to confirm:`
    );
    if (typed === null) return;
    if (typed !== expected) {
      alert("Title did not match — chapter not deleted.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/investigation/chapters/${chapter.number}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Failed to delete chapter");
        return;
      }
      setChapters((prev) => prev.filter((c) => c.number !== chapter.number));
      setClueCounts((prev) => {
        const next = { ...prev };
        delete next[chapter.number];
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      {/* Advance */}
      <section
        className="p-4 rounded border border-white/10"
        style={{ background: "rgba(8,12,28,0.6)", backdropFilter: "blur(8px)" }}
      >
        <h2 className="text-[10px] tracking-[0.3em] uppercase text-white/55 mb-3" style={cinzel}>
          Advance Chapter
        </h2>
        <p className="text-[10px] text-white/40 mb-3" style={cinzel}>
          Will create Chapter {toRoman(nextNumber)} and make it the current chapter.
        </p>
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdvance(); }}
            placeholder="Chapter title…"
            maxLength={200}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded bg-white/[0.03] border border-white/10 outline-none focus:border-indigo-400/40 text-sm text-white/85 placeholder:text-white/25"
            style={cinzel}
          />
          <button
            onClick={handleAdvance}
            disabled={busy || newTitle.trim().length === 0}
            className="px-4 py-2 rounded border border-indigo-400/30 text-indigo-300/85 hover:text-indigo-300 hover:border-indigo-400/60 hover:bg-indigo-400/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={cinzel}
          >
            <span className="text-[10px] tracking-[0.25em] uppercase">Advance</span>
          </button>
        </div>
      </section>

      {/* List */}
      <section
        className="rounded border border-white/10 overflow-hidden"
        style={{ background: "rgba(8,12,28,0.6)", backdropFilter: "blur(8px)" }}
      >
        <h2 className="px-4 py-3 text-[10px] tracking-[0.3em] uppercase text-white/55 border-b border-white/10" style={cinzel}>
          Chapters ({chapters.length})
        </h2>
        {chapters.length === 0 ? (
          <p className="px-4 py-6 text-[10px] tracking-[0.2em] uppercase text-white/30 text-center" style={cinzel}>
            No chapters yet
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {[...chapters].sort((a, b) => b.number - a.number).map((c) => {
              const isCurrent = c.number === nextNumber - 1;
              const isEditing = editing?.number === c.number;
              return (
                <li key={c.number} className="px-4 py-3 flex items-center gap-3">
                  <span
                    className={`text-[10px] tracking-[0.2em] uppercase w-14 shrink-0 ${isCurrent ? "text-indigo-300" : "text-white/40"}`}
                    style={cinzel}
                  >
                    Ch. {toRoman(c.number)}
                  </span>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editing.title}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(c.number, editing.title);
                        else if (e.key === "Escape") setEditing(null);
                      }}
                      onBlur={() => handleRename(c.number, editing.title)}
                      maxLength={200}
                      className="flex-1 px-2 py-1 rounded bg-white/[0.05] border border-indigo-400/40 outline-none text-sm text-white/85"
                      style={cinzel}
                    />
                  ) : (
                    <span className="flex-1 text-sm text-white/80" style={cinzel}>
                      {c.title}
                    </span>
                  )}
                  <span className="text-[9px] tracking-[0.15em] uppercase text-white/30 shrink-0" style={cinzel}>
                    {clueCounts[c.number] ?? 0} clue{(clueCounts[c.number] ?? 0) === 1 ? "" : "s"}
                  </span>
                  {isCurrent && !isEditing && (
                    <span
                      className="text-[8px] tracking-[0.2em] uppercase text-indigo-300/80 px-2 py-0.5 rounded-sm border border-indigo-400/30 shrink-0"
                      style={cinzel}
                    >
                      Current
                    </span>
                  )}
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => setEditing({ number: c.number, title: c.title })}
                        className="px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-white/45 hover:text-white/85 cursor-pointer"
                        style={cinzel}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={busy}
                        className="px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-white/30 hover:text-red-400 cursor-pointer disabled:opacity-40"
                        style={cinzel}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
