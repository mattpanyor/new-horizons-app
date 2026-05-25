"use client";

// Form for the currently selected entity. Switches on entity kind. All
// changes route through useEditMode().updateField() and stage locally until
// SAVE is hit.

import { useState } from "react";
import { useEditMode, resolveSelected } from "./EditModeProvider";
import type {
  SystemPin,
  VortexPin,
  MapMarker,
  ConnectionLine,
  LayerSlug,
  MarkerType,
} from "@/types/sector";
import { ALLEGIANCES, type AllegianceKey } from "@/lib/allegiances";
import { MARKER_TYPES, LAYERS } from "@/lib/mapEnums";
import { MoveShipDialog } from "./MoveShipDialog";

const labelClass = "text-[11px] text-slate-400 tracking-wider uppercase mb-1";
const inputClass =
  "w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-amber-500/50 focus:outline-none";

export function SelectionPanel() {
  const state = useEditMode();
  const resolved = resolveSelected(state);

  if (!resolved) {
    return (
      <p className="text-xs text-slate-500 italic">
        Click an entity on the map to edit. Right-click empty canvas to create.
      </p>
    );
  }

  const onChange = (fields: Record<string, unknown>) => {
    state.updateField(resolved.kind, resolved.ref, fields);
  };

  const onDelete = () => {
    if (!confirm("Delete this entity? Connections referencing it become orphans.")) return;
    state.deleteEntity(resolved.kind, resolved.ref);
  };

  switch (resolved.kind) {
    case "system":     return <SystemForm data={resolved.data as SystemPin} onChange={onChange} onDelete={onDelete} />;
    case "vortex":     return <VortexForm data={resolved.data as VortexPin} onChange={onChange} onDelete={onDelete} />;
    case "marker":     return <MarkerForm data={resolved.data as MapMarker} onChange={onChange} onDelete={onDelete} />;
    case "connection": return <ConnectionForm data={resolved.data as ConnectionLine} onChange={onChange} onDelete={onDelete} />;
  }
}

interface FormProps<T> {
  data: T;
  onChange: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
}

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

function AllegianceSelect({
  value,
  onChange,
}: {
  value: AllegianceKey | undefined;
  onChange: (v: AllegianceKey | null) => void;
}) {
  return (
    <select
      className={inputClass}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as AllegianceKey | null)}
    >
      <option value="">— none —</option>
      {Object.entries(ALLEGIANCES).map(([slug, def]) => (
        <option key={slug} value={slug}>{def.name}</option>
      ))}
    </select>
  );
}

function LayerSelect({
  value,
  onChange,
}: {
  value: LayerSlug | undefined;
  onChange: (v: LayerSlug | null) => void;
}) {
  return (
    <select
      className={inputClass}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as LayerSlug | null)}
    >
      <option value="">— none —</option>
      {LAYERS.map((l) => (
        <option key={l} value={l}>{l}</option>
      ))}
    </select>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      onClick={onDelete}
      className="mt-3 w-full px-3 py-1.5 rounded bg-rose-500/10 text-rose-200 border border-rose-500/30 hover:bg-rose-500/20 text-xs transition"
      style={{ fontFamily: "var(--font-cinzel), serif" }}
    >
      Delete
    </button>
  );
}

// ── SYSTEM ──
function SystemForm({ data, onChange, onDelete }: FormProps<SystemPin>) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-amber-300 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-cinzel), serif" }}>
        System
      </h3>
      <Field label="Slug">
        <input className={inputClass} value={data.slug} onChange={(e) => onChange({ slug: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <input type="number" className={inputClass} value={data.x} onChange={(e) => onChange({ x: Number(e.target.value) })} />
        </Field>
        <Field label="Y">
          <input type="number" className={inputClass} value={data.y} onChange={(e) => onChange({ y: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Allegiance">
        <AllegianceSelect value={data.allegiance} onChange={(v) => onChange({ allegiance: v })} />
      </Field>
      <Field label="Territory Radius (optional)">
        <input
          type="number"
          className={inputClass}
          value={data.territoryRadius ?? ""}
          placeholder="120"
          onChange={(e) => onChange({ territoryRadius: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </Field>
      <DeleteButton onDelete={onDelete} />
    </div>
  );
}

// ── VORTEX ──
function VortexForm({ data, onChange, onDelete }: FormProps<VortexPin>) {
  const [rw, rh] = data.ratio ?? [1, 1];
  return (
    <div className="space-y-2.5">
      <h3 className="text-amber-300 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-cinzel), serif" }}>
        Vortex
      </h3>
      <Field label="Slug">
        <input className={inputClass} value={data.slug} onChange={(e) => onChange({ slug: e.target.value })} />
      </Field>
      <Field label="Name">
        <input className={inputClass} value={data.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <input type="number" className={inputClass} value={data.x} onChange={(e) => onChange({ x: Number(e.target.value) })} />
        </Field>
        <Field label="Y">
          <input type="number" className={inputClass} value={data.y} onChange={(e) => onChange({ y: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Color (hex)">
        <input className={inputClass} placeholder="#FFFFFF" value={data.color ?? ""} onChange={(e) => onChange({ color: e.target.value || null })} />
      </Field>
      <Field label="Radius">
        <input
          type="number"
          className={inputClass}
          value={data.radius ?? ""}
          placeholder="80"
          onChange={(e) => onChange({ radius: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ratio W">
          <input type="number" className={inputClass} value={rw}
            onChange={(e) => onChange({ ratio: [Number(e.target.value), rh] })} />
        </Field>
        <Field label="Ratio H">
          <input type="number" className={inputClass} value={rh}
            onChange={(e) => onChange({ ratio: [rw, Number(e.target.value)] })} />
        </Field>
      </div>
      <Field label="Layer">
        <LayerSelect value={data.layer} onChange={(v) => onChange({ layer: v })} />
      </Field>
      <DeleteButton onDelete={onDelete} />
    </div>
  );
}

// ── MARKER ──
function MarkerForm({ data, onChange, onDelete }: FormProps<MapMarker>) {
  const isAttached = data.position !== undefined && data.x === undefined;
  const canMove = (data.type === "ship" || data.type === "fleet") && data.id !== undefined;
  const [moveOpen, setMoveOpen] = useState(false);
  return (
    <div className="space-y-2.5">
      <h3 className="text-amber-300 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-cinzel), serif" }}>
        Marker {isAttached && <span className="text-slate-500 normal-case ml-1 tracking-normal">(on connection)</span>}
      </h3>
      {canMove && (
        <button
          onClick={() => setMoveOpen(true)}
          className="w-full px-3 py-1.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/40 hover:bg-amber-500/25 text-xs transition"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Move {data.type}…
        </button>
      )}
      {moveOpen && data.id !== undefined && (
        <MoveShipDialog source={{ markerId: data.id }} onClose={() => setMoveOpen(false)} />
      )}
      <Field label="Slug">
        <input className={inputClass} value={data.slug ?? ""} onChange={(e) => onChange({ slug: e.target.value })} />
      </Field>
      <Field label="Name">
        <input className={inputClass} value={data.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Type">
        <select className={inputClass} value={data.type} onChange={(e) => onChange({ type: e.target.value as MarkerType })}>
          {MARKER_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Allegiance">
        <AllegianceSelect value={data.allegiance} onChange={(v) => onChange({ allegiance: v })} />
      </Field>
      {!isAttached && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="X">
            <input type="number" className={inputClass} value={data.x ?? 0} onChange={(e) => onChange({ x: Number(e.target.value) })} />
          </Field>
          <Field label="Y">
            <input type="number" className={inputClass} value={data.y ?? 0} onChange={(e) => onChange({ y: Number(e.target.value) })} />
          </Field>
        </div>
      )}
      {isAttached && (
        <Field label="Position (0–1 along curve)">
          <input
            type="number" step="0.05" min="0" max="1"
            className={inputClass}
            value={data.position ?? 0.5}
            onChange={(e) => onChange({ position: Number(e.target.value) })}
          />
        </Field>
      )}
      <Field label="Territory Radius (optional)">
        <input
          type="number"
          className={inputClass}
          value={data.territoryRadius ?? ""}
          onChange={(e) => onChange({ territoryRadius: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </Field>
      <Field label="Layer">
        <LayerSelect value={data.layer} onChange={(v) => onChange({ layer: v })} />
      </Field>
      <Field label="External URL (optional)">
        <input className={inputClass} value={data.externalUrl ?? ""} onChange={(e) => onChange({ externalUrl: e.target.value || null })} />
      </Field>
      <DeleteButton onDelete={onDelete} />
    </div>
  );
}

// ── CONNECTION ──
function ConnectionForm({ data, onChange, onDelete }: FormProps<ConnectionLine>) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-amber-300 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-cinzel), serif" }}>
        Connection
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="From">
          <input className={inputClass} value={data.from} onChange={(e) => onChange({ from: e.target.value })} />
        </Field>
        <Field label="To">
          <input className={inputClass} value={data.to} onChange={(e) => onChange({ to: e.target.value })} />
        </Field>
      </div>
      <Field label="Label">
        <input className={inputClass} value={data.label ?? ""} onChange={(e) => onChange({ label: e.target.value || null })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Curvature">
          <input type="number" className={inputClass} value={data.curvature ?? 0} onChange={(e) => onChange({ curvature: Number(e.target.value) })} />
        </Field>
        <Field label="Opacity (0–1)">
          <input type="number" step="0.05" min="0" max="1" className={inputClass} value={data.opacity ?? ""} placeholder="0.35"
            onChange={(e) => onChange({ opacity: e.target.value === "" ? null : Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Color (hex)">
        <input className={inputClass} value={data.color ?? ""} onChange={(e) => onChange({ color: e.target.value || null })} />
      </Field>
      <Field label="Stroke dasharray">
        <input className={inputClass} value={data.dashes ?? ""} placeholder="4 6" onChange={(e) => onChange({ dashes: e.target.value || null })} />
      </Field>
      <Field label="Layer">
        <LayerSelect value={data.layer} onChange={(v) => onChange({ layer: v })} />
      </Field>
      <DeleteButton onDelete={onDelete} />
    </div>
  );
}
