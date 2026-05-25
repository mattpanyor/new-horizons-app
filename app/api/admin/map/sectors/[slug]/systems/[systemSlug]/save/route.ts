// System-scope save endpoint. Applies metadata, stars (primary required,
// secondary upsert/delete on binary toggle), and body changesets for one
// system. See map-migration.md §5.2.
//
// Auth: superadmin only (accessLevel >= 127).
// Imperial Core and Atlas legacy slugs are rejected (not editable).

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUserByUsername } from "@/lib/db/users";
import { getSectorRowBySlug } from "@/lib/db/sectors";
import { getSystemBySlug, updateSystem } from "@/lib/db/systems";
import { upsertStar, deleteStarByRole } from "@/lib/db/stars";
import { insertBody, updateBody, deleteBody } from "@/lib/db/bodies";
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

  if (slug === "imperial-core" || slug === "atlas-sector-legacy") {
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

  // ── Apply: system metadata, then stars, then bodies (deletes → updates → creates) ──

  if (payload.system) {
    await updateSystem(system.id, payload.system as Parameters<typeof updateSystem>[1]);
  }

  if (payload.stars?.primary) {
    const p = payload.stars.primary;
    if (typeof p.name !== "string" || typeof p.color !== "string") {
      return bad("stars.primary requires name and color");
    }
    await upsertStar({
      systemId: system.id,
      role: "primary",
      name: p.name,
      fantasyLabel: (p.fantasyLabel as string | null | undefined) ?? null,
      color: p.color,
      secondaryColor: (p.secondaryColor as string | null | undefined) ?? null,
      externalUrl: (p.externalUrl as string | null | undefined) ?? null,
    });
  }

  if (secondaryProvided) {
    if (payload.stars?.secondary == null) {
      await deleteStarByRole(system.id, "secondary");
    } else {
      const s = payload.stars.secondary;
      if (typeof s.name !== "string" || typeof s.color !== "string") {
        return bad("stars.secondary requires name and color");
      }
      await upsertStar({
        systemId: system.id,
        role: "secondary",
        name: s.name,
        fantasyLabel: (s.fantasyLabel as string | null | undefined) ?? null,
        color: s.color,
        secondaryColor: (s.secondaryColor as string | null | undefined) ?? null,
        externalUrl: (s.externalUrl as string | null | undefined) ?? null,
      });
    }
  }

  for (const id of payload.bodies?.delete ?? []) {
    if (typeof id !== "number") return bad("bodies.delete must be number[]");
    await deleteBody(id);
  }

  for (const u of payload.bodies?.update ?? []) {
    if (typeof u.id !== "number") return bad("body update missing id");
    if (u.type !== undefined && !isBodyType(u.type))
      return bad(`Invalid body type: ${u.type}`);
    if (u.labelPosition !== undefined && u.labelPosition !== null && !isLabelPosition(u.labelPosition))
      return bad(`Invalid label_position: ${u.labelPosition}`);
    if (u.specialAttribute !== undefined && u.specialAttribute !== null && !isSpecialAttribute(u.specialAttribute))
      return bad(`Invalid special_attribute: ${u.specialAttribute}`);
    await updateBody(u.id, u as Parameters<typeof updateBody>[1]);
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
    await insertBody({
      systemId: system.id,
      bodyId: c.bodyId,
      name: c.name,
      type: c.type,
      biomeSlug: (c.biomeSlug as string | null | undefined) ?? null,
      lore: (c.lore as string | null | undefined) ?? null,
      orbitPosition: c.orbitPosition,
      orbitDistance: c.orbitDistance,
      labelPosition: (c.labelPosition as LabelPosition | null | undefined) ?? null,
      specialAttribute: (c.specialAttribute as SpecialAttribute | null | undefined) ?? null,
      allegianceSlug: (c.allegianceSlug as string | null | undefined) ?? null,
      externalUrl: (c.externalUrl as string | null | undefined) ?? null,
      published: (c.published as boolean | undefined) ?? true,
    });
  }

  revalidatePath("/sectors");
  revalidatePath(`/sectors/${slug}`);

  return NextResponse.json({ ok: true });
}
