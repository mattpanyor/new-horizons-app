import type { FactionCategory } from "@/lib/allegiances";

/** Campaign tracker types — see lib/campaign/service.ts for the rules. */

/**
 * The party's standing with one faction.
 *
 * `red` and `green` are independent 0-4 counts, not two ends of one scale.
 * The displayed label comes from whichever side has more cells; see
 * lib/campaign/standing.ts.
 */
export interface FactionStanding {
  slug: string;
  name: string;
  color: string;
  logoUrl: string | null;
  /** Which section of the board it is dealt into. See lib/allegiances.ts. */
  category: FactionCategory;
  red: number;
  green: number;
  /** Superadmin-only. Hidden factions are dropped from the page for everyone else. */
  hidden: boolean;
  /** Null for a faction nobody has given a standing yet. */
  updatedAt: string | null;
  updatedBy: string | null;
}

/** A VIP's Kanka record, for the portrait and the link out. */
export interface VipDossier {
  name: string;
  title: string | null;
  imageUrl: string | null;
  /** Null when the VIP has no Kanka record. */
  kankaUrl: string | null;
}

/**
 * A campaign-critical NPC. At zero intact cells the campaign ends.
 *
 * Nothing here is specific to any one subject — a replacement or an additional
 * VIP is a row in `vips`, not a code change.
 */
export interface Vip {
  slug: string;
  name: string;
  blurb: string;
  /** Second half of the panel eyebrow, after the constant "Unique Asset —". */
  tagline: string;
  /** 10-bit mask; bit i set means cell i is intact. See lib/campaign/integrity.ts. */
  cells: number;
  /**
   * Minimum access level required to see this VIP at all. A restricted VIP is
   * absent from the tab strip below the bar, and its anonymity log is
   * unreachable — enforced in the service, not just hidden in the UI.
   */
  minAccessLevel: number;
  sortOrder: number;
  updatedAt: string | null;
  updatedBy: string | null;
  dossier: VipDossier;
}

export type AnonymityKind = "confirmed" | "suspicion";

export interface AnonymityEntry {
  id: number;
  /** Which VIP's log this line belongs to. */
  vipSlug: string;
  kind: AnonymityKind;
  text: string;
  createdBy: string;
  createdAt: string;
  /** Null until someone other than the author edits it. */
  updatedBy: string | null;
  updatedAt: string;
}
