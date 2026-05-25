"use client";

// System-edit state hook. Owned by SectorMap so the canvas can read pending
// body positions (for the live-drag override) and the sidebar can read
// pending field values for forms. Replaces the old self-contained
// SystemEditModal.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { StarSystemMetadata, CelestialBody } from "@/types/starsystem";
import type { CenterKind } from "@/lib/mapEnums";
import { CENTER_KIND_DEFAULT_COLOR, CENTER_KIND_DEFAULT_SECONDARY } from "@/lib/mapEnums";

export interface StarFields {
  name: string;
  fantasyLabel: string;
  color: string;
  secondaryColor: string;
  externalUrl: string;
}

export type SystemSelection =
  | { kind: "system" }
  | { kind: "primary" }
  | { kind: "secondary" }
  | { kind: "body"; bodyDbId?: number; bodyTempId?: string }
  | null;

type PendingBody = Partial<CelestialBody> & { tempId: string };

interface SystemPending {
  system: Partial<{
    name: string;
    externalUrl: string | null;
    published: boolean;
    centerKind: CenterKind;
    binaryAngle: number | null;
  }>;
  primary: Partial<StarFields>;
  // undefined = no change; null = delete; object = upsert
  secondary: Partial<StarFields> | null | undefined;
  bodyUpdates: Map<number, Partial<CelestialBody>>;
  bodyCreates: PendingBody[];
  bodyDeletes: Set<number>;
}

function emptyPending(): SystemPending {
  return {
    system: {},
    primary: {},
    secondary: undefined,
    bodyUpdates: new Map(),
    bodyCreates: [],
    bodyDeletes: new Set(),
  };
}

function deriveCenterKind(s: StarSystemMetadata): CenterKind {
  // Prefer the explicit DB-loaded value when present. The substring fallback
  // is only for JSON-loaded systems that pre-date the centerKind column
  // (Imperial Core, atlas-sector-legacy).
  if (s.centerKind) return s.centerKind;
  if (s.secondaryStar) return "binary";
  const t = (s.star.type ?? "").toLowerCase();
  if (t.includes("pulsar")) return "pulsar";
  if (t.includes("neutron")) return "neutron";
  if (t.includes("black hole") || t.includes("blackhole")) return "black-hole";
  return "single";
}

export interface SystemEditApi {
  active: boolean;
  sectorSlug: string | null;
  systemSlug: string | null;
  baseSystem: StarSystemMetadata | null;
  pending: SystemPending;
  selection: SystemSelection;
  saving: boolean;
  error: string | null;
  dirty: boolean;
  initialCenterKind: CenterKind | null;

  // Lifecycle
  enter: (sectorSlug: string, system: StarSystemMetadata) => void;
  exit: (force?: boolean) => boolean; // returns true if exited; false if user cancelled
  // Re-syncs the captured baseSystem with a fresh copy (e.g., after a save +
  // router.refresh() returns new data). Safe to call repeatedly; only takes
  // effect if the incoming snapshot is a different reference and there's
  // nothing in pending that could be clobbered.
  syncBase: (system: StarSystemMetadata) => void;

  // Selection
  select: (s: SystemSelection) => void;

  // Field mutators
  patchSystem: (fields: SystemPending["system"]) => void;
  patchPrimary: (fields: Partial<StarFields>) => void;
  patchSecondary: (fields: Partial<StarFields> | null) => void; // null = mark for delete
  setCenterKind: (k: CenterKind) => void;

  // Body mutators
  patchBody: (ref: { dbId?: number; tempId?: string }, fields: Partial<CelestialBody>) => void;
  createBody: () => string; // returns tempId
  deleteBody: (ref: { dbId?: number; tempId?: string }) => void;

  // Save
  save: () => Promise<void>;
  discard: () => void;
}

function valueOrEmpty<T>(v: T | undefined): T | object {
  return v === undefined ? {} : v;
}

export function useSystemEdit(): SystemEditApi {
  const router = useRouter();
  const [sectorSlug, setSectorSlug] = useState<string | null>(null);
  const [systemSlug, setSystemSlug] = useState<string | null>(null);
  const [baseSystem, setBaseSystem] = useState<StarSystemMetadata | null>(null);
  const [initialCenterKind, setInitialCenterKind] = useState<CenterKind | null>(null);
  const [pending, setPending] = useState<SystemPending>(() => emptyPending());
  const [selection, setSelection] = useState<SystemSelection>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    Object.keys(pending.system).length > 0 ||
    Object.keys(pending.primary).length > 0 ||
    pending.secondary !== undefined ||
    pending.bodyUpdates.size > 0 ||
    pending.bodyCreates.length > 0 ||
    pending.bodyDeletes.size > 0;

  const enter = useCallback((sec: string, sys: StarSystemMetadata) => {
    setSectorSlug(sec);
    setSystemSlug(sys.slug);
    setBaseSystem(sys);
    setInitialCenterKind(deriveCenterKind(sys));
    setPending(emptyPending());
    setSelection({ kind: "system" });
    setError(null);
  }, []);

  const exit = useCallback((force = false): boolean => {
    if (!force && dirty && !confirm("Discard unsaved system changes?")) return false;
    setSectorSlug(null);
    setSystemSlug(null);
    setBaseSystem(null);
    setInitialCenterKind(null);
    setPending(emptyPending());
    setSelection(null);
    setError(null);
    return true;
  }, [dirty]);

  const syncBase = useCallback((sys: StarSystemMetadata) => {
    setBaseSystem(sys);
    setInitialCenterKind(deriveCenterKind(sys));
    // Leave pending untouched; this can be called mid-session when the page
    // re-renders with fresh DB data (e.g. immediately after save).
  }, []);

  const patchSystem = useCallback((fields: SystemPending["system"]) => {
    setPending((p) => ({ ...p, system: { ...p.system, ...fields } }));
  }, []);

  const patchPrimary = useCallback((fields: Partial<StarFields>) => {
    setPending((p) => ({ ...p, primary: { ...p.primary, ...fields } }));
  }, []);

  const patchSecondary = useCallback((fields: Partial<StarFields> | null) => {
    setPending((p) => ({
      ...p,
      secondary: fields === null ? null : { ...(p.secondary ?? {}), ...fields },
    }));
  }, []);

  // Setting center_kind drives the secondary star creation/deletion.
  const setCenterKind = useCallback((k: CenterKind) => {
    setPending((p) => {
      const next: SystemPending = { ...p, system: { ...p.system, centerKind: k } };
      if (k === "binary") {
        // Create defaults for a secondary if not already specified
        if (p.secondary === null || p.secondary === undefined) {
          next.secondary = {
            name: "",
            fantasyLabel: "",
            color: CENTER_KIND_DEFAULT_COLOR.binary,
            secondaryColor: CENTER_KIND_DEFAULT_SECONDARY.binary ?? "",
            externalUrl: "",
          };
        }
        next.system = { ...next.system, binaryAngle: p.system.binaryAngle ?? 0 };
      } else {
        next.secondary = null;
        next.system = { ...next.system, binaryAngle: null };
      }
      return next;
    });
  }, []);

  const patchBody = useCallback(
    (ref: { dbId?: number; tempId?: string }, fields: Partial<CelestialBody>) => {
      setPending((p) => {
        if (ref.tempId !== undefined) {
          return {
            ...p,
            bodyCreates: p.bodyCreates.map((b) => (b.tempId === ref.tempId ? { ...b, ...fields } : b)),
          };
        }
        if (ref.dbId !== undefined) {
          const m = new Map(p.bodyUpdates);
          m.set(ref.dbId, { ...(m.get(ref.dbId) ?? {}), ...fields });
          return { ...p, bodyUpdates: m };
        }
        return p;
      });
    },
    []
  );

  const createBody = useCallback((): string => {
    const tempId = `tmp_body_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setPending((p) => ({
      ...p,
      bodyCreates: [
        ...p.bodyCreates,
        {
          tempId,
          id: "new-body",
          name: "New Body",
          type: "planet",
          orbitPosition: 0,
          orbitDistance: 0.5,
        },
      ],
    }));
    setSelection({ kind: "body", bodyTempId: tempId });
    return tempId;
  }, []);

  const deleteBody = useCallback((ref: { dbId?: number; tempId?: string }) => {
    if (!confirm("Delete this body?")) return;
    setPending((p) => {
      if (ref.tempId !== undefined) {
        return { ...p, bodyCreates: p.bodyCreates.filter((b) => b.tempId !== ref.tempId) };
      }
      if (ref.dbId !== undefined) {
        const m = new Map(p.bodyUpdates);
        m.delete(ref.dbId);
        const d = new Set(p.bodyDeletes);
        d.add(ref.dbId);
        return { ...p, bodyUpdates: m, bodyDeletes: d };
      }
      return p;
    });
    setSelection(null);
  }, []);

  const discard = useCallback(() => {
    if (!dirty) return;
    if (!confirm("Discard all unsaved changes?")) return;
    setPending(emptyPending());
    setError(null);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!sectorSlug || !systemSlug || !baseSystem || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      // Compose payload
      const merged = { ...valueOrEmpty(pending.system) } as Record<string, unknown>;
      // ensure centerKind / binaryAngle consistency if either was touched
      const payload: Record<string, unknown> = {};
      if (Object.keys(merged).length > 0) payload.system = merged;

      // Stars: API expects { primary: {...}, secondary: {...|null} }
      const starsBlock: Record<string, unknown> = {};
      const primaryFields = pending.primary;
      const basePrimary = baseSystem.star;
      if (Object.keys(primaryFields).length > 0) {
        starsBlock.primary = {
          name: primaryFields.name ?? basePrimary.name,
          fantasyLabel: (primaryFields.fantasyLabel ?? basePrimary.type) || null,
          color: primaryFields.color ?? basePrimary.color,
          secondaryColor: (primaryFields.secondaryColor ?? basePrimary.secondaryColor) || null,
          externalUrl: (primaryFields.externalUrl ?? basePrimary.externalUrl) || null,
        };
      }
      if (pending.secondary === null) {
        starsBlock.secondary = null;
      } else if (pending.secondary !== undefined) {
        const baseSec = baseSystem.secondaryStar;
        starsBlock.secondary = {
          name: pending.secondary.name ?? baseSec?.name ?? "",
          fantasyLabel: (pending.secondary.fantasyLabel ?? baseSec?.type) || null,
          color: pending.secondary.color ?? baseSec?.color ?? "#FFE87A",
          secondaryColor: (pending.secondary.secondaryColor ?? baseSec?.secondaryColor) || null,
          externalUrl: (pending.secondary.externalUrl ?? baseSec?.externalUrl) || null,
        };
      }
      if (Object.keys(starsBlock).length > 0) payload.stars = starsBlock;

      // Bodies
      const bodiesBlock: Record<string, unknown> = {};
      if (pending.bodyCreates.length > 0) {
        bodiesBlock.create = pending.bodyCreates.map((b) => ({
          bodyId: (b.id ?? b.name ?? "body").toString().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name: b.name ?? "",
          type: b.type ?? "planet",
          biomeSlug: b.biome ?? null,
          lore: b.lore ?? null,
          orbitPosition: b.orbitPosition ?? 0,
          orbitDistance: b.orbitDistance ?? 0.5,
          labelPosition: b.labelPosition ?? null,
          specialAttribute: b.special_attribute ?? null,
          allegianceSlug: b.allegiance ?? null,
          externalUrl: b.externalUrl ?? null,
          published: b.published ?? true,
        }));
      }
      if (pending.bodyUpdates.size > 0) {
        const arr: Array<Record<string, unknown>> = [];
        for (const [dbId, fields] of pending.bodyUpdates) {
          const u: Record<string, unknown> = { id: dbId };
          if (fields.name !== undefined) u.name = fields.name;
          if (fields.type !== undefined) u.type = fields.type;
          if (fields.biome !== undefined) u.biomeSlug = fields.biome ?? null;
          if (fields.lore !== undefined) u.lore = fields.lore ?? null;
          if (fields.orbitPosition !== undefined) u.orbitPosition = fields.orbitPosition;
          if (fields.orbitDistance !== undefined) u.orbitDistance = fields.orbitDistance;
          if (fields.labelPosition !== undefined) u.labelPosition = fields.labelPosition ?? null;
          if (fields.special_attribute !== undefined) u.specialAttribute = fields.special_attribute ?? null;
          if (fields.allegiance !== undefined) u.allegianceSlug = fields.allegiance ?? null;
          if (fields.externalUrl !== undefined) u.externalUrl = fields.externalUrl ?? null;
          if (fields.published !== undefined) u.published = fields.published;
          arr.push(u);
        }
        bodiesBlock.update = arr;
      }
      if (pending.bodyDeletes.size > 0) {
        bodiesBlock.delete = [...pending.bodyDeletes];
      }
      if (Object.keys(bodiesBlock).length > 0) payload.bodies = bodiesBlock;

      const res = await fetch(
        `/api/admin/map/sectors/${sectorSlug}/systems/${systemSlug}/save`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
      }
      // Reset local state and reload data
      setPending(emptyPending());
      setSelection(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [sectorSlug, systemSlug, baseSystem, pending, dirty, saving, router]);

  return {
    active: !!systemSlug,
    sectorSlug,
    systemSlug,
    baseSystem,
    pending,
    selection,
    saving,
    error,
    dirty,
    initialCenterKind,
    enter,
    exit,
    syncBase,
    select: setSelection,
    patchSystem,
    patchPrimary,
    patchSecondary,
    setCenterKind,
    patchBody,
    createBody,
    deleteBody,
    save,
    discard,
  };
}
