"use client";

import { useState } from "react";
import ClueEditor from "./ClueEditor";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface AddTileProps {
  disabled?: boolean;
  onAdd: (text: string, factionSlugs: string[]) => Promise<void>;
}

export default function AddTile({ disabled, onAdd }: AddTileProps) {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <ClueEditor
        initialText=""
        initialFactionSlugs={[]}
        onSave={async (text, factionSlugs) => {
          await onAdd(text, factionSlugs);
          setActive(false);
        }}
        onCancel={() => setActive(false)}
        emptyMeansCancel
        autoFocusText
      />
    );
  }

  return (
    <button
      onClick={() => !disabled && setActive(true)}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded border border-dashed border-indigo-400/25 text-indigo-400/50 hover:text-indigo-400/85 hover:border-indigo-400/55 hover:bg-indigo-400/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ minHeight: "108px", backdropFilter: "blur(8px)" }}
      title={disabled ? "No active chapter" : "Record a new clue"}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span className="text-[8px] tracking-[0.25em] uppercase" style={cinzel}>
        Record Clue
      </span>
    </button>
  );
}
