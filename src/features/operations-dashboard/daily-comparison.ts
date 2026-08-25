import { emptyHogIntakeRecord } from "@/features/hog-intake/types";
import {
  emptyEndingStockByGroup,
  type AllocationsForDate,
  type EndingStockByGroup,
} from "@/features/primal-calculation/types";
import { buildPrimalUsage } from "./primal-usage";
import { RECENT_DAYS_LIMIT, type RecentActivityDay } from "./hooks/use-recent-hog-activity";

// How many recorded days the Daily Comparison table shows.
export const COMPARISON_ROWS = 5;

export type ComparisonStaffing = { assigned: number; target: number };

export type ComparisonRow = {
  date: string;
  totalHogs: number;
  forCutting: number;
  // Null when no board snapshot was captured for the date — rendered as "—",
  // never as zero or "On target".
  staffing: ComparisonStaffing | null;
  // Null when the date's primal usage can't be reconstructed (no saved ending
  // stock, unknown carry-over, or inconsistent data).
  primalPercent: number | null;
};

// Same wording as the overview Staffing card, compacted to one cell.
export function staffingCellLabel(staffing: ComparisonStaffing): string {
  const diff = staffing.assigned - staffing.target;
  if (diff === 0) return "On target";
  if (diff < 0) return `${-diff} short`;
  return `${diff} over`;
}

// Historical primal usage for one recorded intake day, reusing the same
// derivation as the Primal Usage card. `endingByDate` holds the recent saved
// ending-stock dates (newest window); `windowComplete` is true when that
// window contains ALL saved dates ≤ the selected date, which makes "no earlier
// saved date" mean a genuine first day (opening stock 0) rather than a cutoff.
export function historicalPrimalPercent(
  day: RecentActivityDay,
  endingByDate: Map<string, EndingStockByGroup>,
  windowComplete: boolean,
  incomingAllocations: AllocationsForDate,
  heldOverPrev: number,
): number | null {
  const endingStock = endingByDate.get(day.date);
  if (!endingStock) return null;

  const earlierDates = [...endingByDate.keys()]
    .filter((d) => d < day.date)
    .sort();
  const prevDate = earlierDates[earlierDates.length - 1];
  let openingStock: EndingStockByGroup;
  if (prevDate) {
    openingStock = endingByDate.get(prevDate)!;
  } else if (windowComplete) {
    // Genuinely the first saved date — the carry-over chain starts at zero.
    openingStock = emptyEndingStockByGroup();
  } else {
    // A predecessor exists but fell outside the fetched window — the
    // carry-over is unknown, so the figure can't be trusted.
    return null;
  }

  const record = {
    ...emptyHogIntakeRecord(day.date),
    hog_counts: day.hogCounts,
    held_over: day.heldOver,
    deaths_on_arrival: day.deathsOnArrival,
    include_bk_in_yield: day.includeBkInYield,
  };
  const usage = buildPrimalUsage({
    record,
    heldOverPrev,
    openingStock,
    incomingAllocations,
    endingStock,
    date: day.date,
  });
  return usage?.percent ?? null;
}

// ------------------------------------------------------------------
// 7-day trend: latest up-to-7 recorded values vs the up-to-7 recorded
// before them. Recorded days only — never calendar weeks, never
// zero-filled gaps.
// ------------------------------------------------------------------
export const TREND_MIN_VALUES = 4;

export type TrendLine = {
  /** Rounded average of the current period. */
  average: number;
  /** Rounded relative change vs the previous period, or null when the
   *  previous average is zero (no meaningful percentage). */
  deltaPercent: number | null;
  /** Current-period values, oldest first — feeds the sparkline. */
  values: number[];
};

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// history: recorded days oldest → newest (the hook's fetched window).
export function buildTrendLine(
  history: RecentActivityDay[],
  pick: (day: RecentActivityDay) => number,
): TrendLine | null {
  const values = history.map(pick);
  const current = values.slice(-RECENT_DAYS_LIMIT);
  const previous = values.slice(0, -RECENT_DAYS_LIMIT).slice(-RECENT_DAYS_LIMIT);
  if (current.length < TREND_MIN_VALUES || previous.length < TREND_MIN_VALUES) {
    return null;
  }
  const currentAvg = average(current);
  const previousAvg = average(previous);
  return {
    average: Math.round(currentAvg),
    deltaPercent:
      previousAvg > 0
        ? Math.round(((currentAvg - previousAvg) / previousAvg) * 100)
        : null,
    values: current,
  };
}
