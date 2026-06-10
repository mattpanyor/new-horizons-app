"use client";

// EditModeProvider: client context that wraps the sector page. Holds the
// edit mode + selection + pending changesets + save flow. Computes an
// "effective sector" by projecting pending creates/updates/deletes onto the
// base sector, which the SectorMap renders.
//
// See map-migration.md §6.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SectorMetadata,
  SystemPin,
  VortexPin,
  MapMarker,
  ConnectionLine,
} from "@/types/sector";
import {
  emptyPending,
  isDirty,
  pendingChangeCount,
  type EntityKind,
  type EditMode,
  type PendingChanges,
  type PendingConnection,
  type PendingMarker,
  type PendingSystem,
  type PendingVortex,
  type Selection,
} from "./types";
import { saveSector } from "./api";

interface ProviderState {
  mode: EditMode;
  selection: Selection | null;
  pending: PendingChanges;
  baseSector: SectorMetadata;
  effectiveSector: SectorMetadata;
  dirty: boolean;
  pendingCount: number;
  canEdit: boolean;
  saving: boolean;
  error: string | null;
  // actions
  setMode: (m: EditMode) => void;
  select: (kind: EntityKind, id: number | null, tempId?: string | null) => void;
  clearSelection: () => void;
  updateField: (kind: EntityKind, ref: { id?: number; tempId?: string }, fields: Record<string, unknown>) => void;
  createEntity: (kind: EntityKind, fields: Record<string, unknown>) => string; // returns tempId
  deleteEntity: (kind: EntityKind, ref: { id?: number; tempId?: string }) => void;
  restoreEntity: (kind: EntityKind, id: number) => void;
  isPendingDelete: (kind: EntityKind, id: number) => boolean;
  discard: () => void;
  save: () => Promise<void>;
}

const Ctx = createContext<ProviderState | null>(null);

export function useEditMode(): ProviderState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEditMode must be used inside EditModeProvider");
  return v;
}

interface ProviderProps {
  sector: SectorMetadata;
  userAccessLevel: number;
  children: React.ReactNode;
}

const REQUIRED_ACCESS = 127;
let tempIdCounter = 0;
const nextTempId = () => `tmp_${Date.now()}_${++tempIdCounter}`;

export function EditModeProvider({ sector, userAccessLevel, children }: ProviderProps) {
  const router = useRouter();
  const canEdit = userAccessLevel >= REQUIRED_ACCESS;
  const [mode, setModeRaw] = useState<EditMode>("view");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [pending, setPending] = useState<PendingChanges>(() => emptyPending());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = isDirty(pending);
  const pendingCount = pendingChangeCount(pending);

  // beforeunload guard — only when there are unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Project pending changes onto baseSector to get the effectiveSector
  // for the canvas to render. Pure derivation; recomputed on changes.
  const effectiveSector = useMemo<SectorMetadata>(() => {
    // SYSTEMS
    const baseSystems = sector.systems
      .filter((s) => !pending.systems.deletes.has(s.id ?? -1))
      .map((s) => {
        const id = s.id;
        const upd = id !== undefined ? pending.systems.updates.get(id) : undefined;
        return upd ? ({ ...s, ...upd } as SystemPin) : s;
      });
    // Spread the entire create record so the side-panel sees ALL the staged
    // fields (name, centerKind, etc.), not just the pin-position subset.
    const systems = [
      ...baseSystems,
      ...pending.systems.creates.map((c) => ({
        ...c,
        slug: c.slug,
        x: c.x ?? 600,
        y: c.y ?? 400,
      }) as SystemPin),
    ];

    // VORTEXES
    const baseVortexes = (sector.vortexes ?? [])
      .filter((v) => !pending.vortexes.deletes.has(v.id ?? -1))
      .map((v) => {
        const id = v.id;
        const upd = id !== undefined ? pending.vortexes.updates.get(id) : undefined;
        return upd ? ({ ...v, ...upd } as VortexPin) : v;
      });
    const vortexes = [
      ...baseVortexes,
      ...pending.vortexes.creates.map((c) => ({
        slug: c.slug,
        name: c.name,
        x: c.x ?? 600,
        y: c.y ?? 400,
        ...(c.color && { color: c.color }),
        ...(c.radius !== undefined && { radius: c.radius }),
        ...(c.ratio && { ratio: c.ratio }),
        ...(c.layer && { layer: c.layer }),
      }) as VortexPin),
    ];

    // MARKERS (free only — connection-attached markers come via connections)
    const baseMarkers = (sector.markers ?? [])
      .filter((m) => !pending.markers.deletes.has(m.id ?? -1))
      .map((m) => {
        const id = m.id;
        const upd = id !== undefined ? pending.markers.updates.get(id) : undefined;
        return upd ? ({ ...m, ...upd } as MapMarker) : m;
      });
    const markers = [
      ...baseMarkers,
      ...pending.markers.creates.map((c) => ({ ...c } as MapMarker)),
    ];

    // CONNECTIONS
    // Marker updates also need to flow through to connection-attached markers
    // (they live inside connection.marker, NOT in sector.markers). The marker
    // changeset is keyed by id, so we look up each attached marker's id in
    // pending.markers.updates and apply the patch in place. Connection-marker
    // deletes here drop the .marker entirely (the connection stays).
    const baseConnections = (sector.connections ?? [])
      .filter((c) => !pending.connections.deletes.has(c.id ?? -1))
      .map((c) => {
        const id = c.id;
        const upd = id !== undefined ? pending.connections.updates.get(id) : undefined;
        let line = upd ? ({ ...c, ...upd } as ConnectionLine) : c;
        if (line.marker?.id !== undefined) {
          const mid = line.marker.id;
          if (pending.markers.deletes.has(mid)) {
            // attached marker marked for delete — drop it from the line
            const { marker, ...rest } = line;
            void marker;
            line = rest as ConnectionLine;
          } else {
            const mUpd = pending.markers.updates.get(mid);
            if (mUpd) line = { ...line, marker: { ...line.marker!, ...mUpd } as MapMarker };
          }
        }
        return line;
      });
    const connections = [
      ...baseConnections,
      ...pending.connections.creates.map((c) => ({ ...c } as ConnectionLine)),
    ];

    return { ...sector, systems, vortexes, markers, connections };
  }, [sector, pending]);

  const setMode = useCallback(
    (m: EditMode) => {
      if (!canEdit && m !== "view") return;
      if (m === "view" && dirty) {
        if (!confirm("You have unsaved changes. Discard them?")) return;
        setPending(emptyPending());
        setSelection(null);
      }
      setModeRaw(m);
    },
    [canEdit, dirty]
  );

  const select = useCallback(
    (kind: EntityKind, id: number | null, tempId: string | null = null) => {
      setSelection({ kind, id, tempId });
    },
    []
  );

  const clearSelection = useCallback(() => setSelection(null), []);

  // The three mutators below all need to write to a key-narrowed changeset
  // (e.g. PendingChanges["systems"]), but they're called with a dynamic
  // `kind` argument. TypeScript can't narrow a generic record access without
  // a literal-string switch, so the changeset is treated as `any` inside
  // these closures — the only place the union is opened up.

  const updateField = useCallback(
    (kind: EntityKind, ref: { id?: number; tempId?: string }, fields: Record<string, unknown>) => {
      setPending((prev) => {
        const key = entityKey(kind);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cs: any = { ...prev[key] };

        // Capture the old slug BEFORE mutating, so we can cascade pending
        // creates that reference it (fixes the case where the GM renames a
        // system/vortex/marker whose old slug is used by a pending-create
        // connection's from/to).
        let oldSlug: string | undefined;
        let newSlug: string | undefined;
        if (typeof fields.slug === "string") {
          newSlug = fields.slug;
          if (ref.tempId) {
            const c = (cs.creates as Array<{ tempId?: string; slug?: string }>).find(
              (x) => x.tempId === ref.tempId
            );
            oldSlug = c?.slug;
          } else if (ref.id !== undefined) {
            // For id-bearing entities, look up the current slug in the
            // effective sector via the base sector (sector prop in scope).
            const list =
              kind === "system" ? sector.systems
              : kind === "vortex" ? sector.vortexes ?? []
              : kind === "marker" ? sector.markers ?? []
              : [];
            const existing = list.find((x) => x.id === ref.id);
            // marker slug is optional in the type; the others are required
            const existingSlug = (existing as { slug?: string } | undefined)?.slug;
            // Also fold in any prior pending rename so consecutive renames
            // (foo → bar → baz) don't lose the original old slug.
            const priorPatch = ref.id !== undefined
              ? (cs.updates as Map<number, { slug?: string }>).get(ref.id)
              : undefined;
            oldSlug = priorPatch?.slug ?? existingSlug;
          }
        }

        if (ref.tempId) {
          cs.creates = cs.creates.map((c: { tempId?: string }) =>
            c.tempId === ref.tempId ? { ...c, ...fields } : c
          );
        } else if (ref.id !== undefined) {
          const updMap = new Map(cs.updates);
          updMap.set(ref.id, { ...(updMap.get(ref.id) ?? {}), ...fields });
          cs.updates = updMap;
        }

        let next = { ...prev, [key]: cs };

        // Pending-side cascade: when a system/vortex/marker is renamed in
        // pending state, rewrite any pending-create connection endpoints
        // referencing the old slug. (Saved connections are cascaded
        // server-side via cascadeSlugRename — see lib/db/connections.ts.)
        if (oldSlug && newSlug && oldSlug !== newSlug && (kind === "system" || kind === "vortex" || kind === "marker")) {
          const conns = { ...next.connections };
          conns.creates = conns.creates.map((c) => {
            let out = c;
            if (out.from === oldSlug) out = { ...out, from: newSlug };
            if (out.to === oldSlug) out = { ...out, to: newSlug };
            return out;
          });
          next = { ...next, connections: conns };
        }

        return next;
      });
    },
    [sector]
  );

  const createEntity = useCallback(
    (kind: EntityKind, fields: Record<string, unknown>): string => {
      const tempId = nextTempId();
      setPending((prev) => {
        const key = entityKey(kind);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cs: any = { ...prev[key] };
        cs.creates = [...cs.creates, { tempId, ...fields }];
        return { ...prev, [key]: cs };
      });
      setSelection({ kind, id: null, tempId });
      return tempId;
    },
    []
  );

  const deleteEntity = useCallback(
    (kind: EntityKind, ref: { id?: number; tempId?: string }) => {
      setPending((prev) => {
        const key = entityKey(kind);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cs: any = { ...prev[key] };

        // Capture the slug being deleted (if any) so we can also drop
        // pending-create connections that point at it. No-op for
        // connections themselves.
        // NOTE: we leave the selection alive for id-bearing deletes (see
        // setSelection below) so the panel can offer a Restore action; for
        // tempId creates we clear since the row is gone entirely.
        let deletedSlug: string | undefined;
        if (kind === "system" || kind === "vortex" || kind === "marker") {
          if (ref.tempId) {
            const c = (cs.creates as Array<{ tempId?: string; slug?: string }>).find(
              (x) => x.tempId === ref.tempId
            );
            deletedSlug = c?.slug;
          } else if (ref.id !== undefined) {
            const list =
              kind === "system" ? sector.systems
              : kind === "vortex" ? sector.vortexes ?? []
              : sector.markers ?? [];
            const existing = list.find((x) => x.id === ref.id);
            deletedSlug = (existing as { slug?: string } | undefined)?.slug;
            // Honor any pending rename
            const priorPatch = (cs.updates as Map<number, { slug?: string }>).get(ref.id);
            if (priorPatch?.slug) deletedSlug = priorPatch.slug;
          }
        }

        if (ref.tempId) {
          cs.creates = cs.creates.filter((c: { tempId?: string }) => c.tempId !== ref.tempId);
        } else if (ref.id !== undefined) {
          const updMap = new Map(cs.updates);
          updMap.delete(ref.id);
          cs.updates = updMap;
          const delSet = new Set(cs.deletes);
          delSet.add(ref.id);
          cs.deletes = delSet;
        }

        let next = { ...prev, [key]: cs };

        // Pending-create connections referencing the deleted slug as an
        // endpoint would insert as orphans on save — drop them so the
        // editor's intent matches the eventual DB state. Note: this does
        // NOT delete already-saved connections that point at this slug
        // (those become orphans server-side and surface in the
        // ConnectionsByLayerPanel for manual cleanup).
        if (deletedSlug) {
          const conns = { ...next.connections };
          conns.creates = conns.creates.filter(
            (c) => c.from !== deletedSlug && c.to !== deletedSlug
          );
          next = { ...next, connections: conns };
        }

        return next;
      });
      // Clear selection only for tempId-create deletes (the row is gone).
      // For id-bearing deletes, keep the selection so the panel can show a
      // Restore button.
      if (ref.tempId) setSelection(null);
    },
    [sector]
  );

  // Reverse of deleteEntity: remove an id from the pending deletes set so
  // the entity stays alive on save. Only meaningful for id-bearing entities
  // (tempId creates are discarded outright on delete, not staged).
  const restoreEntity = useCallback((kind: EntityKind, id: number) => {
    setPending((prev) => {
      const key = entityKey(kind);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cs: any = { ...prev[key] };
      if (!cs.deletes.has(id)) return prev;
      const next = new Set(cs.deletes as Set<number>);
      next.delete(id);
      cs.deletes = next;
      return { ...prev, [key]: cs };
    });
  }, []);

  const isPendingDelete = useCallback(
    (kind: EntityKind, id: number) => {
      const cs = pending[entityKey(kind)] as { deletes: Set<number> };
      return cs.deletes.has(id);
    },
    [pending]
  );

  const discard = useCallback(() => {
    if (!dirty) return;
    if (!confirm("Discard all unsaved changes?")) return;
    setPending(emptyPending());
    setSelection(null);
    setError(null);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveSector(sector.slug, pending);
      setPending(emptyPending());
      setSelection(null);
      // revalidatePath ran server-side; refresh to pull fresh data
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, sector.slug, pending, router]);

  const value: ProviderState = {
    mode,
    selection,
    pending,
    baseSector: sector,
    effectiveSector,
    dirty,
    pendingCount,
    canEdit,
    saving,
    error,
    setMode,
    select,
    clearSelection,
    updateField,
    createEntity,
    deleteEntity,
    restoreEntity,
    isPendingDelete,
    discard,
    save,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function entityKey(k: EntityKind): "systems" | "vortexes" | "markers" | "connections" {
  switch (k) {
    case "system": return "systems";
    case "vortex": return "vortexes";
    case "marker": return "markers";
    case "connection": return "connections";
  }
}

// Helper used by selection panel + other consumers: resolve the currently
// selected entity to its underlying data (base, pending create, OR
// pending-delete fallback from the base sector).
export function resolveSelected(
  state: ProviderState
): { kind: EntityKind; data: unknown; ref: { id?: number; tempId?: string }; pendingDelete?: boolean } | null {
  const sel = state.selection;
  if (!sel) return null;
  if (sel.tempId) {
    const key = entityKey(sel.kind);
    const list = state.pending[key].creates as Array<{ tempId?: string }>;
    const found = list.find((x) => x.tempId === sel.tempId);
    if (!found) return null;
    return { kind: sel.kind, data: found, ref: { tempId: sel.tempId } };
  }
  if (sel.id !== null) {
    // Effective-sector lookup: returns the live view including pending updates.
    let data: unknown;
    switch (sel.kind) {
      case "system":     data = state.effectiveSector.systems.find((s) => s.id === sel.id); break;
      case "vortex":     data = state.effectiveSector.vortexes?.find((v) => v.id === sel.id); break;
      case "marker": {
        // Free markers live in sector.markers; connection-attached markers
        // live inside connection.marker. Search both.
        data =
          state.effectiveSector.markers?.find((m) => m.id === sel.id)
          ?? state.effectiveSector.connections?.find((c) => c.marker?.id === sel.id)?.marker;
        break;
      }
      case "connection": data = state.effectiveSector.connections?.find((c) => c.id === sel.id); break;
    }
    if (data) return { kind: sel.kind, data, ref: { id: sel.id } };

    // Not found in the effective sector — it might be queued for delete in
    // pending. Fall back to the BASE sector so the panel can show a Restore
    // button instead of an empty state.
    if (state.isPendingDelete(sel.kind, sel.id)) {
      let baseData: unknown;
      switch (sel.kind) {
        case "system":     baseData = state.baseSector.systems.find((s) => s.id === sel.id); break;
        case "vortex":     baseData = state.baseSector.vortexes?.find((v) => v.id === sel.id); break;
        case "marker":
          baseData =
            state.baseSector.markers?.find((m) => m.id === sel.id)
            ?? state.baseSector.connections?.find((c) => c.marker?.id === sel.id)?.marker;
          break;
        case "connection": baseData = state.baseSector.connections?.find((c) => c.id === sel.id); break;
      }
      if (baseData) return { kind: sel.kind, data: baseData, ref: { id: sel.id }, pendingDelete: true };
    }
    return null;
  }
  return null;
}
