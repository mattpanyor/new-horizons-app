// Save-endpoint client. Builds the changeset payload expected by
// /api/admin/map/sectors/[slug]/save (see app/api/admin/map/.../save/route.ts
// and map-migration.md §5.1).

import type { PendingChanges, PendingSystem, PendingVortex, PendingMarker, PendingConnection } from "./types";

type AnyRec = Record<string, unknown>;

// Strip tempId / id / hidden / undefined fields before sending to the server.
function pickFields(obj: AnyRec, drop: ReadonlyArray<string>): AnyRec {
  const out: AnyRec = {};
  for (const [k, v] of Object.entries(obj)) {
    if (drop.includes(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

const SYSTEM_DROP = ["id", "tempId", "hidden"];
const VORTEX_DROP = ["id", "tempId", "hidden", "ratio"];
const MARKER_DROP = ["id", "tempId", "hidden"];
const CONNECTION_DROP = ["id", "tempId", "hidden"];

function systemPayload(s: PendingSystem): AnyRec {
  // Mirror the API's expected camelCase field names. Map SystemPin's
  // optional `allegiance` key to `allegianceSlug` for the API.
  const base = pickFields(s as unknown as AnyRec, SYSTEM_DROP);
  if (base.allegiance !== undefined) {
    base.allegianceSlug = base.allegiance;
    delete base.allegiance;
  }
  return base;
}

function vortexPayload(v: PendingVortex): AnyRec {
  const base = pickFields(v as unknown as AnyRec, VORTEX_DROP);
  if (v.ratio) {
    base.ratioW = v.ratio[0];
    base.ratioH = v.ratio[1];
  }
  return base;
}

function markerPayload(m: PendingMarker): AnyRec {
  const base = pickFields(m as unknown as AnyRec, MARKER_DROP);
  if (base.allegiance !== undefined) {
    base.allegianceSlug = base.allegiance;
    delete base.allegiance;
  }
  return base;
}

function connectionPayload(c: PendingConnection): AnyRec {
  const base = pickFields(c as unknown as AnyRec, CONNECTION_DROP);
  // ConnectionLine has from/to; API expects fromSlug/toSlug
  if (base.from !== undefined) {
    base.fromSlug = base.from;
    delete base.from;
  }
  if (base.to !== undefined) {
    base.toSlug = base.to;
    delete base.to;
  }
  // Embedded markers (rare in this MVP) are passed through unchanged
  return base;
}

export function buildSectorSavePayload(p: PendingChanges): AnyRec {
  const updatesArr = <T>(m: Map<number, Partial<T>>): AnyRec[] => {
    const out: AnyRec[] = [];
    for (const [id, fields] of m) {
      out.push({ id, ...pickFields(fields as AnyRec, ["id", "tempId", "hidden"]) });
    }
    return out;
  };

  return {
    systems: {
      create: p.systems.creates.map(systemPayload),
      update: updatesArr(p.systems.updates).map((u) => {
        if (u.allegiance !== undefined) { u.allegianceSlug = u.allegiance; delete u.allegiance; }
        return u;
      }),
      delete: [...p.systems.deletes],
    },
    vortexes: {
      create: p.vortexes.creates.map(vortexPayload),
      update: updatesArr(p.vortexes.updates),
      delete: [...p.vortexes.deletes],
    },
    markers: {
      create: p.markers.creates.map(markerPayload),
      update: updatesArr(p.markers.updates).map((u) => {
        if (u.allegiance !== undefined) { u.allegianceSlug = u.allegiance; delete u.allegiance; }
        return u;
      }),
      delete: [...p.markers.deletes],
    },
    connections: {
      create: p.connections.creates.map(connectionPayload),
      update: updatesArr(p.connections.updates).map((u) => {
        if (u.from !== undefined) { u.fromSlug = u.from; delete u.from; }
        if (u.to !== undefined) { u.toSlug = u.to; delete u.to; }
        return u;
      }),
      delete: [...p.connections.deletes],
    },
  };
}

export async function saveSector(slug: string, p: PendingChanges): Promise<void> {
  const res = await fetch(`/api/admin/map/sectors/${slug}/save`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSectorSavePayload(p)),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
  }
}
