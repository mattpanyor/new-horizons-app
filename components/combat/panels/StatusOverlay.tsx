"use client";

import { useEffect, useState } from "react";
import type { CombatFace, CombatRangeBand } from "@/types/game";
import { composeStatusLines, type ActiveWeapon } from "@/lib/combat/statusText";
import { VISUAL } from "@/lib/combat/visual";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface StatusOverlayProps {
  face: CombatFace | null;
  range: CombatRangeBand | null;
  weapon: ActiveWeapon | null;
}

// Top-of-screen status text that slowly pulses opacity. Local-only (driven by
// this user's own toggles) — never reflects other players' state.
export default function StatusOverlay({ face, range, weapon }: StatusOverlayProps) {
  const lines = composeStatusLines(face, range, weapon);
  const [pulse, setPulse] = useState<number>(VISUAL.blinkOpacityMax);

  useEffect(() => {
    if (lines.length === 0) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / VISUAL.blinkPeriodMs;
      // Sine pulse: blinkOpacityMin..blinkOpacityMax over blinkPeriodMs.
      const k = (Math.sin(t * Math.PI * 2) + 1) / 2;
      const opacity =
        VISUAL.blinkOpacityMin +
        (VISUAL.blinkOpacityMax - VISUAL.blinkOpacityMin) * k;
      setPulse(opacity);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 pointer-events-none text-center"
      style={{ opacity: pulse, transition: "opacity 60ms linear" }}
    >
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
