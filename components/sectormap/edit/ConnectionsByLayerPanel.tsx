"use client";

// Grouped list of all connections in the sector, surfacing orphans (endpoint
// slugs that don't resolve). Lets the GM edit/delete connections whose
// endpoints disappeared after a slug rename, since they're invisible on the
// canvas. See map-migration.md §6.2 and D7.

import { useMemo } from "react";
import { useEditMode } from "./EditModeProvider";
import type { ConnectionLine, LayerSlug } from "@/types/sector";
import { MAP_LAYERS } from "@/types/sector";

// MAP_LAYERS keys now match their slug values (see types/sector.ts), so
// LayerSlug | "none" is the canonical key set.
type LayerKey = LayerSlug | "none";
const LAYER_LABELS: Record<LayerKey, string> = {
  ...(Object.fromEntries(
    Object.values(MAP_LAYERS).map((l) => [l.slug, l.label])
  ) as Record<LayerSlug, string>),
  none: "No Layer",
};

interface Props {
  onPicked?: () => void; // called after a connection is selected from the list (so the parent panel can switch tabs)
}

export function ConnectionsByLayerPanel({ onPicked }: Props = {}) {
  const { effectiveSector, select, selection } = useEditMode();

  const slugSet = useMemo(() => {
    const s = new Set<string>();
    for (const sys of effectiveSector.systems) s.add(sys.slug);
    for (const v of effectiveSector.vortexes ?? []) s.add(v.slug);
    for (const m of effectiveSector.markers ?? []) if (m.slug) s.add(m.slug);
    return s;
  }, [effectiveSector]);

  const grouped = useMemo(() => {
    const map = new Map<LayerKey, ConnectionLine[]>();
    for (const c of effectiveSector.connections ?? []) {
      const key = (c.layer ?? "none") as LayerKey;
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [effectiveSector.connections]);

  const layerOrder: LayerKey[] = ["movement", "story", "conflict", "invasion", "none"];

  const total = (effectiveSector.connections ?? []).length;
  if (total === 0) {
    return <p className="text-xs text-slate-500 italic">No connections in this sector yet.</p>;
  }

  return (
    <div className="space-y-3">
      {layerOrder.map((layer) => {
        const items = grouped.get(layer);
        if (!items || items.length === 0) return null;
        const label = LAYER_LABELS[layer];
        return (
          <div key={layer}>
            <div
              className="text-[10px] tracking-widest uppercase text-slate-400 mb-1.5"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              {label} ({items.length})
            </div>
            <ul className="space-y-1">
              {items.map((c, i) => {
                const fromOrphan = !slugSet.has(c.from);
                const toOrphan = !slugSet.has(c.to);
                const isOrphan = fromOrphan || toOrphan;
                // Pending creates have only a tempId; existing rows have id.
                const tempId = (c as ConnectionLine & { tempId?: string }).tempId;
                const key = c.id ?? tempId ?? `tmp-${i}`;
                const isSelected =
                  selection?.kind === "connection" &&
                  ((c.id !== undefined && selection.id === c.id) ||
                    (tempId !== undefined && selection.tempId === tempId));
                const onPick = () => {
                  if (c.id !== undefined) select("connection", c.id);
                  else if (tempId !== undefined) select("connection", null, tempId);
                  else return;
                  onPicked?.();
                };
                return (
                  <li key={key}>
                    <button
                      onClick={onPick}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs text-slate-200 transition flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-amber-500/15 border border-amber-500/50"
                          : "bg-black/30 border border-white/5 hover:border-amber-500/40 hover:bg-black/40"
                      }`}
                    >
                      <span className={fromOrphan ? "text-rose-300" : ""}>{c.from}</span>
                      <span className="text-slate-500">→</span>
                      <span className={toOrphan ? "text-rose-300" : ""}>{c.to}</span>
                      {isOrphan && (
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-rose-900/40 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
                          orphan
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
