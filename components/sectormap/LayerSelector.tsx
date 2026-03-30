"use client";

import { useState, useRef, useEffect } from "react";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface LayerOption {
  slug: string;
  label: string;
}

interface LayerSelectorProps {
  layers: LayerOption[];
  selected: string;
  onChange: (slug: string) => void;
}

const NONE: LayerOption = { slug: "None", label: "None" };

export function LayerSelector({ layers, selected, onChange }: LayerSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const options = [NONE, ...layers];
  const selectedLabel = options.find(o => o.slug === selected)?.label ?? "Layers";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded scifi-card text-[10px] tracking-[0.2em] uppercase text-slate-300 hover:text-white transition-colors"
        style={cinzel}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-slate-400"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        {selected === "None" ? "Layers" : selectedLabel}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 min-w-[140px] rounded-lg border border-white/10 bg-gray-950/95 backdrop-blur-md shadow-2xl shadow-black/50 overflow-hidden z-50">
          {options.map((layer) => (
            <button
              key={layer.slug}
              onClick={() => { onChange(layer.slug); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-[11px] tracking-[0.15em] uppercase transition-all duration-200 ${
                selected === layer.slug
                  ? "text-white/80 bg-white/[0.08]"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
              style={cinzel}
            >
              {layer.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
