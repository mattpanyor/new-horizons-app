"use client";

// Top-center toolbar visible only in sector-edit mode. Shows pending-change
// count, SAVE / Discard, and any save error.

import { useEditMode } from "./EditModeProvider";

export function EditToolbar() {
  const { mode, dirty, pendingCount, saving, error, save, discard } = useEditMode();
  if (mode !== "sector-edit") return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="inline-flex items-center gap-3 px-3 py-2 rounded scifi-card text-xs"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        <span className="text-amber-300/80 uppercase tracking-widest">
          Edit Mode
        </span>
        <span className="h-4 w-px bg-white/15" />
        <span className="text-slate-300">
          {dirty ? `${pendingCount} unsaved` : "no changes"}
        </span>
        <span className="h-4 w-px bg-white/15" />
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={discard}
          disabled={!dirty || saving}
          className="px-3 py-1 rounded bg-rose-500/10 text-rose-200 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Discard
        </button>
      </div>
      {error && (
        <div
          className="px-3 py-1 rounded bg-rose-900/60 border border-rose-500/40 text-rose-200 text-[11px]"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
