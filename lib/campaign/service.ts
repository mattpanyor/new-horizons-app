// Campaign tracker policy layer — the single source of truth for who may do
// what to faction standings, Libra's integrity, and the anonymity log.
//
// Same contract as lib/investigation/service.ts: every caller goes through
// here, functions return a ServiceResult rather than throwing or returning a
// Response, and each transport maps the outcome onto its own errors. The web
// routes under app/api/campaign are thin adapters over this. Nothing is
// exposed over MCP yet; when it is, the module's handlers call these same
// functions and inherit every rule below unchanged.

import type { User } from "@/lib/db/users";
import { getAllAllegiances } from "@/lib/db/allegiances";
import { getKankaEntityByEntityId } from "@/lib/db/kankaEntities";
import { kankaEntityUrl } from "@/lib/kanka";
import type {
  AnonymityEntry,
  AnonymityKind,
  FactionStanding,
  Vip,
  VipDossier,
} from "@/types/campaign";
import { isValidCells } from "./standing";
import { isValidCellIndex } from "./integrity";
import { ANONYMITY_TEXT_MAX, VIP_BLURB_MAX, VIP_TAGLINE_MAX } from "./constants";
import {
  createAnonymityEntry,
  deleteAnonymityEntry,
  getAnonymityEntries,
  getAnonymityEntry,
  getStandings,
  getVip,
  getVips,
  setStanding,
  setVipAccess,
  setVipBlurb,
  setVipTagline,
  setVipCell,
  updateAnonymityEntry,
  type VipRow,
} from "@/lib/db/campaign";

/**
 * Extra restrictions a *calling surface* may impose on top of the app's rules.
 *
 * These only ever narrow, never widen — the access-level rules in `can()`
 * remain the ceiling. Same contract as ActorConstraints in the investigation
 * service.
 */
export interface CampaignConstraints {
  /**
   * Drop hidden factions from the result at every access level, including
   * superadmin.
   *
   * The web board shows a superadmin their hidden factions, because hiding is a
   * display choice they made and they need to be able to undo it. An AI client
   * is a different audience: it summarises and relays, often into a channel the
   * players can read, and it has no way to know that a faction being on the
   * list is itself the secret. So the MCP surface drops them outright rather
   * than labelling them and trusting the model to stay quiet.
   */
  excludeHidden?: boolean;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T = never>(error: string, status: number): ServiceResult<T> {
  return { ok: false, error, status };
}

/** Access levels, matching the app's convention: 0 player, 66 admin, 127 superadmin. */
export const ACCESS = { PLAYER: 0, ADMIN: 66, SUPERADMIN: 127 } as const;

// Re-exported for server-side callers already importing from this module.
// Client components must import it from ./constants directly — see the note at
// the top of that file.
export { ANONYMITY_TEXT_MAX, VIP_BLURB_MAX, VIP_TAGLINE_MAX };

const ANONYMITY_KINDS: readonly AnonymityKind[] = ["confirmed", "suspicion"];

export type CampaignAction =
  | "standing:read"
  | "standing:update"
  | "vip:read"
  | "vip:update"
  | "vip:setAccess"
  | "vip:setBlurb"
  | "vip:setTagline"
  | "anonymity:read"
  | "anonymity:create"
  | "anonymity:update"
  | "anonymity:delete";

/**
 * Exported so a UI or an MCP registry can ask the same function that enforces
 * the check — a control the caller could never successfully use should not be
 * offered to them in the first place.
 */
export function can(actor: User, action: CampaignAction): boolean {
  switch (action) {
    // Reading is open to any authenticated user, and so is the whole anonymity
    // log: it is a shared scratchpad the table explicitly belongs to everyone,
    // including deletion. Standings and integrity are GM state by contrast —
    // they record consequences the GM has decided, not player observations.
    case "standing:read":
    case "vip:read":
    case "anonymity:read":
    case "anonymity:create":
    case "anonymity:update":
    case "anonymity:delete":
      return true;
    case "standing:update":
    case "vip:update":
    case "vip:setAccess":
    case "vip:setBlurb":
    case "vip:setTagline":
      return actor.accessLevel >= ACCESS.SUPERADMIN;
  }
}

/* ----------------------------------------------------------- standings */

/**
 * Every faction, with its standing merged in.
 *
 * The allegiance list drives the result, not the standings table: a faction
 * nobody has rated yet still appears, at 0/0. Hidden factions are filtered out
 * for everyone who cannot unhide them, so a player never sees a gap they have
 * no way to explain.
 */
export async function listStandingsAs(
  actor: User,
  constraints: CampaignConstraints = {},
): Promise<ServiceResult<FactionStanding[]>> {
  if (!can(actor, "standing:read")) return fail("Forbidden", 403);

  const [allegiances, stored] = await Promise.all([getAllAllegiances(), getStandings()]);
  const canSeeHidden = can(actor, "standing:update") && !constraints.excludeHidden;

  const standings = allegiances.map((a): FactionStanding => {
    const row = stored.get(a.slug);
    return {
      slug: a.slug,
      name: a.name,
      color: a.color,
      logoUrl: a.logoUrl,
      red: row?.red ?? 0,
      green: row?.green ?? 0,
      hidden: row?.hidden ?? false,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });

  return ok(canSeeHidden ? standings : standings.filter((s) => !s.hidden));
}

/**
 * Writes one faction's standing.
 *
 * Fields are patched against the current row, so the bar can send just `red`
 * and the hide toggle just `hidden` without either clobbering the other.
 */
export async function updateStandingAs(
  actor: User,
  slug: string,
  input: { red?: unknown; green?: unknown; hidden?: unknown },
): Promise<ServiceResult<FactionStanding>> {
  if (!can(actor, "standing:update")) return fail("Forbidden", 403);

  const allegiances = await getAllAllegiances();
  const allegiance = allegiances.find((a) => a.slug === slug);
  if (!allegiance) return fail("Unknown faction", 404);

  if (input.red === undefined && input.green === undefined && input.hidden === undefined) {
    return fail("Nothing to update", 400);
  }
  if (input.red !== undefined && !isValidCells(input.red)) {
    return fail("red must be an integer from 0 to 4", 400);
  }
  if (input.green !== undefined && !isValidCells(input.green)) {
    return fail("green must be an integer from 0 to 4", 400);
  }
  if (input.hidden !== undefined && typeof input.hidden !== "boolean") {
    return fail("hidden must be a boolean", 400);
  }

  const stored = await getStandings();
  const current = stored.get(slug);

  const row = await setStanding(
    slug,
    {
      red: (input.red as number | undefined) ?? current?.red ?? 0,
      green: (input.green as number | undefined) ?? current?.green ?? 0,
      hidden: (input.hidden as boolean | undefined) ?? current?.hidden ?? false,
    },
    actor.username,
  );

  return ok({
    slug: allegiance.slug,
    name: allegiance.name,
    color: allegiance.color,
    logoUrl: allegiance.logoUrl,
    red: row.red,
    green: row.green,
    hidden: row.hidden,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  });
}

/* ----------------------------------------------------------------- vips */

/**
 * Whether this actor may see this VIP at all.
 *
 * Separate from `can()` because it is per-record rather than per-action: the
 * bar is stored on the row. Every VIP read and write funnels through it, so a
 * restricted subject cannot be reached by guessing its slug.
 */
function canSeeVip(actor: User, vip: VipRow): boolean {
  return actor.accessLevel >= vip.minAccessLevel;
}

async function toVip(row: VipRow): Promise<Vip> {
  const entity =
    row.kankaEntityId !== null ? await getKankaEntityByEntityId(row.kankaEntityId) : null;

  // Falls back to the row's own name rather than failing: the tracker's job is
  // to show integrity, and a Kanka sync that has not run yet must not blank the
  // panel that says whether the campaign is still alive.
  const dossier: VipDossier = {
    name: entity?.name ?? row.name,
    title: entity?.title ?? null,
    imageUrl: entity?.imageUrl ?? null,
    kankaUrl: row.kankaEntityId !== null ? kankaEntityUrl(row.kankaEntityId) : null,
  };

  return {
    slug: row.slug,
    name: row.name,
    blurb: row.blurb,
    tagline: row.tagline,
    cells: row.cells,
    minAccessLevel: row.minAccessLevel,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    dossier,
  };
}

/** The VIPs this actor may see, in display order, dossiers attached. */
export async function listVipsAs(actor: User): Promise<ServiceResult<Vip[]>> {
  if (!can(actor, "vip:read")) return fail("Forbidden", 403);
  const rows = (await getVips()).filter((row) => canSeeVip(actor, row));
  return ok(await Promise.all(rows.map(toVip)));
}

/**
 * Flips one cell of a VIP's integrity cluster.
 *
 * One cell per call, by index — the cluster is edited by clicking the cell that
 * failed, and the whole point of storing a mask is that the other nine keep
 * whatever state they had.
 */
export async function setVipCellAs(
  actor: User,
  slug: string,
  input: { cell: unknown; intact: unknown },
): Promise<ServiceResult<Vip>> {
  if (!can(actor, "vip:update")) return fail("Forbidden", 403);
  if (!isValidCellIndex(input.cell)) return fail("cell must be an integer from 0 to 9", 400);
  if (typeof input.intact !== "boolean") return fail("intact must be a boolean", 400);

  const existing = await getVip(slug);
  // Reported as missing rather than forbidden: whether a restricted VIP exists
  // is itself the secret being kept.
  if (!existing || !canSeeVip(actor, existing)) return fail("Not found", 404);

  const row = await setVipCell(slug, input.cell, input.intact, actor.username);
  if (!row) return fail("Not found", 404);
  return ok(await toVip(row));
}

/**
 * Locks or unlocks a VIP.
 *
 * Locked means superadmin-only; unlocked means every logged-in player sees the
 * subject and its anonymity log. Deliberately a superadmin-only action even
 * though it only ever *widens* or *narrows* visibility — unlocking a subject
 * publishes a secret to the whole table, which is a GM decision, not an admin
 * convenience.
 */
export async function setVipAccessAs(
  actor: User,
  slug: string,
  locked: unknown,
): Promise<ServiceResult<Vip>> {
  if (!can(actor, "vip:setAccess")) return fail("Forbidden", 403);
  if (typeof locked !== "boolean") return fail("locked must be a boolean", 400);

  const existing = await getVip(slug);
  if (!existing || !canSeeVip(actor, existing)) return fail("Not found", 404);

  const row = await setVipAccess(slug, locked ? ACCESS.SUPERADMIN : ACCESS.PLAYER, actor.username);
  if (!row) return fail("Not found", 404);
  return ok(await toVip(row));
}

/**
 * Rewrites a VIP's description.
 *
 * An empty string is a valid value — clearing the note is a normal edit, and
 * the panel simply renders nothing rather than leaving a gap.
 */
export async function setVipBlurbAs(
  actor: User,
  slug: string,
  blurb: unknown,
): Promise<ServiceResult<Vip>> {
  if (!can(actor, "vip:setBlurb")) return fail("Forbidden", 403);
  if (typeof blurb !== "string") return fail("blurb must be a string", 400);

  const trimmed = blurb.trim();
  if (trimmed.length > VIP_BLURB_MAX) {
    return fail(`Keep it under ${VIP_BLURB_MAX} characters`, 400);
  }

  const existing = await getVip(slug);
  if (!existing || !canSeeVip(actor, existing)) return fail("Not found", 404);

  const row = await setVipBlurb(slug, trimmed, actor.username);
  if (!row) return fail("Not found", 404);
  return ok(await toVip(row));
}

/**
 * Rewrites the editable half of a VIP's eyebrow.
 *
 * Only the second half is data — the panel prints a constant "Unique Asset"
 * before it, because that part is true of every VIP by definition of being on
 * this page. An empty tagline is valid and drops the separator with it.
 */
export async function setVipTaglineAs(
  actor: User,
  slug: string,
  tagline: unknown,
): Promise<ServiceResult<Vip>> {
  if (!can(actor, "vip:setTagline")) return fail("Forbidden", 403);
  if (typeof tagline !== "string") return fail("tagline must be a string", 400);

  const trimmed = tagline.trim();
  if (trimmed.length > VIP_TAGLINE_MAX) {
    return fail(`Keep it under ${VIP_TAGLINE_MAX} characters`, 400);
  }

  const existing = await getVip(slug);
  if (!existing || !canSeeVip(actor, existing)) return fail("Not found", 404);

  const row = await setVipTagline(slug, trimmed, actor.username);
  if (!row) return fail("Not found", 404);
  return ok(await toVip(row));
}

/* ----------------------------------------------------- anonymity log */

function validateText(input: unknown): ServiceResult<string> {
  if (typeof input !== "string") return fail("text must be a string", 400);
  const trimmed = input.trim();
  if (trimmed.length === 0) return fail("Write something first", 400);
  if (trimmed.length > ANONYMITY_TEXT_MAX) {
    return fail(`Keep it under ${ANONYMITY_TEXT_MAX} characters`, 400);
  }
  return ok(trimmed);
}

/** Helper: the VIP if the actor may see it, else null. */
async function visibleVip(actor: User, slug: string): Promise<VipRow | null> {
  const vip = await getVip(slug);
  return vip && canSeeVip(actor, vip) ? vip : null;
}

/**
 * Every log line the actor may read, across all VIPs they can see.
 *
 * Scoped by VIP visibility, not just filtered in the UI — a player must not be
 * able to read a restricted subject's log by calling the endpoint directly.
 */
export async function listAnonymityAs(
  actor: User,
): Promise<ServiceResult<AnonymityEntry[]>> {
  if (!can(actor, "anonymity:read")) return fail("Forbidden", 403);
  const visible = (await getVips()).filter((v) => canSeeVip(actor, v)).map((v) => v.slug);
  return ok(await getAnonymityEntries(visible));
}

export async function createAnonymityAs(
  actor: User,
  vipSlug: string,
  input: { kind: unknown; text: unknown },
): Promise<ServiceResult<AnonymityEntry>> {
  if (!can(actor, "anonymity:create")) return fail("Forbidden", 403);

  const vip = await visibleVip(actor, vipSlug);
  if (!vip) return fail("Not found", 404);

  if (!ANONYMITY_KINDS.includes(input.kind as AnonymityKind)) {
    return fail("kind must be 'confirmed' or 'suspicion'", 400);
  }
  const text = validateText(input.text);
  if (!text.ok) return text;

  return ok(
    await createAnonymityEntry({
      vipSlug: vip.slug,
      kind: input.kind as AnonymityKind,
      text: text.data,
      createdBy: actor.username,
    }),
  );
}

/**
 * Rewrites a line.
 *
 * Deliberately not ownership-scoped: the log is a shared board, and a player
 * correcting someone else's suspicion is the normal case, not an abuse of it.
 * `kind` is immutable — moving a line between the confirmed and suspected
 * tables changes what it asserts, so it is a delete and a re-add.
 */
export async function updateAnonymityAs(
  actor: User,
  id: number,
  text: unknown,
): Promise<ServiceResult<AnonymityEntry>> {
  if (!can(actor, "anonymity:update")) return fail("Forbidden", 403);
  if (!Number.isInteger(id) || id < 1) return fail("Invalid id", 400);

  const existing = await getAnonymityEntry(id);
  // The line's VIP decides reachability: without this a player could edit a
  // restricted subject's log by guessing an id.
  if (!existing || !(await visibleVip(actor, existing.vipSlug))) return fail("Not found", 404);

  const validated = validateText(text);
  if (!validated.ok) return validated;

  const entry = await updateAnonymityEntry(id, validated.data, actor.username);
  if (!entry) return fail("Not found", 404);
  return ok(entry);
}

export async function deleteAnonymityAs(
  actor: User,
  id: number,
): Promise<ServiceResult<void>> {
  if (!can(actor, "anonymity:delete")) return fail("Forbidden", 403);
  if (!Number.isInteger(id) || id < 1) return fail("Invalid id", 400);

  const existing = await getAnonymityEntry(id);
  if (!existing || !(await visibleVip(actor, existing.vipSlug))) return fail("Not found", 404);

  await deleteAnonymityEntry(id);
  return ok(undefined);
}
