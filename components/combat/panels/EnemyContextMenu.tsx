"use client";

import type { CombatEnemyShip, CombatFace, CombatRangeBand } from "@/types/game";
import { FACES } from "@/lib/combat/faces";
import { RANGES } from "@/lib/combat/ranges";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface EnemyContextMenuProps {
  enemy: CombatEnemyShip;
  // Screen-space anchor for the menu (px from top-left of viewport).
  screenX: number;
  screenY: number;
  onChangeRange: (range: CombatRangeBand) => void;
  onChangeFacing: (facing: CombatFace) => void;
  onDelete: () => void;
  onClose: () => void;
}

const RANGE_LABEL: Record<CombatRangeBand, string> = {
  "up-close": "Up-Close",
  "close": "Close",
  "medium": "Medium",
  "far": "Far",
  "very-far": "Very Far",
};

const FACE_LABEL: Record<CombatFace, string> = {
  bow: "Bow",
  stern: "Stern",
  port: "Port",
  starboard: "Starboard",
  dorsal: "Dorsal",
  ventral: "Ventral",
};

export default function EnemyContextMenu({
  enemy,
  screenX,
  screenY,
  onChangeRange,
  onChangeFacing,
  onDelete,
  onClose,
}: EnemyContextMenuProps) {
  return (
    <>
      {/* Backdrop captures clicks outside the menu to close it. */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-40 rounded-lg border border-white/15 bg-gray-950/95 backdrop-blur-md shadow-2xl p-2 min-w-[180px]"
        style={{ left: screenX + 6, top: screenY + 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2 pt-1 pb-2 text-[8px] tracking-[0.25em] uppercase text-white/35" style={cinzel}>
          {enemy.label}
        </p>

        {/* Range layer */}
        <div className="px-1 pb-2">
          <p className="px-1 pb-1 text-[7px] tracking-[0.2em] uppercase text-white/25" style={cinzel}>
            Range Layer
          </p>
          <div className="grid grid-cols-1 gap-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => { onChangeRange(r.id); onClose(); }}
                className={`text-left px-2 py-1 rounded text-[9px] tracking-[0.1em] uppercase transition-colors cursor-pointer ${
                  enemy.range === r.id
                    ? "bg-indigo-300/15 text-indigo-200/90"
                    : "text-white/55 hover:bg-white/5 hover:text-white/85"
                }`}
                style={cinzel}
              >
                {RANGE_LABEL[r.id]}
              </button>
            ))}
          </div>
        </div>

        {/* Facing */}
        <div className="px-1 pb-2 border-t border-white/8 pt-2">
          <p className="px-1 pb-1 text-[7px] tracking-[0.2em] uppercase text-white/25" style={cinzel}>
            Facing
          </p>
          <div className="grid grid-cols-2 gap-0.5">
            {FACES.map((f) => (
              <button
                key={f.id}
                onClick={() => { onChangeFacing(f.id); onClose(); }}
                className={`text-left px-2 py-1 rounded text-[9px] tracking-[0.1em] uppercase transition-colors cursor-pointer ${
                  enemy.facing === f.id
                    ? "bg-indigo-300/15 text-indigo-200/90"
                    : "text-white/55 hover:bg-white/5 hover:text-white/85"
                }`}
                style={cinzel}
              >
                {FACE_LABEL[f.id]}
              </button>
            ))}
          </div>
        </div>

        {/* Delete */}
        <div className="px-1 pt-1 border-t border-white/8">
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full text-left px-2 py-1 rounded text-[9px] tracking-[0.1em] uppercase text-red-300/70 hover:text-red-300 hover:bg-red-400/10 cursor-pointer transition-colors"
            style={cinzel}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
