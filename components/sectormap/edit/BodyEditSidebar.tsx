"use client";

// Left-rail sidebar dedicated to body editing inside the system-edit session.
// Pulls bodies + selection from the same SystemEditApi as the right sidebar,
// so clicking a body on the canvas / in this list / in the right sidebar
// all keep in sync.

import { useMemo, useState } from "react";
import type { CelestialBody, CelestialBodyType, PlanetBiome } from "@/types/starsystem";
import type { Biome } from "@/lib/db/biomes";
import type { SystemEditApi } from "./useSystemEdit";
import { MoveShipDialog } from "./MoveShipDialog";
import {
  BODY_TYPES,
  LABEL_POSITIONS,
  SPECIAL_ATTRIBUTE_KEYS,
  type LabelPosition,
  type SpecialAttribute,
} from "@/lib/mapEnums";
import { ALLEGIANCES, type AllegianceKey } from "@/lib/allegiances";

interface Props {
  api: SystemEditApi;
  biomes: Biome[];
}

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

export function BodyEditSidebar({ api, biomes }: Props) {
  const base = api.baseSystem;
  const p = api.pending;

  // Hooks must run unconditionally — the early return lives below all of them
  // (mirrors SystemEditSidebar). Putting the guard above useMemo changed the
  // hook count between renders and crashed when baseSystem briefly went null.
  // Composite body list (base + creates − deletes), patched with pending changes.
  const bodies = useMemo(() => {
    const out: Array<CelestialBody & { _tempId?: string }> = [];
    if (!base) return out;
    for (const b of base.bodies) {
      if (b.dbId !== undefined && p.bodyDeletes.has(b.dbId)) continue;
      const patch = b.dbId !== undefined ? p.bodyUpdates.get(b.dbId) ?? {} : {};
      out.push({ ...b, ...patch });
    }
    for (const c of p.bodyCreates) {
      out.push({
        id: c.id ?? "new-body",
        name: c.name ?? "New Body",
        type: c.type ?? "planet",
        orbitPosition: c.orbitPosition ?? 0,
        orbitDistance: c.orbitDistance ?? 0.5,
        biome: c.biome,
        lore: c.lore,
        labelPosition: c.labelPosition,
        special_attribute: c.special_attribute,
        allegiance: c.allegiance,
        externalUrl: c.externalUrl,
        published: c.published,
        _tempId: c.tempId,
      });
    }
    return out;
  }, [base, p.bodyCreates, p.bodyUpdates, p.bodyDeletes]);

  if (!api.active || !base) return null;

  const selectedBody = (() => {
    if (api.selection?.kind !== "body") return null;
    const sel = api.selection;
    return (
      bodies.find(
        (b) =>
          (sel.bodyDbId !== undefined && b.dbId === sel.bodyDbId) ||
          (sel.bodyTempId !== undefined && b._tempId === sel.bodyTempId)
      ) ?? null
    );
  })();

  return (
    <aside
      className="absolute top-16 left-3 bottom-3 w-[320px] scifi-card rounded-lg flex flex-col z-20 overflow-hidden"
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10 shrink-0 flex items-center justify-between">
        <h3
          className="text-amber-300 text-xs uppercase tracking-widest"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Bodies ({bodies.length})
        </h3>
        <button
          onClick={() => api.createBody()}
          className="text-[10px] uppercase tracking-widest text-amber-200 border border-amber-500/40 hover:bg-amber-500/15 rounded px-2 py-0.5"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          + Add
        </button>
      </div>

      {/* Body list (fixed height, scrolls if long) */}
      <div className="shrink-0 max-h-[40%] overflow-y-auto p-2 border-b border-white/10">
        {bodies.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-2 py-3">No bodies yet. Click + Add.</p>
        ) : (
          <ul className="space-y-1">
            {bodies.map((b) => {
              const isSelected =
                selectedBody &&
                ((b.dbId !== undefined && b.dbId === selectedBody.dbId) ||
                  (b._tempId !== undefined && b._tempId === selectedBody._tempId));
              return (
                <li key={b.dbId ?? b._tempId ?? b.id}>
                  <button
                    onClick={() =>
                      api.select({
                        kind: "body",
                        bodyDbId: b.dbId,
                        bodyTempId: b._tempId,
                      })
                    }
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-amber-500/15 border border-amber-500/50"
                        : "bg-black/30 border border-white/5 hover:border-amber-500/40 hover:bg-black/40"
                    }`}
                  >
                    <span className="flex-1 text-slate-200">{b.name || "(unnamed)"}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{b.type}</span>
                    {b._tempId && (
                      <span className="text-[9px] text-emerald-300 uppercase tracking-wider">new</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Body form (fills remaining space, scrolls) */}
      <div className="flex-1 overflow-y-auto p-3">
        {selectedBody ? (
          <BodyForm
            body={selectedBody}
            biomes={biomes}
            isNew={!!selectedBody._tempId}
            onChange={(fields) =>
              api.patchBody({ dbId: selectedBody.dbId, tempId: selectedBody._tempId }, fields)
            }
            onDelete={() =>
              api.deleteBody({ dbId: selectedBody.dbId, tempId: selectedBody._tempId })
            }
          />
        ) : (
          <p className="text-xs text-slate-500 italic">
            Click a body in the list above, or on the canvas, to edit its properties.
            Drag a body around the orbit ring to change its angle (distance edits via the form).
          </p>
        )}
      </div>
    </aside>
  );
}

function BodyForm({
  body,
  biomes,
  isNew,
  onChange,
  onDelete,
}: {
  body: CelestialBody & { _tempId?: string };
  biomes: Biome[];
  isNew?: boolean;
  onChange: (f: Partial<CelestialBody>) => void;
  onDelete: () => void;
}) {
  const canMove = (body.type === "ship" || body.type === "fleet") && body.dbId !== undefined;
  const [moveOpen, setMoveOpen] = useState(false);
  return (
    <div className="space-y-2.5">
      {canMove && (
        <button
          onClick={() => setMoveOpen(true)}
          className="w-full px-3 py-1.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/40 hover:bg-amber-500/25 text-xs transition"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Move {body.type}…
        </button>
      )}
      {moveOpen && body.dbId !== undefined && (
        <MoveShipDialog source={{ bodyId: body.dbId }} onClose={() => setMoveOpen(false)} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Body ID (slug)">
          <input
            className={inputClass}
            value={body.id}
            disabled={!isNew}
            onChange={(e) => onChange({ id: e.target.value })}
          />
        </Field>
        <Field label="Name">
          <input className={inputClass} value={body.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <select
            className={inputClass}
            value={body.type}
            onChange={(e) => {
              const newType = e.target.value as CelestialBodyType;
              const supportsBiome = newType === "planet" || newType === "moon";
              // If switching to a type that can't have a biome, clear any
              // existing biome. `null` (not undefined) tells the save
              // serializer to write biome_slug = NULL in the DB.
              if (!supportsBiome && body.biome) {
                onChange({ type: newType, biome: null as unknown as PlanetBiome | undefined });
              } else {
                onChange({ type: newType });
              }
            }}
          >
            {BODY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        {(body.type === "planet" || body.type === "moon") && (
          <Field label="Biome">
            <select
              className={inputClass}
              value={body.biome ?? ""}
              onChange={(e) => onChange({ biome: (e.target.value || undefined) as PlanetBiome | undefined })}
            >
              <option value="">— none —</option>
              {biomes.map((b) => (<option key={b.slug} value={b.slug}>{b.label}</option>))}
            </select>
          </Field>
        )}
        <Field label="Allegiance">
          <select
            className={inputClass}
            value={body.allegiance ?? ""}
            onChange={(e) => onChange({ allegiance: (e.target.value || undefined) as AllegianceKey | undefined })}
          >
            <option value="">— none —</option>
            {Object.entries(ALLEGIANCES).map(([slug, def]) => (
              <option key={slug} value={slug}>{def.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Special Attribute">
          <select
            className={inputClass}
            value={body.special_attribute ?? ""}
            onChange={(e) =>
              onChange({ special_attribute: (e.target.value || undefined) as SpecialAttribute | undefined })
            }
          >
            <option value="">— none —</option>
            {SPECIAL_ATTRIBUTE_KEYS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </Field>
      </div>

      <Field label={`Orbit Position (${body.orbitPosition}°) — drag the body on canvas`}>
        <input
          type="range" min={0} max={360} value={body.orbitPosition}
          onChange={(e) => onChange({ orbitPosition: Number(e.target.value) })}
          className="w-full"
        />
      </Field>
      <Field label="Orbit Distance (0–1)">
        <input
          type="number" step={0.01} min={0} max={1} value={body.orbitDistance}
          onChange={(e) => onChange({ orbitDistance: Math.max(0, Math.min(1, Number(e.target.value))) })}
          className={inputClass}
        />
      </Field>
      <Field label="Label Position">
        <select
          className={inputClass}
          value={body.labelPosition ?? "bottom"}
          onChange={(e) => onChange({ labelPosition: e.target.value as LabelPosition })}
        >
          {LABEL_POSITIONS.map((lp) => (<option key={lp} value={lp}>{lp}</option>))}
        </select>
      </Field>
      <Field label="Lore (optional)">
        <textarea
          className={`${inputClass} h-14 resize-y`}
          value={body.lore ?? ""}
          onChange={(e) => onChange({ lore: e.target.value || undefined })}
        />
      </Field>
      <Field label="External URL">
        <input
          className={inputClass}
          value={body.externalUrl ?? ""}
          onChange={(e) => onChange({ externalUrl: e.target.value || undefined })}
        />
      </Field>
      <button
        onClick={onDelete}
        className="w-full mt-2 px-3 py-1.5 rounded bg-rose-500/10 text-rose-200 border border-rose-500/30 hover:bg-rose-500/20 text-xs transition"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        {isNew ? "Remove (unsaved)" : "Delete"}
      </button>
    </div>
  );
}
