"use client";

import { useEffect, useState } from "react";
import type { CombatEnemyShip } from "@/types/game";
import { COMBAT_FACTIONS } from "@/lib/combat/factions";
import { SIZE_CLASS_BY_ID } from "@/lib/combat/sizeClasses";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface GMPanelProps {
  visible: boolean;
  // gm phase enables Add and drag-edit; player phase still allows label/faction/delete on a clicked ship.
  inGmPhase: boolean;
  onAdd: () => void;
  selectedEnemy: CombatEnemyShip | null;
  // Called with the new label/faction values when the GM presses Done.
  onSaveEdit: (changes: { label: string; factionId: string | null }) => void;
  onDelete: () => void;
  // Called when the GM presses Esc or clicks "Cancel" to discard pending edits.
  onCancelEdit: () => void;
}

export default function GMPanel({
  visible,
  inGmPhase,
  onAdd,
  selectedEnemy,
  onSaveEdit,
  onDelete,
  onCancelEdit,
}: GMPanelProps) {
  // Local draft state for the editing section. Resets when selectedEnemy.id changes.
  const [draftLabel, setDraftLabel] = useState("");
  const [draftFactionId, setDraftFactionId] = useState<string | null>(null);
  const [seededId, setSeededId] = useState<string | null>(null);
  if (selectedEnemy && selectedEnemy.id !== seededId) {
    setSeededId(selectedEnemy.id);
    setDraftLabel(selectedEnemy.label);
    setDraftFactionId(selectedEnemy.factionId);
  }
  if (!selectedEnemy && seededId !== null) {
    setSeededId(null);
  }

  // Slide-in on first mount (mirror of PlayerPanel — from right).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [visible]);

  if (!visible) return null;

  const handleDelete = () => {
    if (!selectedEnemy) return;
    if (!confirm(`Delete "${selectedEnemy.label}"? This is permanent.`)) return;
    onDelete();
  };

  return (
    <div
      className="fixed top-1/2 right-3 z-20 w-64 flex flex-col gap-3 rounded-lg border border-white/8 bg-black/40 backdrop-blur-md p-3 transition-all duration-700 ease-out"
      style={{
        pointerEvents: "auto",
        transform: `translateY(-50%) translateX(${shown ? "0" : "150%"})`,
        opacity: shown ? 1 : 0,
      }}
    >
      {inGmPhase && !selectedEnemy && (
        <button
          type="button"
          onClick={onAdd}
          className="w-full px-3 py-2 rounded border border-indigo-300/40 text-[9px] tracking-[0.2em] uppercase text-indigo-200/80 hover:text-indigo-200 hover:border-indigo-300/70 hover:bg-indigo-300/10 cursor-pointer transition-all"
          style={cinzel}
        >
          + Add Ship
        </button>
      )}

      {selectedEnemy && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[8px] tracking-[0.3em] uppercase text-white/35" style={cinzel}>
            Editing: {SIZE_CLASS_BY_ID[selectedEnemy.sizeClass].displayName}
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-[7px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              Label
            </label>
            <input
              className="w-full bg-white/8 border border-white/15 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-white/40"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              maxLength={40}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[7px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              Faction
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setDraftFactionId(null)}
                className={`px-1.5 py-1 rounded border text-[8px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                  draftFactionId === null
                    ? "border-indigo-300/60 bg-indigo-300/15 text-indigo-200/90"
                    : "border-white/10 text-white/40 hover:border-white/30"
                }`}
                style={cinzel}
              >
                None
              </button>
              {COMBAT_FACTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDraftFactionId(f.id)}
                  className={`px-1.5 py-1 rounded border text-[8px] tracking-[0.1em] uppercase cursor-pointer transition-all flex items-center gap-1 ${
                    draftFactionId === f.id
                      ? "border-indigo-300/60 bg-indigo-300/15 text-indigo-200/90"
                      : "border-white/10 text-white/40 hover:border-white/30"
                  }`}
                  style={cinzel}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: f.color }}
                  />
                  {f.displayName}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleDelete}
              className="px-2 py-1.5 rounded border border-red-400/30 text-[8px] tracking-[0.15em] uppercase text-red-300/70 hover:text-red-300 hover:border-red-400/60 hover:bg-red-400/10 cursor-pointer transition-all"
              style={cinzel}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="ml-auto px-2 py-1.5 text-[8px] tracking-[0.15em] uppercase text-white/35 hover:text-white/70 cursor-pointer"
              style={cinzel}
            >
              Esc
            </button>
            <button
              type="button"
              onClick={() => onSaveEdit({ label: draftLabel, factionId: draftFactionId })}
              className="px-3 py-1.5 rounded border border-indigo-300/40 text-[8px] tracking-[0.15em] uppercase text-indigo-200/80 hover:text-indigo-200 hover:border-indigo-300/70 hover:bg-indigo-300/10 cursor-pointer transition-all"
              style={cinzel}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
