"use client";

import { useState } from "react";
import PlanetBackground from "@/components/PlanetBackground";
import type { PlanetPresetName } from "@/lib/planetPresets";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface Props {
  initial: PlanetPresetName;
  options: { value: PlanetPresetName; label: string }[];
  updatedAt: string | null;
  updatedBy: string | null;
  /** Set when a local HOME_SCREEN_ART env var is winning over the stored value. */
  overriddenBy: PlanetPresetName | null;
}

function formatDate(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppearancePanel({
  initial,
  options,
  updatedAt,
  updatedBy,
  overriddenBy,
}: Props) {
  const [value, setValue] = useState<PlanetPresetName>(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stamp, setStamp] = useState({ at: updatedAt, by: updatedBy });

  const dirty = value !== saved;

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeScreenArt: value }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not save.");
      return;
    }
    const data = await res.json();
    setSaved(value);
    setStamp({
      at: data?.homeScreenArt?.row?.updatedAt ?? new Date().toISOString(),
      by: data?.homeScreenArt?.row?.updatedBy ?? null,
    });
  }

  return (
    <section className="scifi-card p-6 flex flex-col gap-5 max-w-xl">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm tracking-[0.3em] uppercase text-white/70" style={cinzel}>
          Home Screen Art
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The planet behind the login screen and the galactic map. Changes apply
          to everyone on their next page load.
        </p>
      </div>

      {overriddenBy && (
        <div className="border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90 leading-relaxed">
          A local <code className="text-amber-100">HOME_SCREEN_ART</code> environment
          variable is forcing <strong>{overriddenBy}</strong> on this machine, so
          what you see here is not what this page is rendering. Everyone else
          still gets the saved value below. Development only — it is ignored in
          production.
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.25em] uppercase text-white/40" style={cinzel}>
          Theme
        </span>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value as PlanetPresetName)}
          className="bg-slate-900/80 border border-indigo-500/30 focus:border-indigo-400/70 outline-none px-3 py-2 text-sm text-white/85"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* The real thing, not a thumbnail — same shader, same preset, so what is
          on screen here is what the login page will render. It re-bakes on each
          change, which is why it fades in rather than appearing instantly. */}
      <div className="relative w-full aspect-video border border-indigo-500/25 overflow-hidden bg-slate-950">
        <PlanetBackground preset={value} inline />
        <span
          className="absolute bottom-2 right-3 text-[10px] tracking-[0.25em] uppercase text-white/35 pointer-events-none"
          style={cinzel}
        >
          Preview
        </span>
      </div>
      <p className="text-[11px] text-slate-500 -mt-2">
        Desktop only. Phones and anyone who asks for reduced motion get the plain
        star field, whichever theme is chosen here.
      </p>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-4 py-2 text-xs tracking-[0.2em] uppercase border border-indigo-400/50 text-indigo-200/90 hover:bg-indigo-500/15 hover:border-indigo-400/80 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          style={cinzel}
        >
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
        <span className="text-[11px] text-slate-500">
          Last changed {formatDate(stamp.at)}
          {stamp.by ? ` by ${stamp.by}` : ""}
        </span>
      </div>
    </section>
  );
}
