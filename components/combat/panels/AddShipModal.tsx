"use client";

import { useState } from "react";
import type { CombatRangeBand, CombatSizeClass } from "@/types/game";
import { RANGES } from "@/lib/combat/ranges";
import { SIZE_CLASSES } from "@/lib/combat/sizeClasses";
import { COMBAT_FACTIONS } from "@/lib/combat/factions";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface AddShipModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    range: CombatRangeBand;
    sizeClass: CombatSizeClass;
    factionId: string | null;
    label?: string;
  }) => void;
}

const RANGE_LABEL: Record<CombatRangeBand, string> = {
  "up-close": "Up-Close",
  "close": "Close",
  "medium": "Medium",
  "far": "Far",
  "very-far": "Very Far",
};

export default function AddShipModal({ open, onClose, onConfirm }: AddShipModalProps) {
  const [range, setRange] = useState<CombatRangeBand>("medium");
  const [sizeClass, setSizeClass] = useState<CombatSizeClass>("frigate");
  const [factionId, setFactionId] = useState<string | null>(
    COMBAT_FACTIONS[0]?.id ?? null,
  );
  const [label, setLabel] = useState("");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-lg border border-white/10 bg-gray-950/95 p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] tracking-[0.3em] uppercase text-white/40" style={cinzel}>
          Add Ship
        </p>

        {/* Range layer */}
        <div className="flex flex-col gap-1">
          <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
            Range Layer
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`px-2 py-1.5 rounded border text-[8px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                  range === r.id
                    ? "border-indigo-300/60 bg-indigo-300/15 text-indigo-200/90"
                    : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/80"
                }`}
                style={cinzel}
              >
                {RANGE_LABEL[r.id]}
              </button>
            ))}
          </div>
        </div>

        {/* Size class */}
        <div className="flex flex-col gap-1">
          <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
            Size Class
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {SIZE_CLASSES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSizeClass(s.id)}
                className={`px-2 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                  sizeClass === s.id
                    ? "border-indigo-300/60 bg-indigo-300/15 text-indigo-200/90"
                    : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/80"
                }`}
                style={cinzel}
              >
                {s.displayName}
              </button>
            ))}
          </div>
        </div>

        {/* Faction */}
        <div className="flex flex-col gap-1">
          <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
            Faction
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFactionId(null)}
              className={`px-2 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                factionId === null
                  ? "border-indigo-300/60 bg-indigo-300/15 text-indigo-200/90"
                  : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/80"
              }`}
              style={cinzel}
            >
              None
            </button>
            {COMBAT_FACTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFactionId(f.id)}
                className={`px-2 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all flex items-center gap-1.5 ${
                  factionId === f.id
                    ? "border-indigo-300/60 bg-indigo-300/15 text-indigo-200/90"
                    : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/80"
                }`}
                style={cinzel}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: f.color }}
                />
                {f.displayName}
              </button>
            ))}
          </div>
        </div>

        {/* Optional label */}
        <div className="flex flex-col gap-1">
          <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
            Label (optional)
          </label>
          <input
            className="w-full bg-white/8 border border-white/15 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/40"
            placeholder="Defaults to size class"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase text-white/40 hover:text-white/70 cursor-pointer"
            style={cinzel}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ range, sizeClass, factionId, label: label.trim() || undefined })}
            className="ml-auto px-4 py-1.5 rounded border border-indigo-300/40 text-[9px] tracking-[0.15em] uppercase text-indigo-200/80 hover:text-indigo-200 hover:border-indigo-300/70 hover:bg-indigo-300/10 cursor-pointer transition-all"
            style={cinzel}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
