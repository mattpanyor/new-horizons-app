"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export interface MentionEntity {
  entityId: number;
  name: string;
  type: string;
  imageUrl: string | null;
}

interface MentionPickerProps {
  entities: MentionEntity[];
  query: string;
  onPick: (entity: MentionEntity) => void;
  onClose: () => void;
}

export default function MentionPicker({ entities, query, onPick, onClose }: MentionPickerProps) {
  const [highlight, setHighlight] = useState(0);
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    // Reset highlight when the search query changes (React docs pattern)
    setLastQuery(query);
    setHighlight(0);
  }
  const listRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q.length === 0
      ? entities
      : entities.filter((e) => e.name.toLowerCase().includes(q));
    // Prefer matches that start with the query
    return filtered.sort((a, b) => {
      if (q.length === 0) return a.name.localeCompare(b.name);
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    }).slice(0, 30);
  }, [entities, query]);

  // Keyboard navigation — capture phase so we win over the editor's Esc handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) => Math.min(h + 1, matches.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        if (matches[highlight]) {
          e.preventDefault();
          e.stopPropagation();
          onPick(matches[highlight]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        if (matches[highlight]) {
          e.preventDefault();
          e.stopPropagation();
          onPick(matches[highlight]);
        }
      }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [matches, highlight, onPick, onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  if (matches.length === 0) {
    return (
      <div
        className="absolute left-0 right-0 top-full mt-1 z-30 rounded border border-white/10 px-3 py-2"
        style={{ background: "rgba(8,12,28,0.98)", backdropFilter: "blur(12px)" }}
      >
        <span className="text-[10px] tracking-[0.15em] uppercase text-white/30" style={cinzel}>
          No matches
        </span>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-y-auto rounded border border-white/10 shadow-xl"
      style={{ background: "rgba(8,12,28,0.98)", backdropFilter: "blur(12px)" }}
    >
      {matches.map((e, idx) => {
        const active = idx === highlight;
        return (
          <button
            key={e.entityId}
            type="button"
            data-idx={idx}
            onMouseDown={(ev) => {
              // Use mousedown so we don't lose textarea focus before click registers
              ev.preventDefault();
              onPick(e);
            }}
            onMouseEnter={() => setHighlight(idx)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left cursor-pointer ${active ? "bg-indigo-500/15" : "hover:bg-white/5"}`}
          >
            {e.imageUrl ? (
              <img src={e.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-white/10" />
            ) : (
              <span className="w-5 h-5 rounded-full border border-white/10 bg-white/5" />
            )}
            <span className="flex-1 text-[10px] tracking-[0.1em] text-white/85" style={cinzel}>
              {e.name}
            </span>
            <span className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              {e.type}
            </span>
          </button>
        );
      })}
    </div>
  );
}
