"use client";

// Add-connection dialog. Two searchable inputs (A, B) backed by the
// effective sector's sluggable entities (systems + vortexes + markers).
// On confirm, stages a new connection with default styling.

import { useMemo, useState } from "react";
import { useEditMode } from "./EditModeProvider";

interface Endpoint {
  slug: string;
  name: string;
  kind: "system" | "vortex" | "marker";
}

export function AddConnectionDialog({ onClose }: { onClose: () => void }) {
  const { effectiveSector, createEntity } = useEditMode();
  const [from, setFrom] = useState<Endpoint | null>(null);
  const [to, setTo] = useState<Endpoint | null>(null);

  const endpoints = useMemo<Endpoint[]>(() => {
    const items: Endpoint[] = [];
    for (const s of effectiveSector.systems) {
      items.push({ slug: s.slug, name: s.slug, kind: "system" });
    }
    for (const v of effectiveSector.vortexes ?? []) {
      items.push({ slug: v.slug, name: v.name, kind: "vortex" });
    }
    for (const m of effectiveSector.markers ?? []) {
      if (m.slug) items.push({ slug: m.slug, name: m.name, kind: "marker" });
    }
    return items;
  }, [effectiveSector]);

  const submit = () => {
    if (!from || !to) return;
    createEntity("connection", { from: from.slug, to: to.slug, curvature: 0 });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-950 border border-amber-500/30 rounded-lg p-5 w-[420px] max-w-[90vw] space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-amber-300 text-sm uppercase tracking-widest"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Add Connection
        </h3>
        <EndpointPicker label="From" value={from} onChange={setFrom} endpoints={endpoints} />
        <EndpointPicker label="To" value={to} onChange={setTo} endpoints={endpoints} />
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white border border-white/10 hover:border-white/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!from || !to || from.slug === to.slug}
            className="px-3 py-1.5 rounded text-xs bg-amber-500/30 text-amber-100 border border-amber-500/50 hover:bg-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function EndpointPicker({
  label,
  value,
  onChange,
  endpoints,
}: {
  label: string;
  value: Endpoint | null;
  onChange: (v: Endpoint | null) => void;
  endpoints: Endpoint[];
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return endpoints.slice(0, 8);
    return endpoints
      .filter((e) => e.slug.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [endpoints, query]);

  return (
    <div>
      <label
        className="text-[11px] text-slate-400 tracking-wider uppercase block mb-1"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        {label}
      </label>
      {value ? (
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2 py-1.5">
          <span className="text-xs text-slate-200 flex-1">
            {value.name}
            <span className="ml-2 text-slate-500">({value.kind})</span>
          </span>
          <button
            onClick={() => { onChange(null); setQuery(""); }}
            className="text-slate-400 hover:text-rose-300 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search systems, vortexes, markers…"
            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
          />
          {query && filtered.length > 0 && (
            <ul className="mt-1 max-h-40 overflow-y-auto bg-slate-900 border border-white/10 rounded">
              {filtered.map((e) => (
                <li key={`${e.kind}-${e.slug}`}>
                  <button
                    onClick={() => onChange(e)}
                    className="w-full text-left px-2 py-1.5 text-xs text-slate-200 hover:bg-amber-500/20 flex items-center gap-1.5"
                  >
                    <span>{e.name}</span>
                    <span className="ml-auto text-[10px] uppercase text-slate-500 tracking-wider">{e.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
