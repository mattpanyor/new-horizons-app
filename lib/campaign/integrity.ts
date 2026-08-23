// The VIP integrity mask: which cells of the hex cluster are still intact.
//
// Stored as a single 10-bit integer (bit i set = cell i intact) rather than a
// count, because the cluster is edited one cell at a time — the GM clicks the
// cell that failed — so *which* cells are gone is real information. A count
// would force the display to invent an order, and clicking any cell would then
// darken cells elsewhere in the honeycomb.
//
// Pure and dependency-free: the browser toggles cells with these functions and
// the service validates writes with them, so the two can never disagree.

/** Cells in the honeycomb. Fixed at 10 — the 3-4-3 layout is drawn for it. */
export const INTEGRITY_CELLS = 10;

/** Every cell intact: 0b1111111111. */
export const ALL_CELLS_INTACT = (1 << INTEGRITY_CELLS) - 1;

export function isCellIntact(cells: number, index: number): boolean {
  return (cells & (1 << index)) !== 0;
}

/** How many cells are left — the number the status tier is read from. */
export function countIntact(cells: number): number {
  let n = 0;
  for (let i = 0; i < INTEGRITY_CELLS; i++) if (isCellIntact(cells, i)) n++;
  return n;
}

/** The mask with one cell forced to a state. Returns a new value. */
export function withCell(cells: number, index: number, intact: boolean): number {
  return intact ? cells | (1 << index) : cells & ~(1 << index);
}

export function isValidCellMask(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= ALL_CELLS_INTACT;
}

export function isValidCellIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < INTEGRITY_CELLS;
}

export interface IntegrityTier {
  label: string;
  color: string;
  glow: string;
  /** Below this the surviving cells pulse. */
  alarm: boolean;
}

/** The status tier for a number of intact cells. */
export function integrityTier(intact: number): IntegrityTier {
  if (intact <= 0) {
    return { label: "Terminated", color: "#7f1d1d", glow: "rgba(127,29,29,0)", alarm: false };
  }
  if (intact <= 4) {
    return { label: "Critical", color: "#f87171", glow: "rgba(248,113,113,0.65)", alarm: true };
  }
  if (intact <= 7) {
    return { label: "Degraded", color: "#fbbf24", glow: "rgba(251,191,36,0.55)", alarm: false };
  }
  return { label: "Nominal", color: "#34d399", glow: "rgba(52,211,153,0.5)", alarm: false };
}
