// Investigation policy layer — the single source of truth for who may do what
// to chapters and clues.
//
// Every caller goes through here: the web route handlers under
// app/api/investigation and app/api/admin/investigation, and the MCP tools in
// lib/mcp/modules/investigation.ts. That is the whole point of the module — a
// rule added here (say, "players may not add clues to past chapters") takes
// effect in the browser and for every connected AI client at the same time,
// with no chance of the two drifting apart.
//
// Functions return a ServiceResult rather than throwing or returning a
// Response, so each caller maps the outcome onto its own transport: the routes
// turn `status` into a NextResponse code, the MCP tools turn `error` into a
// tool error.
//
// Field-shape rules (length limits, valid faction slugs) live in ./validation.

import type { User } from "@/lib/db/users";
import { getUserByUsername } from "@/lib/db/users";
import type { Chapter, Clue } from "@/types/investigation";
import {
  getCluesByChapter,
  getClueById,
  createClue,
  updateClue,
  deleteClue,
  searchClues,
  type ClueFilters,
} from "@/lib/db/clues";
import {
  getAllChapters,
  getChapter,
  getCurrentChapter,
  createChapter,
  renameChapter,
  deleteChapter,
  getClueCountByChapter,
} from "@/lib/db/chapters";
import {
  sanitizeFactionSlugs,
  validateChapterTitle,
  validateClueText,
} from "./validation";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

/**
 * Extra restrictions a *calling surface* may impose on top of the app's rules.
 *
 * These only ever narrow, never widen — the access-level rules in `can()`
 * remain the ceiling. This is the same direction token scopes work: the app
 * decides the maximum, a surface may ask for less.
 *
 * Used by the MCP tools, where an AI acting on a vague instruction could
 * otherwise rewrite many players' clues in a single turn. The web board keeps
 * its existing behaviour, where any player may edit any clue.
 */
export interface ActorConstraints {
  /** Refuse writes to records the actor did not author, whatever their level. */
  ownRecordsOnly?: boolean;
}

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T = never>(error: string, status: number): ServiceResult<T> {
  return { ok: false, error, status };
}

/** Access levels, matching the app's convention: 0 player, 66 admin, 127 superadmin. */
export const ACCESS = { PLAYER: 0, ADMIN: 66, SUPERADMIN: 127 } as const;

export type InvestigationAction =
  | "chapter:read"
  | "chapter:create"
  | "chapter:rename"
  | "chapter:delete"
  | "clue:read"
  | "clue:create"
  | "clue:update"
  | "clue:delete"
  | "clue:setAuthor";

// Exported so the MCP registry can build a user's tool list from the same rules
// that enforce the checks — a tool the caller could never successfully invoke
// is never advertised to them in the first place.
export function can(actor: User, action: InvestigationAction): boolean {
  switch (action) {
    // Any authenticated user. Note that clue:update is deliberately not
    // ownership-scoped: the web UI has always let any logged-in player edit any
    // clue, and this preserves that.
    case "chapter:read":
    case "clue:read":
    case "clue:create":
    case "clue:update":
      return true;
    case "clue:delete":
      return actor.accessLevel >= ACCESS.ADMIN;
    case "chapter:create":
    case "chapter:rename":
    case "chapter:delete":
    case "clue:setAuthor":
      return actor.accessLevel >= ACCESS.SUPERADMIN;
  }
}

// Resolves the faction list for a write. Players must tag at least one faction;
// superadmins may leave it empty, which is what the admin panel has always
// allowed for backfilling untagged clues.
function resolveFactionSlugs(
  actor: User,
  input: unknown
): ServiceResult<string[]> {
  const slugs = sanitizeFactionSlugs(input ?? []);
  if (slugs === null) return fail("Invalid faction slugs", 400);
  if (slugs.length === 0 && !can(actor, "clue:setAuthor")) {
    return fail("Tag at least one faction", 400);
  }
  return ok(slugs);
}

// Resolves the author for a write. Writing as someone else is superadmin-only;
// everyone else is pinned to their own username regardless of what they pass.
async function resolveAuthor(
  actor: User,
  requested: string | undefined
): Promise<ServiceResult<string>> {
  if (requested === undefined || requested === actor.username) {
    return ok(actor.username);
  }
  if (!can(actor, "clue:setAuthor")) {
    return fail("Not allowed to write as another user", 403);
  }
  if (typeof requested !== "string" || requested.trim().length === 0) {
    return fail("Invalid createdBy", 400);
  }
  const author = await getUserByUsername(requested);
  if (!author) return fail("createdBy user not found", 400);
  return ok(author.username);
}

// Resolves the target chapter. Omitted means "the current chapter", matching
// the clue composer on the investigation board.
async function resolveChapter(
  input: number | null | undefined
): Promise<ServiceResult<number>> {
  if (input === undefined || input === null) {
    const current = await getCurrentChapter();
    if (!current) return fail("No chapters exist yet", 400);
    return ok(current.number);
  }
  if (!Number.isInteger(input) || input < 1) return fail("Invalid chapter", 400);
  const exists = await getChapter(input);
  if (!exists) return fail("Chapter does not exist", 400);
  return ok(input);
}

/* ------------------------------------------------------------------ chapters */

export async function listChaptersAs(actor: User): Promise<ServiceResult<Chapter[]>> {
  if (!can(actor, "chapter:read")) return fail("Forbidden", 403);
  return ok(await getAllChapters());
}

export async function listChaptersWithCountsAs(
  actor: User
): Promise<ServiceResult<{ chapters: Chapter[]; clueCounts: Record<number, number> }>> {
  if (!can(actor, "chapter:read")) return fail("Forbidden", 403);
  const [chapters, clueCounts] = await Promise.all([
    getAllChapters(),
    getClueCountByChapter(),
  ]);
  return ok({ chapters, clueCounts });
}

export async function createChapterAs(
  actor: User,
  title: unknown
): Promise<ServiceResult<Chapter>> {
  if (!can(actor, "chapter:create")) return fail("Forbidden", 403);
  const validated = validateChapterTitle(title);
  if (!validated.ok) return fail(validated.error, 400);
  return ok(await createChapter(validated.value));
}

export async function renameChapterAs(
  actor: User,
  number: number,
  title: unknown
): Promise<ServiceResult<Chapter>> {
  if (!can(actor, "chapter:rename")) return fail("Forbidden", 403);
  if (!Number.isInteger(number) || number < 1) {
    return fail("Invalid chapter number", 400);
  }
  const validated = validateChapterTitle(title);
  if (!validated.ok) return fail(validated.error, 400);

  const chapter = await renameChapter(number, validated.value);
  if (!chapter) return fail("Not found", 404);
  return ok(chapter);
}

// Deleting a chapter cascades to its clues (clues.chapter is ON DELETE
// CASCADE), so the destroyed count is reported back — a mistake should be
// visible immediately rather than discovered later.
export async function deleteChapterAs(
  actor: User,
  number: number
): Promise<ServiceResult<{ deletedClues: number }>> {
  if (!can(actor, "chapter:delete")) return fail("Forbidden", 403);
  if (!Number.isInteger(number) || number < 1) {
    return fail("Invalid chapter number", 400);
  }
  const existing = await getChapter(number);
  if (!existing) return fail("Not found", 404);

  const counts = await getClueCountByChapter();
  const deletedClues = counts[number] ?? 0;

  await deleteChapter(number);
  return ok({ deletedClues });
}

/* --------------------------------------------------------------------- clues */

export async function listCluesByChapterAs(
  actor: User,
  chapter: number
): Promise<ServiceResult<Clue[]>> {
  if (!can(actor, "clue:read")) return fail("Forbidden", 403);
  if (!Number.isInteger(chapter) || chapter < 1) return fail("Invalid chapter", 400);
  return ok(await getCluesByChapter(chapter));
}

// Filtered search across chapters. Unlike listCluesByChapterAs this applies a
// result limit, so it is the right entry point for AI callers and the wrong one
// for the board, which renders a whole chapter.
export async function searchCluesAs(
  actor: User,
  filters: ClueFilters
): Promise<ServiceResult<Clue[]>> {
  if (!can(actor, "clue:read")) return fail("Forbidden", 403);
  if (filters.chapter !== undefined) {
    if (!Number.isInteger(filters.chapter) || filters.chapter < 1) {
      return fail("Invalid chapter", 400);
    }
  }
  return ok(await searchClues(filters));
}

export async function getClueAs(actor: User, id: number): Promise<ServiceResult<Clue>> {
  if (!can(actor, "clue:read")) return fail("Forbidden", 403);
  if (!Number.isInteger(id) || id < 1) return fail("Invalid id", 400);
  const clue = await getClueById(id);
  if (!clue) return fail("Not found", 404);
  return ok(clue);
}

export async function createClueAs(
  actor: User,
  input: {
    chapter?: number | null;
    text: unknown;
    factionSlugs?: unknown;
    author?: string;
  }
): Promise<ServiceResult<Clue>> {
  if (!can(actor, "clue:create")) return fail("Forbidden", 403);

  const text = validateClueText(input.text);
  if (!text.ok) return fail(text.error, 400);

  const slugs = resolveFactionSlugs(actor, input.factionSlugs);
  if (!slugs.ok) return slugs;

  const author = await resolveAuthor(actor, input.author);
  if (!author.ok) return author;

  const chapter = await resolveChapter(input.chapter);
  if (!chapter.ok) return chapter;

  return ok(
    await createClue({
      chapter: chapter.data,
      text: text.value,
      factionSlugs: slugs.data,
      createdBy: author.data,
    })
  );
}

export async function updateClueAs(
  actor: User,
  id: number,
  input: { text?: unknown; factionSlugs?: unknown; author?: string },
  constraints: ActorConstraints = {}
): Promise<ServiceResult<Clue>> {
  if (!can(actor, "clue:update")) return fail("Forbidden", 403);
  if (!Number.isInteger(id) || id < 1) return fail("Invalid id", 400);

  const existing = await getClueById(id);
  if (!existing) return fail("Not found", 404);

  if (constraints.ownRecordsOnly && existing.createdBy !== actor.username) {
    return fail(`This clue was written by ${existing.createdBy}; you can only edit your own`, 403);
  }

  const fields: { text?: string; factionSlugs?: string[]; createdBy?: string } = {};

  if (input.text !== undefined) {
    const text = validateClueText(input.text);
    if (!text.ok) return fail(text.error, 400);
    fields.text = text.value;
  }

  if (input.factionSlugs !== undefined) {
    const slugs = resolveFactionSlugs(actor, input.factionSlugs);
    if (!slugs.ok) return slugs;
    fields.factionSlugs = slugs.data;
  }

  if (input.author !== undefined) {
    const author = await resolveAuthor(actor, input.author);
    if (!author.ok) return author;
    fields.createdBy = author.data;
  }

  if (
    fields.text === undefined &&
    fields.factionSlugs === undefined &&
    fields.createdBy === undefined
  ) {
    return fail("Nothing to update", 400);
  }

  const clue = await updateClue(id, fields);
  if (!clue) return fail("Not found", 404);
  return ok(clue);
}

export async function deleteClueAs(actor: User, id: number): Promise<ServiceResult<void>> {
  if (!can(actor, "clue:delete")) return fail("Forbidden", 403);
  if (!Number.isInteger(id) || id < 1) return fail("Invalid id", 400);

  const existing = await getClueById(id);
  if (!existing) return fail("Not found", 404);

  await deleteClue(id);
  return ok(undefined);
}
