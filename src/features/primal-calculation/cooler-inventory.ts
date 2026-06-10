import {
  PRIMAL_GROUPS,
  type EndingStockByGroup,
} from "./types";

// -------------------------------------------------------------------
// Ending Stock → Cooler Inventory hand-off (placeholder).
//
// Isolated on purpose: today this only summarizes the ending stock that
// WOULD be pushed. When the Cooler Inventory module is ready, replace the
// body of pushEndingStockToCooler() with the real write — nothing else in
// the feature needs to change.
//
// The source is the calculated Ending Stock per group (in pieces) from the
// Availability Chart — not a manual input. Ending Stock lives at the group
// level because production comes from whole hogs, not per SKU.
// -------------------------------------------------------------------

export type EndingStockLine = {
  group: string;
  pcs: number;
};

export type EndingStockPushResult = {
  date: string;
  lines: EndingStockLine[];
  totalPcs: number;
};

// Collect every group that has positive calculated ending stock for the date.
export function collectEndingStockLines(
  endingStock: EndingStockByGroup,
): EndingStockLine[] {
  const lines: EndingStockLine[] = [];
  for (const group of PRIMAL_GROUPS) {
    const pcs = endingStock[group.key];
    if (pcs > 0) lines.push({ group: group.label, pcs });
  }
  return lines;
}

export async function pushEndingStockToCooler(
  date: string,
  endingStock: EndingStockByGroup,
): Promise<EndingStockPushResult> {
  const lines = collectEndingStockLines(endingStock);
  // TODO: replace with a real write into the Cooler Inventory module.
  return {
    date,
    lines,
    totalPcs: lines.reduce((sum, l) => sum + l.pcs, 0),
  };
}
