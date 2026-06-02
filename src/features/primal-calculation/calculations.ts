import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import type { HogCounts } from "@/features/hog-intake/types";
import {
  PRODUCT_SPECS,
  specsForCategory,
} from "./product-specs";
import {
  emptyProductOrder,
  type OrderField,
  type PrimalCategory,
  type ProductOrder,
  type ProductOrdersForDate,
  type ProductSpec,
} from "./types";

// Re-export so components/hooks in this feature import the clamp from one
// place rather than reaching into the hog-intake module directly.
export { clampNonNegativeInt };

// -------------------------------------------------------------------
// Hog pools available for cutting into primals.
//
//   REGULAR products are cut from JP + RWA + BK.
//   SOW products are cut from the Sow count.
//
// Round / Suckling / Customer are excluded from yield entirely, matching
// the YIELD_HOG_TYPES contract in the hog-intake module.
// -------------------------------------------------------------------
export function regularHogCount(counts: HogCounts): number {
  return counts.JP + counts.RWA + counts.BK;
}

export function sowHogCount(counts: HogCounts): number {
  return counts.Sow;
}

export function hogBaseForSource(
  spec: ProductSpec,
  counts: HogCounts,
): number {
  return spec.hogSource === "SOW"
    ? sowHogCount(counts)
    : regularHogCount(counts);
}

// Expected pieces = hog_count × yield_per_hog, floored to whole pieces.
export function expectedPiecesFor(
  spec: ProductSpec,
  counts: HogCounts,
): number {
  return Math.floor(hogBaseForSource(spec, counts) * spec.yieldPerHog);
}

// Convert a case count to pieces using the product's case pack.
export function casesToPieces(spec: ProductSpec, cases: number): number {
  return clampNonNegativeInt(cases) * spec.piecesPerCase;
}

// -------------------------------------------------------------------
// Per-product derived view. Never stored — recomputed from order + counts.
// -------------------------------------------------------------------
export type ProductYield = {
  spec: ProductSpec;
  order: ProductOrder;
  expectedPieces: number; // available yield from hog data
  allocatedPieces: number; // today + tomorrow + overstock pieces
  remainingPieces: number; // expected - allocated (may be negative)
  overAllocated: boolean; // allocated exceeds available yield
};

export function deriveProductYield(
  spec: ProductSpec,
  order: ProductOrder,
  counts: HogCounts,
): ProductYield {
  const expectedPieces = expectedPiecesFor(spec, counts);
  const allocatedPieces =
    order.today_pcs + order.tmrw_pcs + order.overstock_pcs;
  return {
    spec,
    order,
    expectedPieces,
    allocatedPieces,
    remainingPieces: expectedPieces - allocatedPieces,
    overAllocated: allocatedPieces > expectedPieces,
  };
}

// -------------------------------------------------------------------
// Totals — sum the six order fields across any set of orders. Used for
// both category totals and the global footer.
// -------------------------------------------------------------------
export type OrderTotals = ProductOrder;

const ORDER_FIELDS: OrderField[] = [
  "today_cases",
  "today_pcs",
  "tmrw_cases",
  "tmrw_pcs",
  "overstock_cases",
  "overstock_pcs",
];

export function sumOrders(orders: ProductOrder[]): OrderTotals {
  const totals = emptyProductOrder();
  for (const order of orders) {
    for (const field of ORDER_FIELDS) {
      totals[field] += order[field];
    }
  }
  return totals;
}

// Pull the order for a sku, falling back to an empty order.
export function orderFor(
  orders: ProductOrdersForDate,
  sku: string,
): ProductOrder {
  return orders[sku] ?? emptyProductOrder();
}

export function categoryTotals(
  category: PrimalCategory,
  orders: ProductOrdersForDate,
): OrderTotals {
  return sumOrders(
    specsForCategory(category).map((spec) => orderFor(orders, spec.sku)),
  );
}

export function globalTotals(orders: ProductOrdersForDate): OrderTotals {
  return sumOrders(
    PRODUCT_SPECS.map((spec) => orderFor(orders, spec.sku)),
  );
}

// True if any product in the category is over-allocated against its yield.
export function categoryHasOverAllocation(
  category: PrimalCategory,
  orders: ProductOrdersForDate,
  counts: HogCounts,
): boolean {
  return specsForCategory(category).some(
    (spec) =>
      deriveProductYield(spec, orderFor(orders, spec.sku), counts)
        .overAllocated,
  );
}
