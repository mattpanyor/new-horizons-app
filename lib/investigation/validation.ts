// Field-level validation for investigation input.
//
// These rules were previously copy-pasted across the investigation route
// handlers — `sanitizeFactionSlugs` appeared verbatim in three files and the
// clue text limit in four. They live here so the web routes and the MCP tools
// in lib/mcp/modules/investigation.ts enforce identical rules.
//
// This module covers *shape* only — "is this a valid faction slug", "is this
// text too long". Questions of *permission* — who may create a clue, in which
// chapter — belong in lib/investigation/service.ts.

import { ALLEGIANCES } from "@/lib/allegiances";

export const MAX_CLUE_TEXT = 2000;
export const MAX_CHAPTER_TITLE = 200;

// Upper bound on the session number. It is a free, unmanaged integer — there is
// no session table and no sequence — so this only exists to reject typos and
// junk, not to say anything about how many sessions the campaign has.
export const MAX_SESSION_NUMBER = 9999;

const VALID_FACTION_SLUGS = new Set(Object.keys(ALLEGIANCES));

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function isValidFactionSlug(slug: string): boolean {
  return VALID_FACTION_SLUGS.has(slug);
}

export function allFactionSlugs(): string[] {
  return Object.keys(ALLEGIANCES);
}

// Returns null when the input is not an array of known slugs. Duplicates are
// dropped, order is preserved.
export function sanitizeFactionSlugs(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") return null;
    if (!VALID_FACTION_SLUGS.has(v)) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function validateClueText(input: unknown): FieldResult<string> {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { ok: false, error: "Text is required" };
  }
  const trimmed = input.trim();
  if (trimmed.length > MAX_CLUE_TEXT) {
    return { ok: false, error: `Text must be ${MAX_CLUE_TEXT} characters or fewer` };
  }
  return { ok: true, value: trimmed };
}

/**
 * The game session a clue was discovered in. Optional everywhere in the data
 * model: `null`, `undefined` and `""` all mean "not recorded", which is what
 * every clue written before this field existed has.
 *
 * Surfaces that need it *supplied* enforce that themselves — the MCP create
 * tool does, via ActorConstraints in ../investigation/service.ts. This function
 * only answers whether a given value is a usable session number.
 *
 * Accepts a numeric string so form bodies can be passed through unparsed.
 */
export function validateSessionNumber(input: unknown): FieldResult<number | null> {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input === "string" && input.trim() === "") return { ok: true, value: null };

  const n = typeof input === "string" ? Number(input.trim()) : input;
  if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > MAX_SESSION_NUMBER) {
    return {
      ok: false,
      error: `Session must be a whole number between 1 and ${MAX_SESSION_NUMBER}`,
    };
  }
  return { ok: true, value: n as number };
}

export function validateChapterTitle(input: unknown): FieldResult<string> {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { ok: false, error: "Title is required" };
  }
  const trimmed = input.trim();
  if (trimmed.length > MAX_CHAPTER_TITLE) {
    return { ok: false, error: `Title must be ${MAX_CHAPTER_TITLE} characters or fewer` };
  }
  return { ok: true, value: trimmed };
}

export function validateChapterNumber(input: unknown): FieldResult<number> {
  if (!Number.isInteger(input) || (input as number) < 1) {
    return { ok: false, error: "Invalid chapter" };
  }
  return { ok: true, value: input as number };
}

export function validateId(input: unknown): FieldResult<number> {
  if (!Number.isInteger(input) || (input as number) < 1) {
    return { ok: false, error: "Invalid id" };
  }
  return { ok: true, value: input as number };
}
