"use client";

// Modal triggered from the right-click context menu. Captures the click
// coords in SVG space and pre-fills them for the new entity.

import { useState } from "react";
import { useEditMode } from "./EditModeProvider";
import type { EntityKind } from "./types";
import { MARKER_TYPES } from "@/lib/mapEnums";

interface Props {
  kind: "system" | "vortex" | "marker";
  x: number;
  y: number;
  onClose: () => void;
}

const inputClass =
  "w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none";

export function CreateEntityModal({ kind, x, y, onClose }: Props) {
  const { createEntity } = useEditMode();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("ship");

  const submit = () => {
    if (!slug.trim()) return;
    const slugified = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const displayName = name.trim() || slugified;
    const entityKind: EntityKind = kind;

    let fields: Record<string, unknown>;
    if (kind === "system") {
      fields = { slug: slugified, name: displayName, x, y, centerKind: "single" };
    } else if (kind === "vortex") {
      fields = { slug: slugified, name: displayName, x, y };
    } else {
      // free marker
      fields = { slug: slugified, name: displayName, type, x, y };
    }
    createEntity(entityKind, fields);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-950 border border-amber-500/30 rounded-lg p-5 w-[380px] max-w-[90vw] space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-amber-300 text-sm uppercase tracking-widest"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Create {kind} at ({Math.round(x)}, {Math.round(y)})
        </h3>
        <div>
          <label className="text-[11px] text-slate-400 tracking-wider uppercase block mb-1" style={{ fontFamily: "var(--font-cinzel), serif" }}>
            Slug
          </label>
          <input
            autoFocus
            className={inputClass}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. callisto"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 tracking-wider uppercase block mb-1" style={{ fontFamily: "var(--font-cinzel), serif" }}>
            Name
          </label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Defaults to slug"
          />
        </div>
        {kind === "marker" && (
          <div>
            <label className="text-[11px] text-slate-400 tracking-wider uppercase block mb-1" style={{ fontFamily: "var(--font-cinzel), serif" }}>
              Type
            </label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              {MARKER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white border border-white/10 hover:border-white/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!slug.trim()}
            className="px-3 py-1.5 rounded text-xs bg-amber-500/30 text-amber-100 border border-amber-500/50 hover:bg-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
