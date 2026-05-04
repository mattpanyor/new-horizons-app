"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Chapter, Clue } from "@/types/investigation";
import ChapterDropdown, { toRoman } from "./ChapterDropdown";
import ClueTile from "./ClueTile";
import AddTile from "./AddTile";
import { ALLEGIANCES, type AllegianceKey } from "@/lib/allegiances";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export interface PlayerInfo {
  firstName: string;
  imageUrl: string | null;
}

interface InvestigationBoardProps {
  chapters: Chapter[];
  initialChapter: number | null;
  initialClues: Clue[];
  accessLevel: number;
  currentUsername: string;
  initialPlayerTotals: Record<string, number>;
  players: Record<string, PlayerInfo>;
}

export default function InvestigationBoard({
  chapters,
  initialChapter,
  initialClues,
  accessLevel,
  currentUsername,
  initialPlayerTotals,
  players,
}: InvestigationBoardProps) {
  const [selectedChapter, setSelectedChapter] = useState<number | null>(initialChapter);
  const [clues, setClues] = useState<Clue[]>(initialClues);
  const [loading, setLoading] = useState(false);
  const [activeFactions, setActiveFactions] = useState<Set<string>>(new Set());
  const [playerTotals, setPlayerTotals] = useState<Record<string, number>>(initialPlayerTotals);

  const canDelete = accessLevel >= 66;

  // Reset filters when switching chapters
  useEffect(() => {
    setActiveFactions(new Set());
  }, [selectedChapter]);

  // Faction chips show only factions that appear in this chapter's clues
  const usedFactions = useMemo(() => {
    const set = new Set<string>();
    for (const c of clues) for (const s of c.factionSlugs) set.add(s);
    return Array.from(set)
      .map((slug) => ({ slug, allegiance: ALLEGIANCES[slug as AllegianceKey] }))
      .filter((x) => x.allegiance)
      .sort((a, b) => a.allegiance.name.localeCompare(b.allegiance.name));
  }, [clues]);

  const visibleClues = useMemo(() => {
    if (activeFactions.size === 0) return clues;
    return clues.filter((c) => c.factionSlugs.some((s) => activeFactions.has(s)));
  }, [clues, activeFactions]);

  // Per-player stats (only users present in `players` — i.e. accessLevel < 127
  // per the server-side filter). Shows "this chapter / total".
  const playerStats = useMemo(() => {
    const thisChapter = new Map<string, number>();
    for (const c of clues) {
      if (!players[c.createdBy]) continue;
      thisChapter.set(c.createdBy, (thisChapter.get(c.createdBy) ?? 0) + 1);
    }
    return Object.keys(players)
      .map((username) => ({
        username,
        thisChapter: thisChapter.get(username) ?? 0,
        total: playerTotals[username] ?? 0,
        info: players[username],
      }))
      .filter((p) => p.total > 0 || p.thisChapter > 0)
      .sort((a, b) => b.total - a.total || a.username.localeCompare(b.username));
  }, [clues, playerTotals, players]);

  const toggleFaction = (slug: string) => {
    setActiveFactions((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const fetchClues = useCallback(async (chapter: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/investigation/clues?chapter=${chapter}`);
      if (res.ok) {
        const data = await res.json();
        setClues(data.clues);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when chapter changes. Skip the very first render only — the
  // server already gave us clues for `initialChapter`. Subsequent visits to
  // that same chapter (after switching away and back) DO need a refetch.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (selectedChapter === null) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    fetchClues(selectedChapter);
  }, [selectedChapter, fetchClues]);

  const handleAdd = async (text: string, factionSlugs: string[]) => {
    if (selectedChapter === null) return;
    const res = await fetch("/api/investigation/clues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter: selectedChapter, text, factionSlugs }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to add clue");
      return;
    }
    const data = await res.json();
    setClues((prev) => [data.clue, ...prev]);
    const author = data.clue?.createdBy ?? currentUsername;
    if (players[author]) {
      setPlayerTotals((prev) => ({ ...prev, [author]: (prev[author] ?? 0) + 1 }));
    }
  };

  const handleSave = async (id: number, text: string, factionSlugs: string[]) => {
    const res = await fetch(`/api/investigation/clues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, factionSlugs }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to save clue");
      return;
    }
    const data = await res.json();
    setClues((prev) => prev.map((c) => (c.id === id ? data.clue : c)));
  };

  const handleDelete = async (id: number) => {
    const target = clues.find((c) => c.id === id);
    const res = await fetch(`/api/investigation/clues/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to delete clue");
      return;
    }
    setClues((prev) => prev.filter((c) => c.id !== id));
    if (target && players[target.createdBy]) {
      setPlayerTotals((prev) => ({
        ...prev,
        [target.createdBy]: Math.max(0, (prev[target.createdBy] ?? 0) - 1),
      }));
    }
  };

  const noChapters = chapters.length === 0;

  return (
    <div className="relative min-h-screen text-white">
      <div className="mx-auto px-6 py-10" style={{ maxWidth: "min(1800px, 96vw)" }}>
        {/* Header */}
        <header className="mb-6">
          <p className="text-[9px] tracking-[0.5em] uppercase text-indigo-300/40" style={cinzel}>
            Investigation Ledger
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <h1 className="text-2xl tracking-[0.25em] uppercase text-white/80" style={cinzel}>
              {selectedChapter !== null
                ? `Chapter ${toRoman(selectedChapter)}`
                : "—"}
            </h1>
            <ChapterDropdown
              chapters={chapters}
              current={selectedChapter}
              onSelect={setSelectedChapter}
            />
            {playerStats.length > 0 && (
              <div className="flex flex-col items-end gap-1 ml-auto pb-1">
                <span className="text-[8px] tracking-[0.3em] uppercase text-white/30" style={cinzel}>
                  Chapter / Total
                </span>
                <div className="flex items-center flex-wrap justify-end gap-x-4 gap-y-2">
                {playerStats.map((p) => {
                  const firstName = p.info?.firstName ?? p.username;
                  const imageUrl = p.info?.imageUrl ?? null;
                  return (
                    <div
                      key={p.username}
                      className="flex items-center gap-2"
                      title={`${p.username} — ${p.thisChapter} this chapter / ${p.total} total`}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={firstName}
                          className="w-5 h-5 rounded-full object-cover border border-white/15"
                        />
                      ) : (
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] uppercase border border-white/15 bg-white/5 text-white/55"
                          style={cinzel}
                        >
                          {firstName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="text-[10px] tracking-[0.15em] uppercase text-white/65" style={cinzel}>
                        {firstName}
                      </span>
                      <span className="text-[11px] tabular-nums text-white/85" style={cinzel}>
                        {p.thisChapter}
                        <span className="text-white/30"> / </span>
                        {p.total}
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
          <div className="w-32 h-px mt-3 bg-gradient-to-r from-indigo-400/60 via-indigo-400/20 to-transparent" />

          {usedFactions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {usedFactions.map(({ slug, allegiance }) => {
                const active = activeFactions.has(slug);
                return (
                  <button
                    key={slug}
                    onClick={() => toggleFaction(slug)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer"
                    style={{
                      ...cinzel,
                      borderColor: active ? allegiance.color : "rgba(255,255,255,0.1)",
                      background: active ? `${allegiance.color}1f` : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: allegiance.color, opacity: active ? 1 : 0.5 }}
                    />
                    <span className={`text-[9px] tracking-[0.2em] uppercase ${active ? "text-white/90" : "text-white/45"}`}>
                      {allegiance.name}
                    </span>
                  </button>
                );
              })}
              {activeFactions.size > 0 && (
                <button
                  onClick={() => setActiveFactions(new Set())}
                  className="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase text-white/30 hover:text-white/65 cursor-pointer"
                  style={cinzel}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </header>

        {noChapters ? (
          <div className="mt-16 text-center text-white/40 text-sm" style={cinzel}>
            <p className="tracking-[0.2em] uppercase text-[10px]">
              No chapters have been opened yet.
            </p>
            {accessLevel >= 127 && (
              <p className="mt-2 text-[9px] tracking-[0.15em] uppercase text-white/25">
                Open the first chapter from the admin panel.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            <AddTile disabled={selectedChapter === null} onAdd={handleAdd} />
            {loading ? (
              <p
                className="col-span-full text-center text-white/30 text-[10px] tracking-[0.2em] uppercase mt-6"
                style={cinzel}
              >
                Loading…
              </p>
            ) : (
              visibleClues.map((clue) => (
                <ClueTile
                  key={clue.id}
                  clue={clue}
                  canDelete={canDelete}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
