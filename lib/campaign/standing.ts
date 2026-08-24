// The standing ladder: turning a (red, green) cell count into the word the
// tracker prints.
//
// Kept pure and separate from the service so the label can be rendered on the
// client from the same table the server validates against — the bar and its
// caption must never disagree.

export const STANDING_MAX = 4;

/** Index 0 is one cell, index 3 is four. */
export const RED_LABELS = ["Meddler", "Suspicious", "Threat", "Enemy"] as const;
export const GREEN_LABELS = ["Tolerated", "Aligned", "Trusted", "Sworn"] as const;

/** No cells on either side: the faction has formed no opinion. */
export const NEUTRAL_LABEL = "Unknown";
/** Equal cells on both sides — the faction is split about the party. */
export const TIE_LABEL = "Divided";

export type StandingTone = "hostile" | "friendly" | "neutral";

export interface StandingVerdict {
  label: string;
  tone: StandingTone;
}

/**
 * The label for a standing.
 *
 * Only the dominant side speaks: 1 red / 2 green reads "Aligned", because two
 * green cells outweigh one red. A tie is its own state rather than a silent
 * fallback to one side.
 */
export function standingVerdict(red: number, green: number): StandingVerdict {
  const r = clampCells(red);
  const g = clampCells(green);
  if (r === 0 && g === 0) return { label: NEUTRAL_LABEL, tone: "neutral" };
  if (r === g) return { label: TIE_LABEL, tone: "neutral" };
  return r > g
    ? { label: RED_LABELS[r - 1], tone: "hostile" }
    : { label: GREEN_LABELS[g - 1], tone: "friendly" };
}

/** One rung of the ladder. `cells` is null for the two middle steps, which are
 * not a count at all — a tie can be struck at any strength, and Unknown is the
 * absence of cells rather than a number of them. */
export interface StandingStep {
  label: string;
  tone: StandingTone;
  cells: number | null;
}

/**
 * The ladder as a spectrum, hostile end first.
 *
 * The tracker groups factions by the word they earn and lays the words out as
 * a scale, so it needs every step in order — including the ones nobody
 * occupies, which are what make the scale readable: an empty "Threat" rung
 * says something the absence of a row would not.
 *
 * Divided sits above Unknown because a tie is a standing that has been earned
 * twice over, and Unknown is no standing at all — the quiet end of the middle
 * is the one nearer regard.
 */
export const STANDING_SPECTRUM: readonly StandingStep[] = [
  ...RED_LABELS.map((label, i): StandingStep => ({
    label,
    tone: "hostile",
    cells: i + 1,
  })).reverse(),
  { label: TIE_LABEL, tone: "neutral", cells: null },
  { label: NEUTRAL_LABEL, tone: "neutral", cells: null },
  ...GREEN_LABELS.map((label, i): StandingStep => ({
    label,
    tone: "friendly",
    cells: i + 1,
  })),
];

/** Where a standing sits on the red-to-green axis, for ordering a row of them.
 *
 * The rung decides the decade, so every Enemy comes before every Threat. Inside
 * a rung the opposing cells break the tie in the direction the axis runs: an
 * Enemy carrying two green sits to the right of one carrying none, and an
 * Aligned carrying a red sits to the left of one that is clean — the further
 * right a card is, the better the party is doing with it.
 */
export function standingOrder(red: number, green: number): number {
  const verdict = standingVerdict(red, green);
  const rung = STANDING_SPECTRUM.findIndex((step) => step.label === verdict.label);
  const lean =
    verdict.tone === "hostile"
      ? clampCells(green)
      : STANDING_MAX - clampCells(red);
  return rung * 10 + lean;
}

/** Coerces anything into a valid cell count. Used by the display, not by writes. */
export function clampCells(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(STANDING_MAX, Math.round(n)));
}

/** Validates a cell count on the way in. Writes must reject, not clamp. */
export function isValidCells(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) <= STANDING_MAX;
}
