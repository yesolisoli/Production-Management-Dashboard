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
  PRIMAL_GROUPS,
  type AvailabilityStatus,
  type AvailabilityTotals,
  type CustomerAvailabilityColumn,
  type CustomerOrdersForDate,
  type GroupAvailability,
  type OrderField,
  type OverstockByGroup,
  type PrimalCategory,
  type PrimalGroup,
  type PrimalGroupKey,
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
//   Regular = JP + RWA · Sow = the Sow count (reference only).
//
// BK / Sow / Round / Suckling / Customer are excluded from yield entirely,
// matching the YIELD_HOG_TYPES contract in the hog-intake module.
// -------------------------------------------------------------------
export function regularHogCount(counts: HogCounts): number {
  return counts.JP + counts.RWA;
}

export function sowHogCount(counts: HogCounts): number {
  return counts.Sow;
}

// Shared production primitive: expected pieces = base hog count ×
// multiplier, floored to whole pieces. The Availability Chart's
// groupExpectedProduction is the only caller; it passes the intake's
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
// (JP + RWA) — the same figure the Hog Intake screen reports — so the
// chart never recomputes availability separately from the regular counts.
// Sow is excluded from yield, so it never affects production. Every category
// therefore starts at yieldTotal × pieces-per-hog (e.g. 136 × 2 = 272).
//
// `group` is accepted so a future business rule can give a group a different
// hog pool; with no such rule today, every group shares the same base. Each
// group counts the pool ONCE — so pooled cuts (Ribs) don't double-count.
export function groupExpectedProduction(
  group: PrimalGroup,
  counts: HogCounts,
): number {
  void group;
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
export function buildGroupAvailability(
  group: PrimalGroup,
  specialCustomerOrders: number,
  customerOrders: number,
  counts: HogCounts,
  yesterdayOverstock: number,
  minReserve: number,
): GroupAvailability {
  const expectedProduction = groupExpectedProduction(group, counts);
  const availableStock =
    expectedProduction + yesterdayOverstock - specialCustomerOrders;
  const todaysOverstock = availableStock - customerOrders;
  return {
    group: group.key as PrimalGroupKey,
    label: group.label,
    categories: group.categories,
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
  // Yesterday's O/S carried in per group — the previous saved date's
  // calculated O/S (see readPreviousOverstock). Supplied by the hook so
  // this stays a pure derivation with no storage reads.
  yesterdayOverstock: OverstockByGroup,
  minReserve: number = DEFAULT_MIN_COOLER_RESERVE,
): GroupAvailability[] {
  const specialByGroup = sumCustomerOrdersByGroup(customerOrders);
  return PRIMAL_GROUPS.map((group) => {
    // Today's order pieces are pooled across every category in the group, so
    // a shared cut (Ribs) subtracts both types' orders from its one pool.
    const customerOrdersPcs = group.categories.reduce(
      (sum, category) => sum + categoryTotals(category, orders).today_pcs,
      0,
    );
    return buildGroupAvailability(
      group,
      specialByGroup[group.key],
      customerOrdersPcs,
      counts,
      yesterdayOverstock[group.key],
      minReserve,
    );
  });
}

// -------------------------------------------------------------------
// Customer availability — sum each group's customer orders and subtract
// from that group's Available Stock. Pure derivation from the Availability
// Chart rows + the raw customer-order matrix.
// -------------------------------------------------------------------
export function sumCustomerOrdersByGroup(
  customerOrders: CustomerOrdersForDate,
): Record<PrimalGroupKey, number> {
  const totals = {} as Record<PrimalGroupKey, number>;
  for (const group of PRIMAL_GROUPS) totals[group.key] = 0;
  for (const perGroup of Object.values(customerOrders)) {
    for (const group of PRIMAL_GROUPS) {
      totals[group.key] += clampNonNegativeInt(perGroup?.[group.key] ?? 0);
    }
  }
  return totals;
}

// Build one column per group: its Available Stock and the total ordered
// across all customers (already summed into the availability row's
// customerOrders), and the remaining stock after subtracting. Remaining may
// go negative when orders exceed stock — the chart surfaces that as a shortfall.
export function buildCustomerAvailability(
  availabilityRows: GroupAvailability[],
): CustomerAvailabilityColumn[] {
  return availabilityRows.map((row) => ({
    group: row.group,
    label: row.label,
    // Totals Available (gross) = expected production + yesterday's overstock.
    availableStock: row.expectedProduction + row.yesterdayOverstock,
    ordered: row.specialCustomerOrders,
    remaining: row.availableStock, // gross − special customer orders
  }));
}

export function sumAvailability(
  rows: GroupAvailability[],
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
