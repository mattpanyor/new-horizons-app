"use client";

import { useState, useRef, useEffect } from "react";
import type { Chapter } from "@/types/investigation";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"],
  [1, "I"],
];

export function toRoman(n: number): string {
  if (n < 1) return String(n);
  let out = "";
  let remaining = n;
  for (const [value, sym] of ROMAN) {
    while (remaining >= value) {
      out += sym;
      remaining -= value;
    }
  }
  return out;
}

interface ChapterDropdownProps {
  chapters: Chapter[];
  current: number | null;
  onSelect: (number: number) => void;
}

export default function ChapterDropdown({ chapters, current, onSelect }: ChapterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  const currentChapter = chapters.find((c) => c.number === current);
  const label = currentChapter
    ? `Chapter ${toRoman(currentChapter.number)} — ${currentChapter.title}`
    : "No chapters yet";

  // Newest first in the dropdown
  const sortedDesc = [...chapters].sort((a, b) => b.number - a.number);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={chapters.length === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-md border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ ...cinzel, background: "rgba(10,10,30,0.5)", backdropFilter: "blur(8px)" }}
      >
        <span className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-white/85">{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-white/55 transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30 min-w-full rounded-md border border-white/10 shadow-xl overflow-hidden"
          style={{ background: "rgba(8,12,28,0.98)", backdropFilter: "blur(12px)" }}
        >
          {sortedDesc.map((c) => {
            const active = c.number === current;
            return (
              <button
                key={c.number}
                onClick={() => { onSelect(c.number); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 cursor-pointer ${active ? "bg-indigo-500/10" : ""}`}
              >
                <span
                  className={`text-[9px] tracking-[0.2em] uppercase ${active ? "text-indigo-300" : "text-white/45"}`}
                  style={cinzel}
                >
                  Ch. {toRoman(c.number)}
                </span>
                <span className={`text-[10px] tracking-[0.1em] ${active ? "text-white/90" : "text-white/65"}`} style={cinzel}>
                  {c.title}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
