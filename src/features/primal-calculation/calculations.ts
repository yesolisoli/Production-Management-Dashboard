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
import {
  emptyProductOrder,
  PRIMAL_CATEGORIES,
  type AvailabilityStatus,
  type AvailabilityTotals,
  type CategoryAvailability,
  type CustomerAvailabilityColumn,
  type CustomerOrdersForDate,
  type OrderField,
  type OverstockByCategory,
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

const ORDER_FIELDS: OrderField[] = ["today_cases", "today_pcs"];

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

// Status from today's ending overstock: negative means total demand
// couldn't be met (Short); positive-but-thin drops below the reserve.
export function calculateAvailabilityStatus(
  todaysOverstock: number,
  minReserve: number,
): AvailabilityStatus {
  if (todaysOverstock < 0) return "Short";
  if (todaysOverstock < minReserve) return "Low Reserve";
  return "OK";
}

// -------------------------------------------------------------------
// Availability builders — compose the primitives above into the rows and
// totals the chart renders. All derived; nothing here is stored.
//
// Two order streams are subtracted in sequence from the gross supply
// (expected production + yesterday's overstock):
//   1. Special Customer Orders — from the Customer Availability chart
//      (the per-customer matrix above) → leaves Available Stock.
//   2. Customer Orders — today's pieces from the per-SKU sections below
//      → leaves Today's Overstock (carries into tomorrow).
// -------------------------------------------------------------------
export function buildCategoryAvailability(
  category: PrimalCategory,
  specialCustomerOrders: number,
  customerOrders: number,
  counts: HogCounts,
  yesterdayOverstock: number,
  minReserve: number,
): CategoryAvailability {
  const expectedProduction = categoryExpectedProduction(category, counts);
  const availableStock =
    expectedProduction + yesterdayOverstock - specialCustomerOrders;
  const todaysOverstock = availableStock - customerOrders;
  return {
    category,
    expectedProduction,
    yesterdayOverstock,
    specialCustomerOrders,
    availableStock,
    customerOrders,
    todaysOverstock,
    shortage: Math.max(-todaysOverstock, 0),
    status: calculateAvailabilityStatus(todaysOverstock, minReserve),
  };
}

export function buildAvailabilityRows(
  orders: ProductOrdersForDate,
  counts: HogCounts,
  customerOrders: CustomerOrdersForDate,
  // Yesterday's O/S carried in per category — the previous saved date's
  // calculated O/S (see readPreviousOverstock). Supplied by the hook so
  // this stays a pure derivation with no storage reads.
  yesterdayOverstock: OverstockByCategory,
  minReserve: number = DEFAULT_MIN_COOLER_RESERVE,
): CategoryAvailability[] {
  const specialByCategory = sumCustomerOrdersByCategory(customerOrders);
  return PRIMAL_CATEGORIES.map((category) =>
    buildCategoryAvailability(
      category,
      specialByCategory[category],
      categoryTotals(category, orders).today_pcs,
      counts,
      yesterdayOverstock[category],
      minReserve,
    ),
  );
}

// -------------------------------------------------------------------
// Customer availability — sum each category's customer orders and
// subtract from that category's Available Stock. Pure derivation from
// the Availability Chart rows + the raw customer-order matrix.
// -------------------------------------------------------------------
export function sumCustomerOrdersByCategory(
  customerOrders: CustomerOrdersForDate,
): Record<PrimalCategory, number> {
  const totals = {} as Record<PrimalCategory, number>;
  for (const category of PRIMAL_CATEGORIES) totals[category] = 0;
  for (const perCategory of Object.values(customerOrders)) {
    for (const category of PRIMAL_CATEGORIES) {
      totals[category] += clampNonNegativeInt(perCategory?.[category] ?? 0);
    }
  }
  return totals;
}

// Build one column per category: its Available Stock and the total
// ordered across all customers (already summed into the availability
// row's customerOrders), and the remaining stock after subtracting.
// Remaining may go negative when orders exceed stock — the chart
// surfaces that as a shortfall.
export function buildCustomerAvailability(
  availabilityRows: CategoryAvailability[],
): CustomerAvailabilityColumn[] {
  return availabilityRows.map((row) => ({
    category: row.category,
    // Totals Available (gross) = expected production + yesterday's overstock.
    availableStock: row.expectedProduction + row.yesterdayOverstock,
    ordered: row.specialCustomerOrders,
    remaining: row.availableStock, // gross − special customer orders
  }));
}

export function sumAvailability(
  rows: CategoryAvailability[],
): AvailabilityTotals {
  return rows.reduce<AvailabilityTotals>(
    (acc, row) => ({
      expectedProduction: acc.expectedProduction + row.expectedProduction,
      yesterdayOverstock: acc.yesterdayOverstock + row.yesterdayOverstock,
      specialCustomerOrders:
        acc.specialCustomerOrders + row.specialCustomerOrders,
      availableStock: acc.availableStock + row.availableStock,
      customerOrders: acc.customerOrders + row.customerOrders,
      todaysOverstock: acc.todaysOverstock + row.todaysOverstock,
      shortage: acc.shortage + row.shortage,
    }),
    {
      expectedProduction: 0,
      yesterdayOverstock: 0,
      specialCustomerOrders: 0,
      availableStock: 0,
      customerOrders: 0,
      todaysOverstock: 0,
      shortage: 0,
    },
  );
}
