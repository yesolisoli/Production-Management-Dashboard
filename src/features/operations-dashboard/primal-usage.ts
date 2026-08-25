import type { HogIntakeRecord } from "@/features/hog-intake/types";
import {
  groupExpectedProduction,
  sumRemainingByGroup,
} from "@/features/primal-calculation/calculations";
import {
  PRIMAL_GROUPS,
  type AllocationsForDate,
  type EndingStockByGroup,
} from "@/features/primal-calculation/types";

// Overall primal usage for one date, from the same quantities the Primal
// Calculation page derives — nothing here re-invents a formula.
//
// Per group (see buildGroupAvailability):
//   supply = Expected Production + Opening Stock + Remaining Products
//   endingStock = supply − customer orders − allocations out − sales orders
//
// The stored per-group Ending Stock (primal_ending_stock — the page's
// persisted final result) therefore already nets out EVERY commitment stream,
// including the ones only the Primal page can see (special customer orders and
// custom rows live in its local storage). So the dashboard only reconstructs
// the supply side from shared data and reads the committed side as:
//   committed = total supply − stored ending stock
//   usage %  = committed / total supply
//
// Note this is NOT "Available Stock − Ending Stock" — that difference is only
// the Sales Orders stream, because Available Stock is already net of customer
// orders and allocations. Total supply is the correct "spoken for" denominator.
export type PrimalUsage = {
  /** Σ expected production + opening stock + remaining products (pieces). */
  totalSupply: number;
  /** totalSupply − remaining: every order/allocation stream combined. */
  committed: number;
  /** Σ stored ending stock — what's left after all commitments. */
  remaining: number;
  /** Whole-number committed share. May exceed 100 when ending stock is
   *  negative (the page's "Short" condition — demand exceeded supply). */
  percent: number;
};

export function buildPrimalUsage(input: {
  record: HogIntakeRecord;
  /** Previous calendar day's held-over hogs, cut on this date. */
  heldOverPrev: number;
  /** Previous saved date's ending stock, carried in as opening stock. */
  openingStock: EndingStockByGroup;
  /** Allocations targeting this date — its Remaining Products. */
  incomingAllocations: AllocationsForDate;
  /** The date's saved ending stock (primal_ending_stock). */
  endingStock: EndingStockByGroup;
  date: string;
}): PrimalUsage | null {
  const { record, heldOverPrev, openingStock, incomingAllocations, endingStock, date } =
    input;
  const heldOver = {
    fromPrevDay: heldOverPrev,
    toNextDay: record.held_over,
    deaths: record.deaths_on_arrival,
  };
  const remainingByGroup = sumRemainingByGroup(incomingAllocations, [], date);

  let totalSupply = 0;
  let remaining = 0;
  for (const group of PRIMAL_GROUPS) {
    totalSupply +=
      groupExpectedProduction(
        group,
        record.hog_counts,
        heldOver,
        record.include_bk_in_yield,
      ) +
      openingStock[group.key] +
      remainingByGroup[group.key];
    remaining += endingStock[group.key];
  }

  if (totalSupply <= 0) return null;
  const committed = totalSupply - remaining;
  // Consistent data can never commit negative pieces (every stream the page
  // subtracts is non-negative), so a negative here means the stored ending
  // stock is stale against the current supply inputs — not meaningful.
  if (committed < 0) return null;

  return {
    totalSupply,
    committed,
    remaining,
    percent: Math.round((committed / totalSupply) * 100),
  };
}
