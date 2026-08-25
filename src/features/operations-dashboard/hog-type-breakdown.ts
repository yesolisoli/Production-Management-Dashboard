import { totalHogs } from "@/features/hog-intake/calculations";
import { HOG_TYPES, type HogCounts, type HogType } from "@/features/hog-intake/types";

// Explicitly displayed hog types, in display order. Every other member of
// HOG_TYPES rolls into "Others" (currently Sow, Suckling, Customer), so the
// rows always partition the canonical type set and their counts sum exactly to
// totalHogs — a type added to HOG_TYPES later lands in Others automatically
// instead of silently dropping out of the donut.
const EXPLICIT_TYPES = ["JP", "RWA", "BK", "Round"] as const satisfies readonly HogType[];

export const OTHERS_KEY = "Others";

export type HogTypeBreakdownKey =
  | (typeof EXPLICIT_TYPES)[number]
  | typeof OTHERS_KEY;

export const OTHERS_TYPES: readonly HogType[] = HOG_TYPES.filter(
  (type) => !(EXPLICIT_TYPES as readonly HogType[]).includes(type),
);

export type HogTypeBreakdownRow = {
  key: HogTypeBreakdownKey;
  label: string;
  count: number;
  /** Whole-number percent of the day's totalHogs (0 when the total is 0). */
  percent: number;
  /** Head-count change vs the previous recorded day; null without one. */
  diff: number | null;
};

function sumTypes(counts: HogCounts, types: readonly HogType[]): number {
  return types.reduce((sum, type) => sum + counts[type], 0);
}

export function buildHogTypeBreakdown(
  counts: HogCounts,
  previous: HogCounts | null,
): HogTypeBreakdownRow[] {
  const total = totalHogs(counts);
  const row = (
    key: HogTypeBreakdownRow["key"],
    types: readonly HogType[],
  ): HogTypeBreakdownRow => {
    const count = sumTypes(counts, types);
    return {
      key,
      label: key,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      diff: previous ? count - sumTypes(previous, types) : null,
    };
  };
  const rows = [
    ...EXPLICIT_TYPES.map((type) => row(type, [type])),
    row(OTHERS_KEY, OTHERS_TYPES),
  ];
  if (process.env.NODE_ENV !== "production") {
    const sum = rows.reduce((acc, r) => acc + r.count, 0);
    console.assert(
      sum === total,
      `Hog type breakdown rows sum to ${sum}, expected totalHogs ${total}`,
    );
  }
  return rows;
}

// The single takeaway of the card: the category with the largest absolute
// head-count change vs the previous recorded day (first in display order wins
// a tie). Null when no comparison exists or nothing changed.
export function findTopChange(
  rows: HogTypeBreakdownRow[],
): HogTypeBreakdownRow | null {
  let top: HogTypeBreakdownRow | null = null;
  for (const row of rows) {
    if (row.diff === null || row.diff === 0) continue;
    if (top === null || Math.abs(row.diff) > Math.abs(top.diff ?? 0)) {
      top = row;
    }
  }
  return top;
}
