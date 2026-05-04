"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { SectorMetadata, SystemPin } from "@/types/sector";
import type { CelestialBodyType, StarSystemMetadata } from "@/types/starsystem";

interface SearchItem {
  label: string;
  sublabel: string;
  type: "system" | CelestialBodyType;
  systemSlug: string;
  bodyId: string | null;
  pin: SystemPin;
}

interface SearchOverlayProps {
  sector: SectorMetadata;
  systemsData: Record<string, StarSystemMetadata>;
  onSelectSystem: (pin: SystemPin) => void;
  onSelectBody: (pin: SystemPin, bodyId: string) => void;
}

/* ── Type indicator colors ── */
const TYPE_COLORS: Record<string, string> = {
  system:           "#a78bfa", // violet
  planet:           "#60a5fa", // blue
  moon:             "#94a3b8", // slate
  station:          "#34d399", // emerald
  ship:             "#fbbf24", // amber
  fleet:            "#f87171", // red
  "asteroid-field": "#78716c", // stone
};

const SearchIcon = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/** Tiny colored dot indicating celestial body type */
const TypeDot = ({ type }: { type: string }) => (
  <span
    className="shrink-0 inline-block w-1.5 h-1.5 rounded-full mt-[3px]"
    style={{ backgroundColor: TYPE_COLORS[type] ?? "#6366f1", boxShadow: `0 0 4px ${TYPE_COLORS[type] ?? "#6366f1"}` }}
  />
);

export function SearchOverlay({ sector, systemsData, onSelectSystem, onSelectBody }: SearchOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const searchIndex = useMemo(() => {
    const items: SearchItem[] = [];
    for (const pin of sector.systems) {
      const sys = systemsData[pin.slug];
      const name = sys?.name ?? pin.slug;
      items.push({ label: name, sublabel: "Star System", type: "system", systemSlug: pin.slug, bodyId: null, pin });
      if (sys) {
        for (const body of sys.bodies) {
          if (body.published === false) continue;
          items.push({
            label: body.name,
            sublabel: `${body.type} in ${name}`,
            type: body.type,
            systemSlug: pin.slug,
            bodyId: body.id,
            pin,
          });
        }
      }
    }
    return items;
  }, [sector.systems, systemsData]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return searchIndex.filter(item =>
      item.label.toLowerCase().includes(q) || item.sublabel.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query, searchIndex]);

  // Reset highlight when the result set changes — render-time pattern from
  // React 19 docs (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [lastResults, setLastResults] = useState(results);
  if (results !== lastResults) {
    setLastResults(results);
    setHighlightIdx(0);
  }

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const select = useCallback((item: SearchItem) => {
    if (item.bodyId) {
      onSelectBody(item.pin, item.bodyId);
    } else {
      onSelectSystem(item.pin);
    }
    close();
  }, [onSelectSystem, onSelectBody, close]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[highlightIdx]) { select(results[highlightIdx]); }
  }, [close, results, highlightIdx, select]);

  const showDropdown = isOpen && (results.length > 0 || (query.trim().length > 0));

  return (
    <div ref={wrapperRef} className="relative flex justify-end">
      {/* ── Search bar (animates w-8 → w-56) ── */}
      <div
        onClick={() => { if (!isOpen) setIsOpen(true); }}
        className={`flex items-center h-8 rounded-md overflow-hidden transition-all duration-250 ease-in-out
          ${isOpen
            ? "w-56 px-2.5 gap-2 bg-slate-900/90 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
            : "w-8 justify-center cursor-pointer scifi-card hover:text-white"
          }`}
        style={isOpen ? { backdropFilter: "blur(16px)" } : undefined}
        role={isOpen ? undefined : "button"}
        aria-label={isOpen ? undefined : "Search celestial bodies"}
      >
        <SearchIcon className={`shrink-0 transition-colors duration-200 ${isOpen ? "text-indigo-400/70" : "text-white/70"}`} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search bodies..."
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-results-list"
          aria-activedescendant={results[highlightIdx] ? `search-item-${highlightIdx}` : undefined}
          tabIndex={isOpen ? 0 : -1}
          className={`bg-transparent text-white/90 text-xs outline-none placeholder:text-white/25 transition-all duration-200 ${
            isOpen ? "w-full opacity-100" : "w-0 opacity-0 pointer-events-none"
          }`}
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        />
        {/* ESC hint */}
        {isOpen && (
          <span className="shrink-0 text-[9px] text-white/20 uppercase tracking-wider select-none">esc</span>
        )}
      </div>

      {/* ── Results dropdown ── */}
      {isOpen && results.length > 0 && (
        <div
          id="search-results-list"
          role="listbox"
          className="absolute top-10 right-0 w-60 rounded-md border border-indigo-500/20 bg-slate-900/95 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_16px_rgba(99,102,241,0.08)] py-1 flex flex-col max-h-64 overflow-y-auto animate-in fade-in"
          style={{ backdropFilter: "blur(20px)" }}
        >
          {results.map((item, i) => (
            <button
              key={`${item.systemSlug}-${item.bodyId ?? "sys"}`}
              id={`search-item-${i}`}
              role="option"
              aria-selected={i === highlightIdx}
              onClick={() => select(item)}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`text-left px-3 py-2 mx-1 rounded flex items-start gap-2 transition-all duration-150 ${
                i === highlightIdx
                  ? "bg-indigo-500/15 text-white"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              <TypeDot type={item.type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs leading-tight" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                  {item.label}
                </div>
                <div className="text-[10px] text-white/30 truncate leading-tight mt-0.5 capitalize">
                  {item.sublabel}
                </div>
              </div>
              {i === highlightIdx && (
                <span className="shrink-0 text-[9px] text-white/20 mt-0.5">&#x21B5;</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {isOpen && query.trim() && results.length === 0 && (
        <div
          className="absolute top-10 right-0 w-60 rounded-md border border-indigo-500/20 bg-slate-900/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 text-center"
          style={{ backdropFilter: "blur(20px)" }}
        >
          <div className="text-xs text-white/30" style={{ fontFamily: "var(--font-cinzel), serif" }}>
            No celestial bodies found
          </div>
          <div className="text-[10px] text-white/15 mt-1">Try a different name or type</div>
        </div>
      )}
    </div>
  );
}
