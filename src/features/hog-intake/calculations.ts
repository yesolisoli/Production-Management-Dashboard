import {
  YIELD_HOG_TYPES,
  type HogCounts,
  type HogIntakeRecord,
  type NextDay,
} from "./types";

// Sum of the hog_counts that count toward intake. Sow is excluded — it's a
// reference-only figure and never feeds Total Hogs (and therefore not For
// Cutting either).
export function totalHogs(counts: HogCounts): number {
  return (
    counts.JP +
    counts.RWA +
    counts.BK +
    counts.Round +
    counts.Suckling +
    counts.Customer
  );
}

// One hog yields up to 2 side orders, so each pair of side orders consumes
// one hog (rounded up for odd counts).
export function hogsConsumedBySideOrders(sideOrders: number): number {
  return Math.ceil(sideOrders / 2);
}

// total_hogs - hogs consumed by side orders. Can be negative when side orders
// outstrip available hogs; the UI surfaces that as a warning rather than blocking save.
export function forCutting(counts: HogCounts, sideOrders: number): number {
  return totalHogs(counts) - hogsConsumedBySideOrders(sideOrders);
}

// Only JP, RWA, BK contribute. Sow / Round / Suckling / Customer excluded.
export function yieldTotal(counts: HogCounts): number {
  return YIELD_HOG_TYPES.reduce((sum, key) => sum + counts[key], 0);
}

export function projectedForCutting(nextDay: NextDay): number {
  return (
    nextDay.hog_count -
    hogsConsumedBySideOrders(nextDay.side_orders) +
    nextDay.cooler_overstock
  );
}

// Pieces produced per yield hog (one hog → 2 of each primal piece, e.g.
// 2 loins). Canonical home for the factor — primal-calc reuses it so the
// "× 2" rule lives in exactly one place.
export const PIECES_PER_HOG = 2;

// Loins produced from a yield-hog count.
export function expectedLoins(yieldCount: number): number {
  return yieldCount * PIECES_PER_HOG;
}

// Loins available tomorrow = today's expected loin production plus loins
// already held in the cooler. Sales uses this to decide how many orders
// tomorrow can absorb.
export function loinsAvailableTomorrow(
  yieldCount: number,
  coolerOverstock: number,
): number {
  return expectedLoins(yieldCount) + coolerOverstock;
}

export type HogIntakeTotals = {
  totalHogs: number;
  forCutting: number;
  yieldTotal: number;
  projectedForCutting: number;
  overSold: boolean; // side_orders > total_hogs
};

export function deriveTotals(record: HogIntakeRecord): HogIntakeTotals {
  const total = totalHogs(record.hog_counts);
  const consumed = hogsConsumedBySideOrders(record.side_orders);
  return {
    totalHogs: total,
    forCutting: total - consumed,
    yieldTotal: yieldTotal(record.hog_counts),
    projectedForCutting: projectedForCutting(record.next_day),
    overSold: consumed > total,
  };
}

// Clamp a free-form numeric input to a non-negative integer. Used at
// every input boundary so negative numbers can never enter state.
export function clampNonNegativeInt(value: number | string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}
