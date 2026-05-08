"use client";

import type { CombatFace, CombatRangeBand } from "@/types/game";
import { composeStatusLines, type ActiveWeapon } from "@/lib/combat/statusText";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface StatusOverlayProps {
  face: CombatFace | null;
  range: CombatRangeBand | null;
  weapon: ActiveWeapon | null;
}

// Top-of-screen status text that slowly pulses opacity. Local-only (driven
// by this user's own toggles) — never reflects other players' state. The
// pulse runs as a CSS keyframe (`.combat-status-pulse` in globals.css) so it
// doesn't drive React re-renders at 60 fps.
export default function StatusOverlay({ face, range, weapon }: StatusOverlayProps) {
  const lines = composeStatusLines(face, range, weapon);
  if (lines.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 pointer-events-none text-center combat-status-pulse">
      {lines.map((line, i) => (
        <p
          key={i}
          className="text-sm tracking-[0.35em] uppercase text-white/85"
          style={cinzel}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
