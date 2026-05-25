"use client";

// System-edit right-rail sidebar. Replaces the old self-contained
// SystemEditModal. Reads/mutates state via useSystemEdit (passed in as
// `api`). Renders a single scrollable column with sections for system
// metadata, center configuration, stars, and bodies. The body list lets
// the GM click a body to focus the editor (also reflected back into the
// canvas selection).

import { useMemo, useState } from "react";
import type { SystemEditApi, StarFields } from "./useSystemEdit";
import { CENTER_KINDS, type CenterKind } from "@/lib/mapEnums";
import { useEditMode } from "./EditModeProvider";
import { MoveShipDialog, type MoveShipSource } from "./MoveShipDialog";

interface Props {
  api: SystemEditApi;
}

// How close (in canvas units) a free marker must be to a system's center to
// be considered "docked at" that system for the system-edit sidebar list.
// Generous on purpose: catches markers placed exactly at system coords AND
// any small offset (e.g. visual separation from the system pin).
const DOCKED_RADIUS_SQ = 60 * 60;

const inputClass =
  "w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-amber-500/50 focus:outline-none";
const labelClass = "text-[10px] text-slate-400 tracking-wider uppercase block mb-0.5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass} style={{ fontFamily: "var(--font-cinzel), serif" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/10">
        <h4
          className="text-amber-200/80 text-[11px] uppercase tracking-widest"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}

export function SystemEditSidebar({ api }: Props) {
  // Hooks must run unconditionally — read sector + dialog state at the top.
  const { effectiveSector } = useEditMode();
  const [moveSource, setMoveSource] = useState<MoveShipSource | null>(null);

  // Find ship/fleet entities relevant to this system. Three sources:
  //   1. Celestial bodies (system_id = this system) of type ship/fleet —
  //      the actual "ship is in the system" representation.
  //   2. Free markers (sector.markers) whose x/y is near the system pin
  //      (legacy / fallback for parked markers).
  //   3. Connection-attached markers (connection.marker) whose connection
  //      has this system as an endpoint — ships in transit to/from here.
  type Row =
    | { source: { bodyId: number }; name: string; type: string; status: "in-system" }
    | { source: { markerId: number }; name: string; type: string; status: "docked" }
    | { source: { markerId: number }; name: string; type: string; status: "in-transit"; route: string };

  const dockedShips = useMemo<Row[]>(() => {
    if (!api.baseSystem) return [];
    const slug = api.baseSystem.slug;
    const pin = effectiveSector.systems.find((s) => s.slug === slug);
    if (!pin) return [];

    const rows: Row[] = [];

    // (1) Body ships/fleets in this system
    for (const b of api.baseSystem.bodies) {
      if (b.type !== "ship" && b.type !== "fleet") continue;
      if (b.dbId === undefined) continue; // can't move JSON-loaded body
      rows.push({
        source: { bodyId: b.dbId },
        name: b.name,
        type: b.type,
        status: "in-system",
      });
    }

    // (2) Free markers near the system (legacy parked markers)
    for (const m of effectiveSector.markers ?? []) {
      if (m.type !== "ship" && m.type !== "fleet") continue;
      if (m.x === undefined || m.y === undefined || m.id === undefined) continue;
      const dx = m.x - pin.x;
      const dy = m.y - pin.y;
      if (dx * dx + dy * dy >= DOCKED_RADIUS_SQ) continue;
      rows.push({
        source: { markerId: m.id },
        name: m.name,
        type: m.type,
        status: "docked",
      });
    }

    // (3) Attached markers on connections touching this system
    for (const c of effectiveSector.connections ?? []) {
      const mk = c.marker;
      if (!mk || mk.id === undefined) continue;
      if (mk.type !== "ship" && mk.type !== "fleet") continue;
      if (c.from !== slug && c.to !== slug) continue;
      rows.push({
        source: { markerId: mk.id },
        name: mk.name,
        type: mk.type,
        status: "in-transit",
        route: `${c.from} → ${c.to}`,
      });
    }

    return rows;
  }, [effectiveSector, api.baseSystem]);

  if (!api.active || !api.baseSystem) return null;
  const base = api.baseSystem;
  const p = api.pending;

  // Merged values (base + pending) for the form
  const sysName = p.system.name ?? base.name;
  const sysExternalUrl = p.system.externalUrl ?? base.externalUrl ?? "";
  const sysPublished = p.system.published ?? (base.published !== false);
  // The dropdown's authoritative source is base.centerKind (refreshed after
  // each save via syncBase). Falls through to the original "initial" derivation
  // only when base.centerKind is somehow missing (legacy JSON systems).
  const centerKind = (p.system.centerKind ?? base.centerKind ?? api.initialCenterKind ?? "single") as CenterKind;
  const binaryAngle = p.system.binaryAngle ?? base.binaryAngle ?? 0;

  // Merged star fields
  const baseToFields = (s: typeof base.star | undefined, defaults: { color: string; secondaryColor: string }): StarFields => ({
    name: s?.name ?? "",
    fantasyLabel: s?.type ?? "",
    color: s?.color ?? defaults.color,
    secondaryColor: s?.secondaryColor ?? defaults.secondaryColor,
    externalUrl: s?.externalUrl ?? "",
  });
  const primary: StarFields = {
    ...baseToFields(base.star, { color: "#FFE87A", secondaryColor: "#7C5F00" }),
    ...p.primary,
  };
  let secondary: StarFields | null = null;
  if (centerKind === "binary") {
    if (p.secondary === null) {
      secondary = null;
    } else if (p.secondary !== undefined) {
      secondary = { ...baseToFields(base.secondaryStar, { color: "#FFE87A", secondaryColor: "#7C5F00" }), ...p.secondary };
    } else {
      secondary = baseToFields(base.secondaryStar, { color: "#FFE87A", secondaryColor: "#7C5F00" });
    }
  }

  return (
    <aside
      className="absolute top-3 right-3 bottom-3 w-[340px] scifi-card rounded-lg flex flex-col z-20 overflow-hidden"
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
        <h3
          className="text-amber-300 text-xs uppercase tracking-widest"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Edit System — {base.slug}
        </h3>
        <button onClick={() => api.exit()} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-white/10 shrink-0 flex items-center gap-2">
        <span className="text-xs text-slate-300 flex-1">
          {api.dirty ? `unsaved changes` : "no changes"}
        </span>
        <button
          onClick={api.discard}
          disabled={!api.dirty || api.saving}
          className="px-2 py-1 rounded bg-rose-500/10 text-rose-200 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] transition"
        >
          Discard
        </button>
        <button
          onClick={api.save}
          disabled={!api.dirty || api.saving}
          className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] transition"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          {api.saving ? "Saving…" : "Save"}
        </button>
      </div>

      {api.error && (
        <div className="px-3 py-1.5 bg-rose-900/50 border-b border-rose-500/30 text-rose-200 text-[11px] shrink-0">
          {api.error}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* SYSTEM */}
        <Section title="System">
          <div className="space-y-2">
            <Field label="Name">
              <input className={inputClass} value={sysName} onChange={(e) => api.patchSystem({ name: e.target.value })} />
            </Field>
            <Field label="External URL">
              <input className={inputClass} value={sysExternalUrl} placeholder="optional"
                onChange={(e) => api.patchSystem({ externalUrl: e.target.value || null })} />
            </Field>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={sysPublished} onChange={(e) => api.patchSystem({ published: e.target.checked })} />
              <span className="text-xs text-slate-300">Published</span>
            </div>
          </div>
        </Section>

        {/* CENTER */}
        <Section title="Center">
          <div className="space-y-2">
            <Field label="Kind">
              <select className={inputClass} value={centerKind} onChange={(e) => api.setCenterKind(e.target.value as CenterKind)}>
                {CENTER_KINDS.map((k) => (<option key={k} value={k}>{k}</option>))}
              </select>
            </Field>
            {centerKind === "binary" && (
              <Field label={`Binary Angle (${binaryAngle}°)`}>
                <input type="range" min={0} max={360} value={binaryAngle}
                  onChange={(e) => api.patchSystem({ binaryAngle: Number(e.target.value) })} className="w-full" />
              </Field>
            )}
          </div>
        </Section>

        {/* PRIMARY STAR */}
        <Section title="Primary Star">
          <StarForm value={primary} onChange={api.patchPrimary} />
        </Section>

        {/* SECONDARY STAR */}
        {secondary !== null && (
          <Section title="Secondary Star">
            <StarForm value={secondary} onChange={(f) => api.patchSecondary(f)} />
          </Section>
        )}

        {/* SHIPS & FLEETS — both docked at this system AND in transit on
            connections that touch it. Each row has its own Move action. */}
        <Section title={`Ships & Fleets (${dockedShips.length})`}>
          {dockedShips.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">
              No ships or fleets at this system or on its connections.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {dockedShips.map((row, i) => {
                const badge =
                  row.status === "in-system"
                    ? { label: "in system", cls: "bg-amber-900/30 text-amber-200 border-amber-500/40" }
                    : row.status === "docked"
                    ? { label: "docked", cls: "bg-emerald-900/30 text-emerald-300 border-emerald-500/40" }
                    : { label: "transit", cls: "bg-sky-900/30 text-sky-300 border-sky-500/40" };
                return (
                  <li
                    key={i}
                    className="flex items-center gap-1.5 bg-black/30 border border-white/5 rounded px-2 py-1.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 truncate">{row.name}</div>
                      {row.status === "in-transit" && (
                        <div className="text-[10px] text-slate-500 truncate">
                          in transit: {row.route}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {row.type}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider border ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <button
                      onClick={() => setMoveSource(row.source)}
                      className="text-[10px] uppercase tracking-widest text-amber-200 border border-amber-500/40 hover:bg-amber-500/15 rounded px-2 py-0.5"
                      style={{ fontFamily: "var(--font-cinzel), serif" }}
                    >
                      Move
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Bodies live in the left-rail BodyEditSidebar */}
        <p className="text-[10px] text-slate-500 italic pt-2">
          Bodies: see the left panel. Click a body on the canvas, drag along its orbit ring to set angle.
        </p>
      </div>

      {moveSource && (
        <MoveShipDialog source={moveSource} onClose={() => setMoveSource(null)} />
      )}
    </aside>
  );
}

function StarForm({ value, onChange }: { value: StarFields; onChange: (f: Partial<StarFields>) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Name">
        <input className={inputClass} value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Fantasy Label (cosmetic only)">
        <input className={inputClass} value={value.fantasyLabel} placeholder="e.g. Red Supergiant"
          onChange={(e) => onChange({ fantasyLabel: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Color">
          <div className="flex gap-1">
            <input type="color" value={value.color} onChange={(e) => onChange({ color: e.target.value })}
              className="w-9 h-8 rounded bg-black/40 border border-white/10" />
            <input className={inputClass} value={value.color} onChange={(e) => onChange({ color: e.target.value })} />
          </div>
        </Field>
        <Field label="Secondary Color">
          <div className="flex gap-1">
            <input type="color" value={value.secondaryColor || "#000000"} onChange={(e) => onChange({ secondaryColor: e.target.value })}
              className="w-9 h-8 rounded bg-black/40 border border-white/10" />
            <input className={inputClass} value={value.secondaryColor} placeholder="optional"
              onChange={(e) => onChange({ secondaryColor: e.target.value })} />
          </div>
        </Field>
      </div>
      <Field label="External URL">
        <input className={inputClass} value={value.externalUrl} placeholder="optional"
          onChange={(e) => onChange({ externalUrl: e.target.value })} />
      </Field>
    </div>
  );
}

