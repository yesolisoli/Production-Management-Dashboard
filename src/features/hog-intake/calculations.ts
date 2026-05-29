import {
  YIELD_HOG_TYPES,
  type HogCounts,
  type HogIntakeRecord,
  type NextDay,
} from "./types";

// Sum of every hog_counts value (all types).
export function totalHogs(counts: HogCounts): number {
  return (
    counts.JP +
    counts.RWA +
    counts.BK +
    counts.Sow +
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

// Only JP, RWA, BK, Sow contribute. Round / Suckling / Customer excluded.
export function yieldTotal(counts: HogCounts): number {
  return YIELD_HOG_TYPES.reduce((sum, key) => sum + counts[key], 0);
}

export function projectedForCutting(nextDay: NextDay): number {
  return nextDay.hog_count - hogsConsumedBySideOrders(nextDay.side_orders);
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
