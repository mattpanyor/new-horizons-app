// Data access for the campaign trackers. No permission logic lives here — see
// lib/campaign/service.ts.

import { neon } from "@neondatabase/serverless";
import type { AnonymityEntry, AnonymityKind } from "@/types/campaign";

const sql = neon(process.env.DATABASE_URL!);

/* ------------------------------------------------------------ standings */

export interface StandingRow {
  slug: string;
  red: number;
  green: number;
  hidden: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

function rowToStanding(row: Record<string, unknown>): StandingRow {
  return {
    slug: row.allegiance_slug as string,
    red: Number(row.red),
    green: Number(row.green),
    hidden: row.hidden as boolean,
    updatedAt: String(row.updated_at),
    updatedBy: (row.updated_by as string) ?? null,
  };
}

/**
 * Every stored standing, keyed by faction slug.
 *
 * Factions with no row are absent rather than defaulted — the caller merges
 * against the allegiance list, because only it knows which factions exist.
 */
export async function getStandings(): Promise<Map<string, StandingRow>> {
  const rows = await sql`
    SELECT allegiance_slug, red, green, hidden, updated_at, updated_by
    FROM faction_standings
  `;
  return new Map(rows.map((r) => [r.allegiance_slug as string, rowToStanding(r)]));
}

/**
 * Writes a standing, creating the row if this is the faction's first.
 *
 * Takes all three fields rather than patching: the caller has already resolved
 * them against the current row, and a partial upsert would need a second read
 * inside the statement to know what to keep.
 */
export async function setStanding(
  slug: string,
  fields: { red: number; green: number; hidden: boolean },
  updatedBy: string,
): Promise<StandingRow> {
  const rows = await sql`
    INSERT INTO faction_standings (allegiance_slug, red, green, hidden, updated_by, updated_at)
    VALUES (${slug}, ${fields.red}, ${fields.green}, ${fields.hidden}, ${updatedBy}, NOW())
    ON CONFLICT (allegiance_slug) DO UPDATE SET
      red        = EXCLUDED.red,
      green      = EXCLUDED.green,
      hidden     = EXCLUDED.hidden,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING allegiance_slug, red, green, hidden, updated_at, updated_by
  `;
  return rowToStanding(rows[0]);
}

/* ----------------------------------------------------------------- vips */

export interface VipRow {
  slug: string;
  name: string;
  kankaEntityId: number | null;
  blurb: string;
  tagline: string;
  cells: number;
  minAccessLevel: number;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string | null;
}

function rowToVip(row: Record<string, unknown>): VipRow {
  return {
    slug: row.slug as string,
    name: row.name as string,
    kankaEntityId: (row.kanka_entity_id as number) ?? null,
    blurb: (row.blurb as string) ?? "",
    tagline: (row.tagline as string) ?? "",
    cells: Number(row.cells),
    minAccessLevel: Number(row.min_access_level),
    sortOrder: Number(row.sort_order),
    updatedAt: String(row.updated_at),
    updatedBy: (row.updated_by as string) ?? null,
  };
}

/** Every VIP, in display order. Access filtering is the service's job. */
export async function getVips(): Promise<VipRow[]> {
  const rows = await sql`
    SELECT slug, name, kanka_entity_id, blurb, tagline, cells, min_access_level,
           sort_order, updated_at, updated_by
    FROM vips
    ORDER BY sort_order, slug
  `;
  return rows.map(rowToVip);
}

export async function getVip(slug: string): Promise<VipRow | null> {
  const rows = await sql`
    SELECT slug, name, kanka_entity_id, blurb, tagline, cells, min_access_level,
           sort_order, updated_at, updated_by
    FROM vips WHERE slug = ${slug}
  `;
  return rows.length > 0 ? rowToVip(rows[0]) : null;
}

/**
 * Flips one cell of the integrity mask, in the database.
 *
 * The bit is set or cleared in SQL rather than by writing a whole mask the
 * caller computed from a stale read — two GMs toggling different cells at the
 * same moment would otherwise have one overwrite the other's cell.
 */
export async function setVipCell(
  slug: string,
  index: number,
  intact: boolean,
  updatedBy: string,
): Promise<VipRow | null> {
  // Both operands are cast explicitly: an untyped parameter leaves Postgres
  // unable to choose between bitwise NOT and the regex-match operator, which
  // are both spelled `~` ("operator is not unique: ~ unknown").
  const bit = 1 << index;
  const rows = intact
    ? await sql`
        UPDATE vips
        SET cells = cells | ${bit}::integer, updated_by = ${updatedBy}, updated_at = NOW()
        WHERE slug = ${slug}
        RETURNING slug, name, kanka_entity_id, blurb, tagline, cells, min_access_level,
                  sort_order, updated_at, updated_by
      `
    : await sql`
        UPDATE vips
        SET cells = cells & ~(${bit}::integer), updated_by = ${updatedBy}, updated_at = NOW()
        WHERE slug = ${slug}
        RETURNING slug, name, kanka_entity_id, blurb, tagline, cells, min_access_level,
                  sort_order, updated_at, updated_by
      `;
  return rows.length > 0 ? rowToVip(rows[0]) : null;
}

/**
 * Sets the access level a VIP is gated behind.
 *
 * Stored as the level itself rather than a boolean so the column keeps its
 * range — a VIP could be opened to admins only (66) later without a migration.
 * The UI currently offers the two ends of it, locked and open.
 */
export async function setVipAccess(
  slug: string,
  minAccessLevel: number,
  updatedBy: string,
): Promise<VipRow | null> {
  const rows = await sql`
    UPDATE vips
    SET min_access_level = ${minAccessLevel}, updated_by = ${updatedBy}, updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING slug, name, kanka_entity_id, blurb, tagline, cells, min_access_level,
              sort_order, updated_at, updated_by
  `;
  return rows.length > 0 ? rowToVip(rows[0]) : null;
}

export async function setVipTagline(
  slug: string,
  tagline: string,
  updatedBy: string,
): Promise<VipRow | null> {
  const rows = await sql`
    UPDATE vips
    SET tagline = ${tagline}, updated_by = ${updatedBy}, updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING slug, name, kanka_entity_id, blurb, tagline, cells, min_access_level,
              sort_order, updated_at, updated_by
  `;
  return rows.length > 0 ? rowToVip(rows[0]) : null;
}

export async function setVipBlurb(
  slug: string,
  blurb: string,
  updatedBy: string,
): Promise<VipRow | null> {
  const rows = await sql`
    UPDATE vips
    SET blurb = ${blurb}, updated_by = ${updatedBy}, updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING slug, name, kanka_entity_id, blurb, tagline, cells, min_access_level,
              sort_order, updated_at, updated_by
  `;
  return rows.length > 0 ? rowToVip(rows[0]) : null;
}

/* ------------------------------------------------------- anonymity log */

function rowToEntry(row: Record<string, unknown>): AnonymityEntry {
  return {
    id: row.id as number,
    vipSlug: row.vip_slug as string,
    kind: row.kind as AnonymityKind,
    text: row.text as string,
    createdBy: row.created_by as string,
    createdAt: String(row.created_at),
    updatedBy: (row.updated_by as string) ?? null,
    updatedAt: String(row.updated_at),
  };
}

/**
 * Every log line for the named VIPs, oldest first — the log reads as a record
 * of order. One query covers all tabs, since the page loads them together.
 */
export async function getAnonymityEntries(vipSlugs: string[]): Promise<AnonymityEntry[]> {
  if (vipSlugs.length === 0) return [];
  const rows = await sql`
    SELECT id, vip_slug, kind, text, created_by, created_at, updated_by, updated_at
    FROM anonymity_entries
    WHERE vip_slug = ANY(${vipSlugs})
    ORDER BY vip_slug, kind, created_at, id
  `;
  return rows.map(rowToEntry);
}

export async function getAnonymityEntry(id: number): Promise<AnonymityEntry | null> {
  const rows = await sql`
    SELECT id, vip_slug, kind, text, created_by, created_at, updated_by, updated_at
    FROM anonymity_entries WHERE id = ${id}
  `;
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export async function createAnonymityEntry(input: {
  vipSlug: string;
  kind: AnonymityKind;
  text: string;
  createdBy: string;
}): Promise<AnonymityEntry> {
  const rows = await sql`
    INSERT INTO anonymity_entries (vip_slug, kind, text, created_by)
    VALUES (${input.vipSlug}, ${input.kind}, ${input.text}, ${input.createdBy})
    RETURNING id, vip_slug, kind, text, created_by, created_at, updated_by, updated_at
  `;
  return rowToEntry(rows[0]);
}

/**
 * Rewrites a line's text.
 *
 * `updated_by` is stored even when the author edits their own line, so the UI
 * can distinguish "never touched" from "touched by its author" — it only shows
 * the second hand when it differs from the first.
 */
export async function updateAnonymityEntry(
  id: number,
  text: string,
  updatedBy: string,
): Promise<AnonymityEntry | null> {
  const rows = await sql`
    UPDATE anonymity_entries
    SET text = ${text}, updated_by = ${updatedBy}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, vip_slug, kind, text, created_by, created_at, updated_by, updated_at
  `;
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export async function deleteAnonymityEntry(id: number): Promise<void> {
  await sql`DELETE FROM anonymity_entries WHERE id = ${id}`;
}
