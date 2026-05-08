"use client";

import { useEffect, useState } from "react";
import type { CombatFace, CombatRangeBand } from "@/types/game";
import { FACES } from "@/lib/combat/faces";
import { RANGES } from "@/lib/combat/ranges";
import { PLAYER_SHIP } from "@/lib/combat/playerShip";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface PlayerPanelProps {
  // Toggle state — single-active per group. Hover state is held by the panel
  // internally but reported up via onHover for visual feedback.
  activeFace: CombatFace | null;
  hoveredFace: CombatFace | null;
  onToggleFace: (face: CombatFace) => void;
  onHoverFace: (face: CombatFace | null) => void;

  activeRange: CombatRangeBand | null;
  hoveredRange: CombatRangeBand | null;
  onToggleRange: (range: CombatRangeBand) => void;
  onHoverRange: (range: CombatRangeBand | null) => void;

  // Active weapon id (whether aiming or placed). Single-active across all
  // weapons. Click-to-toggle. The aiming-vs-placed phase is held by the parent.
  activeWeaponId: string | null;
  onToggleWeapon: (weaponId: string) => void;

  // Aegis "Flip" ability — commander-only. Three derived states:
  //   ready: button live, click invokes
  //   charging: button shows "Flip Charging", disabled
  //   cooldown(N): button disabled, shows turns left
  isCommander: boolean;
  flipState:
    | { kind: "ready" }
    | { kind: "charging" }
    | { kind: "cooldown"; turnsLeft: number };
  onInvokeFlip: () => void;

  // Aegis "Graviton Lattice" ability — commander toggle, on/off.
  // While active, the Graviton Lance weapon button is disabled
  // (interference). Mutex with Flip enforced server-side.
  latticeActive: boolean;
  onToggleLattice: () => void;

  // Whether the panel buttons should respond. False during GM phase / non-player.
  enabled: boolean;
}

const RANGE_DISPLAY: Record<CombatRangeBand, string> = {
  "up-close": "Up-Close",
  "close": "Close",
  "medium": "Medium",
  "far": "Far",
  "very-far": "Very Far",
};

const FACE_DISPLAY: Record<CombatFace, string> = {
  bow: "Bow",
  stern: "Stern",
  port: "Port",
  starboard: "Starboard",
  dorsal: "Dorsal",
  ventral: "Ventral",
};

interface ToggleButtonProps {
  label: string;
  active: boolean;
  enabled: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function ToggleButton({
  label,
  active,
  enabled,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`
        px-3 py-1.5 rounded border text-[9px] tracking-[0.2em] uppercase transition-all
        ${active
          ? "border-indigo-300/60 bg-indigo-300/15 text-indigo-200/90"
          : enabled
            ? "border-white/15 text-white/55 hover:border-white/35 hover:text-white/85 hover:bg-white/5 cursor-pointer"
            : "border-white/5 text-white/15 cursor-not-allowed"}
      `}
      style={cinzel}
    >
      {label}
    </button>
  );
}

export default function PlayerPanel({
  activeFace,
  onToggleFace,
  onHoverFace,
  activeRange,
  onToggleRange,
  onHoverRange,
  activeWeaponId,
  onToggleWeapon,
  isCommander,
  flipState,
  onInvokeFlip,
  latticeActive,
  onToggleLattice,
  enabled,
}: PlayerPanelProps) {
  // Slide-in on first mount: starts off-screen-left + fully transparent,
  // animates to its docked position on the next animation frame so the
  // browser registers the initial state before transitioning.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="fixed top-1/2 left-3 z-20 flex flex-col gap-4 rounded-lg border border-white/8 bg-black/40 backdrop-blur-md p-3 transition-all duration-700 ease-out"
      style={{
        pointerEvents: "auto",
        transform: `translateY(-50%) translateX(${shown ? "0" : "-150%"})`,
        opacity: shown ? 1 : 0,
      }}
    >
      {/* Faces */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[8px] tracking-[0.3em] uppercase text-white/30 mb-1" style={cinzel}>
          Look At
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {FACES.map((f) => (
            <ToggleButton
              key={f.id}
              label={FACE_DISPLAY[f.id]}
              active={activeFace === f.id}
              enabled={enabled}
              onClick={() => onToggleFace(f.id)}
              onMouseEnter={() => onHoverFace(f.id)}
              onMouseLeave={() => onHoverFace(null)}
            />
          ))}
        </div>
      </div>

      {/* Ranges */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[8px] tracking-[0.3em] uppercase text-white/30 mb-1" style={cinzel}>
          Range
        </p>
        <div className="flex flex-col gap-1.5">
          {RANGES.map((r) => (
            <ToggleButton
              key={r.id}
              label={RANGE_DISPLAY[r.id]}
              active={activeRange === r.id}
              enabled={enabled}
              onClick={() => onToggleRange(r.id)}
              onMouseEnter={() => onHoverRange(r.id)}
              onMouseLeave={() => onHoverRange(null)}
            />
          ))}
        </div>
      </div>

      {/* Weapons */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[8px] tracking-[0.3em] uppercase text-white/30 mb-1" style={cinzel}>
          Weapons
        </p>
        <div className="flex flex-col gap-1.5">
          {PLAYER_SHIP.weapons.map((w) => {
            // Graviton Lance is jammed by the active Lattice — interference.
            const jammedByLattice = latticeActive && w.id === "graviton-lance";
            return (
              <ToggleButton
                key={w.id}
                label={
                  jammedByLattice ? `${w.displayName} · Jammed` : w.displayName
                }
                active={activeWeaponId === w.id}
                enabled={enabled && !jammedByLattice}
                onClick={() => onToggleWeapon(w.id)}
                onMouseEnter={() => {
                  /* no preview-on-hover for weapons; aim mode follows cursor */
                }}
                onMouseLeave={() => {
                  /* no preview-on-hover for weapons */
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Abilities — commander-only. Hidden from non-commanders so the
         buttons only appear for the user who can actually invoke them.
         Flip and Lattice are mutex (server-enforced); when one is in use
         the other's button is disabled. */}
      {isCommander && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[8px] tracking-[0.3em] uppercase text-white/30 mb-1" style={cinzel}>
            Abilities
          </p>
          <button
            type="button"
            disabled={
              !enabled || flipState.kind === "cooldown" || latticeActive
            }
            onClick={onInvokeFlip}
            className={`px-3 py-1.5 rounded border text-[9px] tracking-[0.2em] uppercase transition-all ${
              !enabled || latticeActive
                ? "border-white/5 text-white/15 cursor-not-allowed"
                : flipState.kind === "charging"
                ? "border-purple-300/70 bg-purple-300/25 text-purple-100 hover:bg-purple-300/35 hover:border-purple-300/90 cursor-pointer"
                : flipState.kind === "cooldown"
                ? "border-white/10 text-white/30 cursor-not-allowed"
                : "border-purple-300/40 text-purple-200/80 hover:text-purple-200 hover:border-purple-300/70 hover:bg-purple-300/10 cursor-pointer"
            }`}
            style={cinzel}
          >
            {flipState.kind === "charging"
              ? "Cancel Flip"
              : flipState.kind === "cooldown"
              ? `Flip · ${flipState.turnsLeft}`
              : "Flip"}
          </button>

          {/* Graviton Lattice toggle — disabled only while Flip is actively
             charging (mutex). Flip cooldown does NOT block lattice; once the
             teleport is committed, the shield can come up. Stays on until
             commander or GM disarms it. */}
          <button
            type="button"
            disabled={!enabled || flipState.kind === "charging"}
            onClick={onToggleLattice}
            className={`px-3 py-1.5 rounded border text-[9px] tracking-[0.2em] uppercase transition-all ${
              !enabled || flipState.kind === "charging"
                ? latticeActive
                  ? "border-violet-300/70 bg-violet-300/25 text-violet-100 cursor-not-allowed"
                  : "border-white/5 text-white/15 cursor-not-allowed"
                : latticeActive
                ? "border-violet-300/70 bg-violet-300/25 text-violet-100 hover:bg-violet-300/35 hover:border-violet-300/90 cursor-pointer"
                : "border-violet-300/40 text-violet-200/80 hover:text-violet-200 hover:border-violet-300/70 hover:bg-violet-300/10 cursor-pointer"
            }`}
            style={cinzel}
          >
            {latticeActive ? "Lower Lattice" : "Raise Lattice"}
          </button>
        </div>
      )}
    </div>
  );
}
