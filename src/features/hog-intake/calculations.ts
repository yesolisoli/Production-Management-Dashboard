import {
  FARM_DERIVED_HOG_TYPES,
  HOG_TYPES,
  YIELD_HOG_TYPES,
  type FarmDerivedHogType,
  type FarmRecord,
  type HogCounts,
  type HogIntakeRecord,
  type HogType,
  type NextDay,
} from "./types";

const FARM_DERIVED_SET = new Set<string>(FARM_DERIVED_HOG_TYPES);

// Farm Delivery Records are the single entry point for delivered hogs that roll
// up — JP / RWA / BK sum from the rows and are read-only in the grid. Sow, Round,
// Suckling and Customer stay manual on their own cards. Only JP / RWA feed Primal
// Calc (see yieldTotal); BK is summed here but shown separately.
export function derivedCountsFromFarmRecords(
  records: FarmRecord[],
): Record<FarmDerivedHogType, number> {
  const counts = Object.fromEntries(
    FARM_DERIVED_HOG_TYPES.map((type) => [type, 0]),
  ) as Record<FarmDerivedHogType, number>;
  for (const row of records) {
    if (row.type && FARM_DERIVED_SET.has(row.type)) {
      counts[row.type as FarmDerivedHogType] += row.count;
    }
  }
  return counts;
}

// Sum of farm-delivery counts for a single hog type — works for any type, even
// ones that don't roll up into hogCounts (e.g. Sow, whose stored count is the
// weekly Available tracked separately). Display-only roll-up for the footer.
export function farmRecordCountForType(
  records: FarmRecord[],
  type: HogType,
): number {
  return records.reduce(
    (sum, row) => sum + (row.type === type ? row.count : 0),
    0,
  );
}

// Total Hog — the sum of every hog type, including Sow. Side orders are NOT
// part of this figure; they are cut out of it to get For Cutting Today.
export function totalHogs(counts: HogCounts): number {
  return HOG_TYPES.reduce((sum, type) => sum + counts[type], 0);
}

// Two side orders come from one hog, so each pair consumes one hog (rounded
// up for an odd count).
export function hogsConsumedBySideOrders(sideOrders: number): number {
  return Math.ceil(sideOrders / 2);
}

// Total Intake is the all-in Total Hog figure (all types incl. Sow). Side
// orders do not add to it. Broader than Primal Calc (yield: JP + RWA only).
export function totalIntake(counts: HogCounts): number {
  return totalHogs(counts);
}

// Total Hog minus the hogs consumed by side orders (2 side orders = 1 hog) —
// e.g. 109 hogs with 28 side orders leaves 109 - 14 = 95 to cut.
export function forCutting(counts: HogCounts, sideOrders: number): number {
  return totalIntake(counts) - hogsConsumedBySideOrders(sideOrders);
}

// Only JP, RWA contribute. BK / Sow / Round / Suckling / Customer excluded.
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

export type HogIntakeTotals = {
  totalIntake: number; // Total Hog: all hog types incl. Sow (no side orders)
  totalHogs: number;
  forCutting: number;
  yieldTotal: number;
  projectedForCutting: number;
  overSold: boolean; // hogs consumed by side orders exceed total intake
};

export function deriveTotals(record: HogIntakeRecord): HogIntakeTotals {
  const counts = record.hog_counts;
  const total = totalIntake(counts);
  const consumed = hogsConsumedBySideOrders(record.side_orders);
  return {
    totalIntake: total,
    totalHogs: total,
    forCutting: total - consumed,
    yieldTotal: yieldTotal(counts),
    projectedForCutting: projectedForCutting(record.next_day),
    overSold: consumed > total,
  };
}

// Sow inventory rolls forward day to day: today's "Remaining After Cutting"
// (what's left once the day's cutting is taken) seeds the next day's
// "Available This Week". Centralized so the card display and the carry-over
// computation can never diverge.
export function sowRemaining(available: number, cutting: number): number {
  return Math.max(0, available - cutting);
}

// Clamp a free-form numeric input to a non-negative integer. Used at
// every input boundary so negative numbers can never enter state.
export function clampNonNegativeInt(value: number | string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}
