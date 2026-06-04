import {
  clampNonNegativeInt,
  PIECES_PER_HOG,
  yieldTotal,
} from "@/features/hog-intake/calculations";
import type { HogCounts } from "@/features/hog-intake/types";
import {
  PRODUCT_SPECS,
  specsForCategory,
} from "./product-specs";
import { readCoolerOverstockByCategory } from "./cooler-inventory";
import {
  emptyProductOrder,
  PRIMAL_CATEGORIES,
  type AvailabilityStatus,
  type AvailabilityTotals,
  type CategoryAvailability,
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
// Intake-count breakdowns shown in the Primal Calc banner. These are
// display-only splits of the same yield hogs that feed Expected
// Production (yieldTotal); no calculation branches on them.
//
//   Regular = JP + RWA + BK · Sow = the Sow count (reference only).
//
// Sow / Round / Suckling / Customer are excluded from yield entirely,
// matching the YIELD_HOG_TYPES contract in the hog-intake module.
// -------------------------------------------------------------------
export function regularHogCount(counts: HogCounts): number {
  return counts.JP + counts.RWA + counts.BK;
}

export function sowHogCount(counts: HogCounts): number {
  return counts.Sow;
}

// Shared production primitive: expected pieces = base hog count ×
// multiplier, floored to whole pieces. The Availability Chart's
// categoryExpectedProduction is the only caller; it passes the intake's
// Yield Total as the base hog count.
export function calculateExpectedProduction(
  baseHogCount: number,
  multiplier = 2,
): number {
  return Math.floor(clampNonNegativeInt(baseHogCount) * multiplier);
}

// Convert a case count to pieces using the product's case pack.
export function casesToPieces(spec: ProductSpec, cases: number): number {
  return clampNonNegativeInt(cases) * spec.piecesPerCase;
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

// -------------------------------------------------------------------
// Availability — pure formula primitives.
//
// Default minimum the cooler must retain after shipping, in pieces. The
// chart passes this through so it can later be made per-category or
// operator-editable without changing the math.
// -------------------------------------------------------------------
export const DEFAULT_MIN_COOLER_RESERVE = 100;

// Sides produced per yield hog (the spec's "base hog count × 2").
// Aliases the canonical hog-intake constant so the factor lives in one place.
export const PRIMAL_PIECES_PER_HOG = PIECES_PER_HOG;

// Expected production for a whole category, derived straight from hog
// intake. The single source of truth is the intake's yieldTotal
// (JP + RWA + BK) — the same figure the Hog Intake screen reports — so the
// chart never recomputes availability separately from the regular counts.
// Sow is excluded from yield, so it never affects production. Every category
// therefore starts at yieldTotal × pieces-per-hog (e.g. 136 × 2 = 272).
//
// `category` is accepted so a future business rule can exclude a category
// from a hog pool; with no such rule today, every category shares the base.
export function categoryExpectedProduction(
  category: PrimalCategory,
  counts: HogCounts,
): number {
  void category;
  return calculateExpectedProduction(yieldTotal(counts), PRIMAL_PIECES_PER_HOG);
}

// Available stock = expected production + existing cooler overstock.
export function calculateAvailableStock(
  expectedProduction: number,
  coolerOverstock: number,
): number {
  return expectedProduction + coolerOverstock;
}

// Available to ship = stock left after holding back the minimum reserve,
// floored at zero.
export function calculateAvailableToShip(
  availableStock: number,
  minReserve: number,
): number {
  return Math.max(availableStock - minReserve, 0);
}

// Adjusted ship = the most we can ship without dipping below the reserve.
export function calculateAdjustedShip(
  customerOrders: number,
  availableToShip: number,
): number {
  return Math.min(customerOrders, availableToShip);
}

// Ending O/S = whatever stock remains after the adjusted shipment.
export function calculateEndingOverstock(
  availableStock: number,
  adjustedShip: number,
): number {
  return availableStock - adjustedShip;
}

// Shortage = customer orders that could not be fulfilled.
export function calculateShortage(
  customerOrders: number,
  adjustedShip: number,
): number {
  return Math.max(customerOrders - adjustedShip, 0);
}

// Status precedence: a shortage outranks a low reserve.
export function calculateAvailabilityStatus(
  shortage: number,
  endingOverstock: number,
  minReserve: number,
): AvailabilityStatus {
  if (shortage > 0) return "Short";
  if (endingOverstock < minReserve) return "Low Reserve";
  return "OK";
}

// -------------------------------------------------------------------
// Availability builders — compose the primitives above into the rows and
// totals the chart renders. All derived; nothing here is stored.
// -------------------------------------------------------------------
export function buildCategoryAvailability(
  category: PrimalCategory,
  orders: ProductOrdersForDate,
  counts: HogCounts,
  coolerOverstock: number,
  minReserve: number,
): CategoryAvailability {
  const expectedProduction = categoryExpectedProduction(category, counts);
  const availableStock = calculateAvailableStock(
    expectedProduction,
    coolerOverstock,
  );
  // Customer orders = today's order pieces only. Tomorrow's pieces are
  // tracked separately so the chart reflects today's shipping decision and
  // doesn't conflate the two days' demand.
  const orderTotals = categoryTotals(category, orders);
  const customerOrders = orderTotals.today_pcs;
  const availableToShip = calculateAvailableToShip(availableStock, minReserve);
  const adjustedShip = calculateAdjustedShip(customerOrders, availableToShip);
  const endingOverstock = calculateEndingOverstock(availableStock, adjustedShip);
  const shortage = calculateShortage(customerOrders, adjustedShip);
  return {
    category,
    expectedProduction,
    coolerOverstock,
    availableStock,
    customerOrders,
    availableToShip,
    adjustedShip,
    endingOverstock,
    shortage,
    status: calculateAvailabilityStatus(shortage, endingOverstock, minReserve),
  };
}

export function buildAvailabilityRows(
  orders: ProductOrdersForDate,
  counts: HogCounts,
  minReserve: number = DEFAULT_MIN_COOLER_RESERVE,
): CategoryAvailability[] {
  const coolerByCategory = readCoolerOverstockByCategory(orders);
  return PRIMAL_CATEGORIES.map((category) =>
    buildCategoryAvailability(
      category,
      orders,
      counts,
      coolerByCategory[category],
      minReserve,
    ),
  );
}

export function sumAvailability(
  rows: CategoryAvailability[],
): AvailabilityTotals {
  return rows.reduce<AvailabilityTotals>(
    (acc, row) => ({
      expectedProduction: acc.expectedProduction + row.expectedProduction,
      coolerOverstock: acc.coolerOverstock + row.coolerOverstock,
      availableStock: acc.availableStock + row.availableStock,
      customerOrders: acc.customerOrders + row.customerOrders,
      adjustedShip: acc.adjustedShip + row.adjustedShip,
      shortage: acc.shortage + row.shortage,
    }),
    {
      expectedProduction: 0,
      coolerOverstock: 0,
      availableStock: 0,
      customerOrders: 0,
      adjustedShip: 0,
      shortage: 0,
    },
  );
}
