"use client";

import { useState, useRef, useEffect } from "react";
import { ALLEGIANCES, type AllegianceKey } from "@/lib/allegiances";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const FACTION_OPTIONS = (Object.entries(ALLEGIANCES) as [AllegianceKey, typeof ALLEGIANCES[AllegianceKey]][])
  .map(([slug, a]) => ({ slug, name: a.name, color: a.color }));

interface FactionPickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  autoFocus?: boolean;
}

export default function FactionPicker({ selected, onChange, autoFocus }: FactionPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Close dropdown when clicking outside the picker
  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  const selectedSet = new Set(selected);
  const matches = FACTION_OPTIONS.filter((f) =>
    !selectedSet.has(f.slug) && f.name.toLowerCase().includes(query.toLowerCase())
  );

  function add(slug: string) {
    if (selectedSet.has(slug)) return;
    onChange([...selected, slug]);
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(slug: string) {
    onChange(selected.filter((s) => s !== slug));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      e.preventDefault();
      onChange(selected.slice(0, -1));
    } else if (e.key === "Enter" && matches.length > 0) {
      e.preventDefault();
      add(matches[0].slug);
    } else if (e.key === "Escape") {
      // Let parent handle Esc — close dropdown but bubble up
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1 p-1.5 rounded border border-white/10 bg-white/[0.03] focus-within:border-indigo-400/40">
        {selected.map((slug) => {
          const f = ALLEGIANCES[slug as AllegianceKey];
          if (!f) return null;
          return (
            <span
              key={slug}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[8px] tracking-[0.15em] uppercase"
              style={{ ...cinzel, background: `${f.color}22`, color: f.color }}
            >
              {f.name}
              <button
                type="button"
                onClick={() => remove(slug)}
                className="hover:text-white/90 cursor-pointer"
                aria-label={`Remove ${f.name}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? "tag factions…" : ""}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-[10px] text-white/85 placeholder:text-white/25"
          style={cinzel}
        />
      </div>

      {open && matches.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 max-h-44 overflow-y-auto rounded border border-white/10 shadow-lg"
          style={{ background: "rgba(8, 12, 28, 0.98)", backdropFilter: "blur(12px)" }}
        >
          {matches.map((f) => (
            <button
              key={f.slug}
              type="button"
              onClick={() => add(f.slug)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-white/5 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />
              <span className="text-[9px] tracking-[0.15em] uppercase text-white/70" style={cinzel}>
                {f.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
