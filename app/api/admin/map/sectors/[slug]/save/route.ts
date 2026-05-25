// Sector-scope save endpoint. Applies create/update/delete changesets for
// systems, vortexes, markers, and connections within a single sector. See
// map-migration.md §5.1.
//
// Auth: superadmin only (accessLevel >= 127).
// Imperial Core and the Atlas legacy slug are read-only and rejected.
// Operations apply in order: deletes → updates → creates. revalidatePath fires
// once at the end so viewers see the new state on next request.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUserByUsername } from "@/lib/db/users";
import { getSectorRowBySlug } from "@/lib/db/sectors";
import {
  insertSystem,
  updateSystem,
  deleteSystem,
} from "@/lib/db/systems";
import {
  insertVortex,
  updateVortex,
  deleteVortex,
} from "@/lib/db/vortexes";
import {
  insertConnection,
  updateConnection,
  deleteConnection,
} from "@/lib/db/connections";
import {
  insertMarker,
  updateMarker,
  deleteMarker,
} from "@/lib/db/markers";
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

  if (slug === "imperial-core" || slug === "atlas-sector-legacy") {
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

  // ── DELETES ── (CASCADE handles dependent rows)
  for (const id of payload.connections?.delete ?? []) {
    if (typeof id !== "number") return bad("connections.delete must be number[]");
    await deleteConnection(id);
  }
  for (const id of payload.markers?.delete ?? []) {
    if (typeof id !== "number") return bad("markers.delete must be number[]");
    await deleteMarker(id);
  }
  for (const id of payload.vortexes?.delete ?? []) {
    if (typeof id !== "number") return bad("vortexes.delete must be number[]");
    await deleteVortex(id);
  }
  for (const id of payload.systems?.delete ?? []) {
    if (typeof id !== "number") return bad("systems.delete must be number[]");
    await deleteSystem(id);
  }

  // ── UPDATES ──
  for (const u of payload.systems?.update ?? []) {
    if (typeof u.id !== "number") return bad("system update missing id");
    if (u.centerKind !== undefined && !isCenterKind(u.centerKind))
      return bad(`Invalid center_kind: ${u.centerKind}`);
    await updateSystem(u.id, u as Parameters<typeof updateSystem>[1]);
  }
  for (const u of payload.vortexes?.update ?? []) {
    if (typeof u.id !== "number") return bad("vortex update missing id");
    if (u.layer !== undefined && u.layer !== null && !isLayer(u.layer))
      return bad(`Invalid vortex layer: ${u.layer}`);
    await updateVortex(u.id, u as Parameters<typeof updateVortex>[1]);
  }
  for (const u of payload.connections?.update ?? []) {
    if (typeof u.id !== "number") return bad("connection update missing id");
    if (u.layer !== undefined && u.layer !== null && !isLayer(u.layer))
      return bad(`Invalid connection layer: ${u.layer}`);
    await updateConnection(u.id, u as Parameters<typeof updateConnection>[1]);
  }
  for (const u of payload.markers?.update ?? []) {
    if (typeof u.id !== "number") return bad("marker update missing id");
    if (u.type !== undefined && !isMarkerType(u.type))
      return bad(`Invalid marker type: ${u.type}`);
    if (u.layer !== undefined && u.layer !== null && !isLayer(u.layer))
      return bad(`Invalid marker layer: ${u.layer}`);
    await updateMarker(u.id, u as Parameters<typeof updateMarker>[1]);
  }

  // ── CREATES ──
  // Order: systems → vortexes → connections (with embedded markers) → free markers.
  // Why: connection-attached markers need the parent connection's id, so
  // connections come first within their own group.

  for (const c of payload.systems?.create ?? []) {
    if (typeof c.slug !== "string" || typeof c.name !== "string")
      return bad("system create requires slug and name");
    if (typeof c.x !== "number" || typeof c.y !== "number")
      return bad("system create requires x and y");
    if (c.centerKind !== undefined && !isCenterKind(c.centerKind))
      return bad(`Invalid center_kind: ${c.centerKind}`);
    await insertSystem({
      sectorId: sector.id,
      slug: c.slug,
      name: c.name,
      x: c.x,
      y: c.y,
      allegianceSlug: (c.allegianceSlug as string | null | undefined) ?? null,
      territoryRadius: (c.territoryRadius as number | null | undefined) ?? null,
      centerKind: (c.centerKind as CenterKind | undefined) ?? "single",
      binaryAngle: (c.binaryAngle as number | null | undefined) ?? null,
      externalUrl: (c.externalUrl as string | null | undefined) ?? null,
      published: (c.published as boolean | undefined) ?? true,
    });
  }

  for (const c of payload.vortexes?.create ?? []) {
    if (typeof c.slug !== "string" || typeof c.name !== "string")
      return bad("vortex create requires slug and name");
    if (typeof c.x !== "number" || typeof c.y !== "number")
      return bad("vortex create requires x and y");
    if (c.layer !== undefined && c.layer !== null && !isLayer(c.layer))
      return bad(`Invalid vortex layer: ${c.layer}`);
    await insertVortex({
      sectorId: sector.id,
      slug: c.slug,
      name: c.name,
      x: c.x,
      y: c.y,
      color: (c.color as string | null | undefined) ?? null,
      radius: (c.radius as number | null | undefined) ?? null,
      ratioW: (c.ratioW as number | null | undefined) ?? null,
      ratioH: (c.ratioH as number | null | undefined) ?? null,
      layer: (c.layer as Layer | null | undefined) ?? null,
    });
  }

  for (const c of payload.connections?.create ?? []) {
    if (typeof c.fromSlug !== "string" || typeof c.toSlug !== "string")
      return bad("connection create requires fromSlug and toSlug");
    if (c.layer !== undefined && c.layer !== null && !isLayer(c.layer))
      return bad(`Invalid connection layer: ${c.layer}`);
    const inserted = await insertConnection({
      sectorId: sector.id,
      fromSlug: c.fromSlug,
      toSlug: c.toSlug,
      curvature: (c.curvature as number | null | undefined) ?? null,
      label: (c.label as string | null | undefined) ?? null,
      color: (c.color as string | null | undefined) ?? null,
      dashes: (c.dashes as string | null | undefined) ?? null,
      opacity: (c.opacity as number | null | undefined) ?? null,
      layer: (c.layer as Layer | null | undefined) ?? null,
    });
    const m = c.marker as AnyRec | undefined;
    if (m) {
      if (typeof m.slug !== "string" || typeof m.name !== "string" || !isMarkerType(m.type))
        return bad("connection.create.marker requires slug, name, and a valid type");
      await insertMarker({
        sectorId: sector.id,
        slug: m.slug,
        name: m.name,
        type: m.type,
        allegianceSlug: (m.allegianceSlug as string | null | undefined) ?? null,
        externalUrl: (m.externalUrl as string | null | undefined) ?? null,
        territoryRadius: (m.territoryRadius as number | null | undefined) ?? null,
        layer: ((m.layer as Layer | null | undefined) ?? (c.layer as Layer | null | undefined)) ?? null,
        connectionId: inserted.id,
        position: (m.position as number | null | undefined) ?? 0.5,
      });
    }
  }

  for (const c of payload.markers?.create ?? []) {
    if (typeof c.slug !== "string" || typeof c.name !== "string" || !isMarkerType(c.type))
      return bad("marker create requires slug, name, and a valid type");
    if (c.layer !== undefined && c.layer !== null && !isLayer(c.layer))
      return bad(`Invalid marker layer: ${c.layer}`);

    const isAttached = c.connectionId != null;
    if (isAttached) {
      if (typeof c.position !== "number")
        return bad("attached marker create requires connectionId and position");
      await insertMarker({
        sectorId: sector.id,
        slug: c.slug,
        name: c.name,
        type: c.type,
        allegianceSlug: (c.allegianceSlug as string | null | undefined) ?? null,
        externalUrl: (c.externalUrl as string | null | undefined) ?? null,
        territoryRadius: (c.territoryRadius as number | null | undefined) ?? null,
        layer: (c.layer as Layer | null | undefined) ?? null,
        connectionId: c.connectionId as number,
        position: c.position,
      });
    } else {
      if (typeof c.x !== "number" || typeof c.y !== "number")
        return bad("free marker create requires x and y");
      await insertMarker({
        sectorId: sector.id,
        slug: c.slug,
        name: c.name,
        type: c.type,
        allegianceSlug: (c.allegianceSlug as string | null | undefined) ?? null,
        externalUrl: (c.externalUrl as string | null | undefined) ?? null,
        territoryRadius: (c.territoryRadius as number | null | undefined) ?? null,
        layer: (c.layer as Layer | null | undefined) ?? null,
        x: c.x,
        y: c.y,
        angle: (c.angle as number | null | undefined) ?? null,
      });
    }
  }

  revalidatePath("/sectors");
  revalidatePath(`/sectors/${slug}`);

  return NextResponse.json({ ok: true });
}
