// Edit-mode shared types. Local-only — no API surface here.
//
// EntityKind covers the four things a sector-edit user can manipulate.
// Each pending entity holds either a real DB id (existing row) or a
// client-side `tempId` (newly created in this session). Renderers prefer
// `id` if present; the SAVE flow uses tempId to track creates separately.

import type {
  SystemPin,
  VortexPin,
  MapMarker,
  ConnectionLine,
} from "@/types/sector";

export type EntityKind = "system" | "vortex" | "marker" | "connection";

export type EditMode = "view" | "sector-edit";

// Selection refers to a row by either DB id (existing) or tempId (pending create).
export interface Selection {
  kind: EntityKind;
  id: number | null;
  tempId: string | null;
}

// Local id-tracking for pending creates (so the canvas can render them
// before they hit the DB). Real id arrives after the save round-trip.
export interface WithId {
  id?: number;
  tempId?: string;
}

export type PendingSystem = SystemPin & WithId & { name?: string; centerKind?: string; binaryAngle?: number | null; published?: boolean; externalUrl?: string | null };
export type PendingVortex = VortexPin & WithId;
export type PendingMarker = MapMarker & WithId;
export type PendingConnection = ConnectionLine & WithId;

// The pending-changes shape per entity type.
// `creates` are new rows that don't exist in DB yet.
// `updates` map a real DB id → partial field set (only-touch-passed-fields).
// `deletes` are real DB ids the user has marked for removal on save.
export interface ChangeSetState<TPending> {
  creates: TPending[];                  // each has a tempId
  updates: Map<number, Partial<TPending>>;
  deletes: Set<number>;
}

export interface PendingChanges {
  systems: ChangeSetState<PendingSystem>;
  vortexes: ChangeSetState<PendingVortex>;
  markers: ChangeSetState<PendingMarker>;
  connections: ChangeSetState<PendingConnection>;
}

export function emptyChangeSet<T>(): ChangeSetState<T> {
  return { creates: [], updates: new Map(), deletes: new Set() };
}

export function emptyPending(): PendingChanges {
  return {
    systems: emptyChangeSet(),
    vortexes: emptyChangeSet(),
    markers: emptyChangeSet(),
    connections: emptyChangeSet(),
  };
}

export function isDirty(p: PendingChanges): boolean {
  for (const cs of [p.systems, p.vortexes, p.markers, p.connections]) {
    if (cs.creates.length > 0 || cs.updates.size > 0 || cs.deletes.size > 0) return true;
  }
  return false;
}

export function pendingChangeCount(p: PendingChanges): number {
  let n = 0;
  for (const cs of [p.systems, p.vortexes, p.markers, p.connections]) {
    n += cs.creates.length + cs.updates.size + cs.deletes.size;
  }
  return n;
}
