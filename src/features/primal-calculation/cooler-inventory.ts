import {
  PRIMAL_CATEGORIES,
  type OverstockByCategory,
} from "./types";

// -------------------------------------------------------------------
// Overstock → Cooler Inventory hand-off (placeholder).
//
// Isolated on purpose: today this only summarizes the overstock that
// WOULD be pushed. When the Cooler Inventory module is ready, replace the
// body of pushOverstockToCooler() with the real write — nothing else in
// the feature needs to change.
//
// The source is the calculated Today's O/S per category (in pieces) from
// the Availability Chart — not a manual input. O/S lives at the category
// level because production comes from whole hogs, not per SKU.
// -------------------------------------------------------------------

export type OverstockLine = {
  category: string;
  pcs: number;
};

export type OverstockPushResult = {
  date: string;
  lines: OverstockLine[];
  totalPcs: number;
};

// Collect every category that has positive calculated O/S for the date.
export function collectOverstockLines(
  overstock: OverstockByCategory,
): OverstockLine[] {
  const lines: OverstockLine[] = [];
  for (const category of PRIMAL_CATEGORIES) {
    const pcs = overstock[category];
    if (pcs > 0) lines.push({ category, pcs });
  }
  return lines;
}

export async function pushOverstockToCooler(
  date: string,
  overstock: OverstockByCategory,
): Promise<OverstockPushResult> {
  const lines = collectOverstockLines(overstock);
  // TODO: replace with a real write into the Cooler Inventory module.
  return {
    date,
    lines,
    totalPcs: lines.reduce((sum, l) => sum + l.pcs, 0),
  };
}
