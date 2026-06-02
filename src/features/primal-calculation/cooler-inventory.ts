import type { ProductOrdersForDate } from "./types";
import { PRODUCT_SPECS } from "./product-specs";

// -------------------------------------------------------------------
// Overstock → Cooler Inventory hand-off (placeholder).
//
// Isolated on purpose: today this only summarizes the overstock that
// WOULD be pushed. When the Cooler Inventory module is ready, replace the
// body of pushOverstockToCooler() with the real write — nothing else in
// the feature needs to change.
// -------------------------------------------------------------------

export type OverstockLine = {
  sku: string;
  name: string;
  cases: number;
  pcs: number;
};

export type OverstockPushResult = {
  date: string;
  lines: OverstockLine[];
  totalCases: number;
  totalPcs: number;
};

// Collect every product that has overstock for the date.
export function collectOverstockLines(
  orders: ProductOrdersForDate,
): OverstockLine[] {
  const lines: OverstockLine[] = [];
  for (const spec of PRODUCT_SPECS) {
    const order = orders[spec.sku];
    if (!order) continue;
    if (order.overstock_cases > 0 || order.overstock_pcs > 0) {
      lines.push({
        sku: spec.sku,
        name: spec.name,
        cases: order.overstock_cases,
        pcs: order.overstock_pcs,
      });
    }
  }
  return lines;
}

export async function pushOverstockToCooler(
  date: string,
  orders: ProductOrdersForDate,
): Promise<OverstockPushResult> {
  const lines = collectOverstockLines(orders);
  // TODO: replace with a real write into the Cooler Inventory module.
  return {
    date,
    lines,
    totalCases: lines.reduce((sum, l) => sum + l.cases, 0),
    totalPcs: lines.reduce((sum, l) => sum + l.pcs, 0),
  };
}
