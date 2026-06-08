// System-scope save endpoint. Applies metadata, stars (primary required,
// secondary upsert/delete on binary toggle), and body changesets for one
// system. See map-migration.md §5.2.
//
// Auth: superadmin only (accessLevel >= 127).
// Imperial Core is rejected (bespoke cluster, not editable).
//
// All writes run inside a single BEGIN/COMMIT transaction via
// withTransaction — a mid-batch failure (FK violation, slug collision,
// etc.) rolls back every prior write, so the client's view never desyncs
// from the DB.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUserByUsername } from "@/lib/db/users";
import { getSectorRowBySlug } from "@/lib/db/sectors";
import { getSystemBySlug, updateSystem } from "@/lib/db/systems";
import { upsertStar, deleteStarByRole } from "@/lib/db/stars";
import { getBodiesBySystem, insertBody, updateBody, deleteBody } from "@/lib/db/bodies";
import { withTransaction } from "@/lib/db/tx";
import {
  BODY_TYPES,
  CENTER_KINDS,
  LABEL_POSITIONS,
  SPECIAL_ATTRIBUTE_KEYS,
  type BodyType,
  type CenterKind,
  type LabelPosition,
  type SpecialAttribute,
} from "@/lib/mapEnums";

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

const isBodyType = (v: unknown): v is BodyType =>
  typeof v === "string" && (BODY_TYPES as readonly string[]).includes(v);
const isCenterKind = (v: unknown): v is CenterKind =>
  typeof v === "string" && (CENTER_KINDS as readonly string[]).includes(v);
const isLabelPosition = (v: unknown): v is LabelPosition =>
  typeof v === "string" && (LABEL_POSITIONS as readonly string[]).includes(v);
const isSpecialAttribute = (v: unknown): v is SpecialAttribute =>
  typeof v === "string" && (SPECIAL_ATTRIBUTE_KEYS as readonly string[]).includes(v);

// Typed field pickers — mirror the sector-save route so a malformed client
// can't push unexpected shapes (e.g. `{ x: { weird: 1 } }`) into a column.
const str  = (v: unknown) => (typeof v === "string" ? v : undefined);
const num  = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const nullable = <T>(v: unknown, pick: (x: unknown) => T | undefined): T | null | undefined => {
  if (v === null) return null;
  return pick(v);
};

const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

type AnyRec = Record<string, unknown>;

interface SystemSavePayload {
  system?: AnyRec;
  stars?: {
    primary?: AnyRec;
    secondary?: AnyRec | null;
  };
  bodies?: {
    create?: AnyRec[];
    update?: (AnyRec & { id: number })[];
    delete?: number[];
  };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; systemSlug: string }> }
) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug, systemSlug } = await params;

  if (slug === "imperial-core") {
    return bad(`Sector '${slug}' is not editable through this endpoint.`);
  }

  const sector = await getSectorRowBySlug(slug);
  if (!sector) {
    return NextResponse.json({ error: "Sector not found" }, { status: 404 });
  }

  const system = await getSystemBySlug(sector.id, systemSlug);
  if (!system) {
    return NextResponse.json({ error: "System not found" }, { status: 404 });
  }

  let payload: SystemSavePayload;
  try {
    payload = (await req.json()) as SystemSavePayload;
  } catch {
    return bad("Invalid JSON body");
  }

  // Determine the post-save center_kind to validate stars/secondary consistency.
  const incomingCenterKind = payload.system?.centerKind;
  if (incomingCenterKind !== undefined && !isCenterKind(incomingCenterKind)) {
    return bad(`Invalid center_kind: ${incomingCenterKind}`);
  }
  const effectiveCenterKind: CenterKind =
    (incomingCenterKind as CenterKind | undefined) ?? system.centerKind;

  // Validate secondary star presence matches the effective kind
  const secondaryProvided = payload.stars && "secondary" in payload.stars;
  if (effectiveCenterKind === "binary") {
    if (!secondaryProvided || payload.stars?.secondary == null) {
      return bad("center_kind='binary' requires stars.secondary to be set");
    }
  } else {
    if (secondaryProvided && payload.stars?.secondary != null) {
      return bad(
        `center_kind='${effectiveCenterKind}' requires stars.secondary to be null or absent`
      );
    }
  }

  // Validate body changeset shapes BEFORE opening the transaction. Cheap
  // structural checks shouldn't pay the cost of a rollback to surface as a
  // 400. Field-level enum checks live next to the writes inside the tx.
  for (const id of payload.bodies?.delete ?? []) {
    if (typeof id !== "number") return bad("bodies.delete must be number[]");
  }
  for (const u of payload.bodies?.update ?? []) {
    if (typeof u.id !== "number") return bad("body update missing id");
    if (u.type !== undefined && !isBodyType(u.type))
      return bad(`Invalid body type: ${u.type}`);
    if (u.labelPosition !== undefined && u.labelPosition !== null && !isLabelPosition(u.labelPosition))
      return bad(`Invalid label_position: ${u.labelPosition}`);
    if (u.specialAttribute !== undefined && u.specialAttribute !== null && !isSpecialAttribute(u.specialAttribute))
      return bad(`Invalid special_attribute: ${u.specialAttribute}`);
  }
  for (const c of payload.bodies?.create ?? []) {
    if (typeof c.bodyId !== "string" || typeof c.name !== "string" || !isBodyType(c.type))
      return bad("body create requires bodyId, name, and a valid type");
    if (typeof c.orbitPosition !== "number" || typeof c.orbitDistance !== "number")
      return bad("body create requires orbitPosition and orbitDistance");
    if (c.labelPosition !== undefined && c.labelPosition !== null && !isLabelPosition(c.labelPosition))
      return bad(`Invalid label_position: ${c.labelPosition}`);
    if (c.specialAttribute !== undefined && c.specialAttribute !== null && !isSpecialAttribute(c.specialAttribute))
      return bad(`Invalid special_attribute: ${c.specialAttribute}`);
  }
  if (payload.stars?.primary) {
    const p = payload.stars.primary;
    if (typeof p.name !== "string" || typeof p.color !== "string") {
      return bad("stars.primary requires name and color");
    }
  }
  if (secondaryProvided && payload.stars?.secondary != null) {
    const s = payload.stars.secondary;
    if (typeof s.name !== "string" || typeof s.color !== "string") {
      return bad("stars.secondary requires name and color");
    }
  }

  // ── Scope enforcement: every body update/delete id must belong to THIS
  // system. deleteBody/updateBody key on a bare id (WHERE id = $1), so without
  // this a superadmin saving system A could pass body ids from another system
  // (incl. other sectors / imperial-core) and mutate them. ──
  const ownBodies = await getBodiesBySystem(system.id);
  const bodyIds = new Set(ownBodies.map((b) => b.id));
  for (const id of payload.bodies?.delete ?? []) {
    if (!bodyIds.has(id)) return bad(`body ${id} is not in system '${systemSlug}'`);
  }
  for (const u of payload.bodies?.update ?? []) {
    if (!bodyIds.has(u.id)) return bad(`body ${u.id} is not in system '${systemSlug}'`);
  }

  // ── Apply: system metadata, then stars, then bodies (deletes → updates → creates) ──
  try {
    await withTransaction(async (tx) => {
      if (payload.system) {
        // Build a validated field set rather than blind-casting the raw
        // payload (centerKind already enum-checked above).
        const s = payload.system;
        await updateSystem(system.id, {
          slug: str(s.slug),
          name: str(s.name),
          x: num(s.x),
          y: num(s.y),
          allegianceSlug: nullable(s.allegianceSlug, str),
          territoryRadius: nullable(s.territoryRadius, num),
          centerKind: s.centerKind as CenterKind | undefined,
          binaryAngle: nullable(s.binaryAngle, num),
          externalUrl: nullable(s.externalUrl, str),
          published: bool(s.published),
        }, tx);
      }

      if (payload.stars?.primary) {
        const p = payload.stars.primary;
        await upsertStar({
          systemId: system.id,
          role: "primary",
          name: p.name as string,
          fantasyLabel: (p.fantasyLabel as string | null | undefined) ?? null,
          color: p.color as string,
          secondaryColor: (p.secondaryColor as string | null | undefined) ?? null,
          externalUrl: (p.externalUrl as string | null | undefined) ?? null,
        }, tx);
      }

      if (secondaryProvided) {
        if (payload.stars?.secondary == null) {
          await deleteStarByRole(system.id, "secondary", tx);
        } else {
          const s = payload.stars.secondary;
          await upsertStar({
            systemId: system.id,
            role: "secondary",
            name: s.name as string,
            fantasyLabel: (s.fantasyLabel as string | null | undefined) ?? null,
            color: s.color as string,
            secondaryColor: (s.secondaryColor as string | null | undefined) ?? null,
            externalUrl: (s.externalUrl as string | null | undefined) ?? null,
          }, tx);
        }
      }

      for (const id of payload.bodies?.delete ?? []) {
        await deleteBody(id, tx);
      }

      for (const u of payload.bodies?.update ?? []) {
        // Validated field set (type/labelPosition/specialAttribute enum-checked
        // above) rather than a raw cast of the client object.
        await updateBody(u.id, {
          bodyId: str(u.bodyId),
          name: str(u.name),
          type: u.type as BodyType | undefined,
          biomeSlug: nullable(u.biomeSlug, str),
          lore: nullable(u.lore, str),
          orbitPosition: num(u.orbitPosition),
          orbitDistance: num(u.orbitDistance),
          labelPosition: nullable(u.labelPosition, (v) => (isLabelPosition(v) ? v : undefined)),
          specialAttribute: nullable(u.specialAttribute, (v) => (isSpecialAttribute(v) ? v : undefined)),
          allegianceSlug: nullable(u.allegianceSlug, str),
          externalUrl: nullable(u.externalUrl, str),
          published: bool(u.published),
        }, tx);
      }

      for (const c of payload.bodies?.create ?? []) {
        await insertBody({
          systemId: system.id,
          bodyId: c.bodyId as string,
          name: c.name as string,
          type: c.type as BodyType,
          biomeSlug: (c.biomeSlug as string | null | undefined) ?? null,
          lore: (c.lore as string | null | undefined) ?? null,
          orbitPosition: c.orbitPosition as number,
          orbitDistance: c.orbitDistance as number,
          labelPosition: (c.labelPosition as LabelPosition | null | undefined) ?? null,
          specialAttribute: (c.specialAttribute as SpecialAttribute | null | undefined) ?? null,
          allegianceSlug: (c.allegianceSlug as string | null | undefined) ?? null,
          externalUrl: (c.externalUrl as string | null | undefined) ?? null,
          published: (c.published as boolean | undefined) ?? true,
        }, tx);
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Save failed: ${msg}` }, { status: 500 });
  }

  // Revalidate only on a committed transaction — never expose half-applied
  // state to readers.
  revalidatePath("/sectors");
  revalidatePath(`/sectors/${slug}`);

  return NextResponse.json({ ok: true });
}
