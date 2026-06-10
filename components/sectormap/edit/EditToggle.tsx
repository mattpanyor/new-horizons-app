"use client";

// View / Edit segmented control. Only rendered when the current user is a
// superadmin (accessLevel >= 127). Gated check happens in the provider.

import { useEditMode } from "./EditModeProvider";

export function EditToggle() {
  const { canEdit, mode, setMode } = useEditMode();
  if (!canEdit) return null;

  return (
    <div
      className="inline-flex items-center rounded scifi-card text-xs select-none"
      style={{ fontFamily: "var(--font-cinzel), serif" }}
    >
      <button
        onClick={() => setMode("view")}
        className={`px-3 py-1.5 rounded-l transition-colors ${
          mode === "view"
            ? "bg-indigo-500/30 text-white"
            : "text-slate-400 hover:text-white"
        }`}
      >
        View
      </button>
      <button
        onClick={() => setMode("sector-edit")}
        className={`px-3 py-1.5 rounded-r transition-colors ${
          mode === "sector-edit"
            ? "bg-amber-500/30 text-amber-100"
            : "text-slate-400 hover:text-white"
        }`}
      >
        Edit
      </button>
    </div>
  );
}
