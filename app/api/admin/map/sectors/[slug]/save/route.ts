// Sector-scope save endpoint. Applies create/update/delete changesets for
// systems, vortexes, markers, and connections within a single sector. See
// map-migration.md §5.1.
//
// Auth: superadmin only (accessLevel >= 127).
// Imperial Core is read-only (bespoke cluster, not schema-driven) and rejected.
// Operations apply in order: deletes → updates → creates. All writes run
// inside a single BEGIN/COMMIT transaction via withTransaction — a
// mid-batch failure rolls back every prior write. revalidatePath fires
// only on commit.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUserByUsername } from "@/lib/db/users";
import { getSectorRowBySlug } from "@/lib/db/sectors";
import {
  getSystemsBySector,
  insertSystem,
  updateSystem,
  deleteSystem,
} from "@/lib/db/systems";
import {
  getVortexesBySector,
  insertVortex,
  updateVortex,
  deleteVortex,
} from "@/lib/db/vortexes";
import {
  getConnectionsBySector,
  insertConnection,
  updateConnection,
  deleteConnection,
} from "@/lib/db/connections";
import {
  getMarkersBySector,
  insertMarker,
  updateMarker,
  deleteMarker,
} from "@/lib/db/markers";
import { withTransaction } from "@/lib/db/tx";
import {
  CENTER_KINDS,
  LAYERS,
  MARKER_TYPES,
  type CenterKind,
  type Layer,
  type MarkerType,
} from "@/lib/mapEnums";

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

const isCenterKind = (v: unknown): v is CenterKind =>
  typeof v === "string" && (CENTER_KINDS as readonly string[]).includes(v);
const isLayer = (v: unknown): v is Layer =>
  typeof v === "string" && (LAYERS as readonly string[]).includes(v);
const isMarkerType = (v: unknown): v is MarkerType =>
  typeof v === "string" && (MARKER_TYPES as readonly string[]).includes(v);

const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

type AnyRec = Record<string, unknown>;

interface ChangeSet<T> {
  create?: T[];
  update?: (T & { id: number })[];
  delete?: number[];
}

interface SectorSavePayload {
  systems?: ChangeSet<AnyRec>;
  vortexes?: ChangeSet<AnyRec>;
  markers?: ChangeSet<AnyRec>;
  connections?: ChangeSet<AnyRec>;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  if (slug === "imperial-core") {
    return bad(`Sector '${slug}' is not editable through this endpoint.`);
  }

  const sector = await getSectorRowBySlug(slug);
  if (!sector) {
    return NextResponse.json({ error: "Sector not found" }, { status: 404 });
  }

  let payload: SectorSavePayload;
  try {
    payload = (await req.json()) as SectorSavePayload;
  } catch {
    return bad("Invalid JSON body");
  }

  // ── Pre-flight structural validation (cheap, runs outside the tx) ──
  // Field-level enum checks live here so we 400 early on malformed input
  // rather than rolling back a partially-applied transaction.
  for (const id of payload.connections?.delete ?? []) {
    if (typeof id !== "number") return bad("connections.delete must be number[]");
  }
  for (const id of payload.markers?.delete ?? []) {
    if (typeof id !== "number") return bad("markers.delete must be number[]");
  }
  for (const id of payload.vortexes?.delete ?? []) {
    if (typeof id !== "number") return bad("vortexes.delete must be number[]");
  }
  for (const id of payload.systems?.delete ?? []) {
    if (typeof id !== "number") return bad("systems.delete must be number[]");
  }

  // Build a validated allowlist for each entity's field set rather than
  // blind-casting the raw payload. Stops a malformed/malicious client from
  // sending unexpected shapes (e.g. `{ x: { weird: 1 } }`) into a column
  // UPDATE.
  const str  = (v: unknown) => (typeof v === "string" ? v : undefined);
  const num  = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
  const nullable = <T>(v: unknown, pick: (x: unknown) => T | undefined): T | null | undefined => {
    if (v === null) return null;
    return pick(v);
  };

  for (const u of payload.systems?.update ?? []) {
    if (typeof u.id !== "number") return bad("system update missing id");
    if (u.centerKind !== undefined && !isCenterKind(u.centerKind))
      return bad(`Invalid center_kind: ${u.centerKind}`);
  }
  for (const u of payload.vortexes?.update ?? []) {
    if (typeof u.id !== "number") return bad("vortex update missing id");
    if (u.layer !== undefined && u.layer !== null && !isLayer(u.layer))
      return bad(`Invalid vortex layer: ${u.layer}`);
  }
  for (const u of payload.connections?.update ?? []) {
    if (typeof u.id !== "number") return bad("connection update missing id");
    if (u.layer !== undefined && u.layer !== null && !isLayer(u.layer))
      return bad(`Invalid connection layer: ${u.layer}`);
  }
  for (const u of payload.markers?.update ?? []) {
    if (typeof u.id !== "number") return bad("marker update missing id");
    if (u.type !== undefined && !isMarkerType(u.type))
      return bad(`Invalid marker type: ${u.type}`);
    if (u.layer !== undefined && u.layer !== null && !isLayer(u.layer))
      return bad(`Invalid marker layer: ${u.layer}`);
  }
  for (const c of payload.systems?.create ?? []) {
    if (typeof c.slug !== "string" || typeof c.name !== "string")
      return bad("system create requires slug and name");
    if (typeof c.x !== "number" || typeof c.y !== "number")
      return bad("system create requires x and y");
    if (c.centerKind !== undefined && !isCenterKind(c.centerKind))
      return bad(`Invalid center_kind: ${c.centerKind}`);
  }
  for (const c of payload.vortexes?.create ?? []) {
    if (typeof c.slug !== "string" || typeof c.name !== "string")
      return bad("vortex create requires slug and name");
    if (typeof c.x !== "number" || typeof c.y !== "number")
      return bad("vortex create requires x and y");
    if (c.layer !== undefined && c.layer !== null && !isLayer(c.layer))
      return bad(`Invalid vortex layer: ${c.layer}`);
  }
  for (const c of payload.connections?.create ?? []) {
    if (typeof c.fromSlug !== "string" || typeof c.toSlug !== "string")
      return bad("connection create requires fromSlug and toSlug");
    if (c.layer !== undefined && c.layer !== null && !isLayer(c.layer))
      return bad(`Invalid connection layer: ${c.layer}`);
    const m = c.marker as AnyRec | undefined;
    if (m) {
      if (typeof m.slug !== "string" || typeof m.name !== "string" || !isMarkerType(m.type))
        return bad("connection.create.marker requires slug, name, and a valid type");
    }
  }
  for (const c of payload.markers?.create ?? []) {
    if (typeof c.slug !== "string" || typeof c.name !== "string" || !isMarkerType(c.type))
      return bad("marker create requires slug, name, and a valid type");
    if (c.layer !== undefined && c.layer !== null && !isLayer(c.layer))
      return bad(`Invalid marker layer: ${c.layer}`);
    if (c.connectionId != null) {
      if (typeof c.position !== "number")
        return bad("attached marker create requires connectionId and position");
    } else {
      if (typeof c.x !== "number" || typeof c.y !== "number")
        return bad("free marker create requires x and y");
    }
  }

  // ── Scope enforcement: every update/delete id (and attached-marker
  // connection reference) must belong to THIS sector. The DB update/delete
  // helpers key on a bare id (WHERE id = $1) with no sector filter, so without
  // this a superadmin editing sector A could pass ids from sector B — incl.
  // read-only imperial-core — and mutate them. Pre-fetch the sector's own id
  // sets and reject anything out of scope before opening the transaction.
  const [ownSystems, ownVortexes, ownMarkers, ownConnections] = await Promise.all([
    getSystemsBySector(sector.id),
    getVortexesBySector(sector.id),
    getMarkersBySector(sector.id),
    getConnectionsBySector(sector.id),
  ]);
  const systemIds = new Set(ownSystems.map((r) => r.id));
  const vortexIds = new Set(ownVortexes.map((r) => r.id));
  const markerIds = new Set(ownMarkers.map((r) => r.id));
  const connectionIds = new Set(ownConnections.map((r) => r.id));

  const checkScope = (label: string, ids: number[], allowed: Set<number>): string | null => {
    for (const id of ids) if (!allowed.has(id)) return `${label} ${id} is not in sector '${slug}'`;
    return null;
  };
  const scopeError =
    checkScope("system", [
      ...(payload.systems?.delete ?? []),
      ...(payload.systems?.update ?? []).map((u) => u.id),
    ], systemIds) ??
    checkScope("vortex", [
      ...(payload.vortexes?.delete ?? []),
      ...(payload.vortexes?.update ?? []).map((u) => u.id),
    ], vortexIds) ??
    checkScope("marker", [
      ...(payload.markers?.delete ?? []),
      ...(payload.markers?.update ?? []).map((u) => u.id),
    ], markerIds) ??
    checkScope("connection", [
      ...(payload.connections?.delete ?? []),
      ...(payload.connections?.update ?? []).map((u) => u.id),
    ], connectionIds);
  if (scopeError) return bad(scopeError);

  // Attached markers (create + update) must reference a connection in THIS
  // sector. null connectionId is a valid detach; undefined means no change.
  for (const c of payload.markers?.create ?? []) {
    if (typeof c.connectionId === "number" && !connectionIds.has(c.connectionId))
      return bad(`marker create references connection ${c.connectionId} not in sector '${slug}'`);
  }
  for (const u of payload.markers?.update ?? []) {
    if (typeof u.connectionId === "number" && !connectionIds.has(u.connectionId))
      return bad(`marker update references connection ${u.connectionId} not in sector '${slug}'`);
  }

  // ── Apply: deletes → updates → creates, all inside one transaction ──
  try {
    await withTransaction(async (tx) => {
      // DELETES (CASCADE handles dependent rows)
      for (const id of payload.connections?.delete ?? []) {
        await deleteConnection(id as number, tx);
      }
      for (const id of payload.markers?.delete ?? []) {
        await deleteMarker(id as number, tx);
      }
      for (const id of payload.vortexes?.delete ?? []) {
        await deleteVortex(id as number, tx);
      }
      for (const id of payload.systems?.delete ?? []) {
        await deleteSystem(id as number, tx);
      }

      // UPDATES
      for (const u of payload.systems?.update ?? []) {
        await updateSystem(u.id, {
          slug: str(u.slug),
          name: str(u.name),
          x: num(u.x),
          y: num(u.y),
          allegianceSlug: nullable(u.allegianceSlug, str),
          territoryRadius: nullable(u.territoryRadius, num),
          centerKind: u.centerKind as CenterKind | undefined,
          binaryAngle: nullable(u.binaryAngle, num),
          externalUrl: nullable(u.externalUrl, str),
          published: bool(u.published),
        }, tx);
      }
      for (const u of payload.vortexes?.update ?? []) {
        await updateVortex(u.id, {
          slug: str(u.slug),
          name: str(u.name),
          x: num(u.x),
          y: num(u.y),
          color: nullable(u.color, str),
          radius: nullable(u.radius, num),
          ratioW: nullable(u.ratioW, num),
          ratioH: nullable(u.ratioH, num),
          layer: nullable(u.layer, (v) => (isLayer(v) ? v : undefined)),
        }, tx);
      }
      for (const u of payload.connections?.update ?? []) {
        await updateConnection(u.id, {
          fromSlug: str(u.fromSlug),
          toSlug: str(u.toSlug),
          curvature: nullable(u.curvature, num),
          label: nullable(u.label, str),
          color: nullable(u.color, str),
          dashes: nullable(u.dashes, str),
          opacity: nullable(u.opacity, num),
          layer: nullable(u.layer, (v) => (isLayer(v) ? v : undefined)),
        }, tx);
      }
      for (const u of payload.markers?.update ?? []) {
        await updateMarker(u.id, {
          slug: str(u.slug),
          name: str(u.name),
          type: u.type as MarkerType | undefined,
          allegianceSlug: nullable(u.allegianceSlug, str),
          externalUrl: nullable(u.externalUrl, str),
          territoryRadius: nullable(u.territoryRadius, num),
          layer: nullable(u.layer, (v) => (isLayer(v) ? v : undefined)),
          connectionId: nullable(u.connectionId, num),
          position: nullable(u.position, num),
          x: nullable(u.x, num),
          y: nullable(u.y, num),
          angle: nullable(u.angle, num),
        }, tx);
      }

      // CREATES
      // Order: systems → vortexes → connections (with embedded markers) → free markers.
      // Connection-attached markers need the parent connection's id, so
      // connections come first within their own group.
      for (const c of payload.systems?.create ?? []) {
        await insertSystem({
          sectorId: sector.id,
          slug: c.slug as string,
          name: c.name as string,
          x: c.x as number,
          y: c.y as number,
          allegianceSlug: (c.allegianceSlug as string | null | undefined) ?? null,
          territoryRadius: (c.territoryRadius as number | null | undefined) ?? null,
          centerKind: (c.centerKind as CenterKind | undefined) ?? "single",
          binaryAngle: (c.binaryAngle as number | null | undefined) ?? null,
          externalUrl: (c.externalUrl as string | null | undefined) ?? null,
          published: (c.published as boolean | undefined) ?? true,
        }, tx);
      }

      for (const c of payload.vortexes?.create ?? []) {
        await insertVortex({
          sectorId: sector.id,
          slug: c.slug as string,
          name: c.name as string,
          x: c.x as number,
          y: c.y as number,
          color: (c.color as string | null | undefined) ?? null,
          radius: (c.radius as number | null | undefined) ?? null,
          ratioW: (c.ratioW as number | null | undefined) ?? null,
          ratioH: (c.ratioH as number | null | undefined) ?? null,
          layer: (c.layer as Layer | null | undefined) ?? null,
        }, tx);
      }

      for (const c of payload.connections?.create ?? []) {
        const inserted = await insertConnection({
          sectorId: sector.id,
          fromSlug: c.fromSlug as string,
          toSlug: c.toSlug as string,
          curvature: (c.curvature as number | null | undefined) ?? null,
          label: (c.label as string | null | undefined) ?? null,
          color: (c.color as string | null | undefined) ?? null,
          dashes: (c.dashes as string | null | undefined) ?? null,
          opacity: (c.opacity as number | null | undefined) ?? null,
          layer: (c.layer as Layer | null | undefined) ?? null,
        }, tx);
        const m = c.marker as AnyRec | undefined;
        if (m) {
          await insertMarker({
            sectorId: sector.id,
            slug: m.slug as string,
            name: m.name as string,
            type: m.type as MarkerType,
            allegianceSlug: (m.allegianceSlug as string | null | undefined) ?? null,
            externalUrl: (m.externalUrl as string | null | undefined) ?? null,
            territoryRadius: (m.territoryRadius as number | null | undefined) ?? null,
            layer: ((m.layer as Layer | null | undefined) ?? (c.layer as Layer | null | undefined)) ?? null,
            connectionId: inserted.id,
            position: (m.position as number | null | undefined) ?? 0.5,
          }, tx);
        }
      }

      for (const c of payload.markers?.create ?? []) {
        const isAttached = c.connectionId != null;
        if (isAttached) {
          await insertMarker({
            sectorId: sector.id,
            slug: c.slug as string,
            name: c.name as string,
            type: c.type as MarkerType,
            allegianceSlug: (c.allegianceSlug as string | null | undefined) ?? null,
            externalUrl: (c.externalUrl as string | null | undefined) ?? null,
            territoryRadius: (c.territoryRadius as number | null | undefined) ?? null,
            layer: (c.layer as Layer | null | undefined) ?? null,
            connectionId: c.connectionId as number,
            position: c.position as number,
          }, tx);
        } else {
          await insertMarker({
            sectorId: sector.id,
            slug: c.slug as string,
            name: c.name as string,
            type: c.type as MarkerType,
            allegianceSlug: (c.allegianceSlug as string | null | undefined) ?? null,
            externalUrl: (c.externalUrl as string | null | undefined) ?? null,
            territoryRadius: (c.territoryRadius as number | null | undefined) ?? null,
            layer: (c.layer as Layer | null | undefined) ?? null,
            x: c.x as number,
            y: c.y as number,
            angle: (c.angle as number | null | undefined) ?? null,
          }, tx);
        }
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Save failed: ${msg}` }, { status: 500 });
  }

  revalidatePath("/sectors");
  revalidatePath(`/sectors/${slug}`);

  return NextResponse.json({ ok: true });
}
