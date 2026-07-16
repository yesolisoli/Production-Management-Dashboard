import {
  clampNonNegativeInt,
  netYieldTotal,
  NO_YIELD_ADJUSTMENT,
  PIECES_PER_HOG,
  type YieldAdjustment,
} from "@/features/hog-intake/calculations";
import type { HogCounts } from "@/features/hog-intake/types";
import { specsForCategory } from "./product-specs";
import {
  emptyProductOrder,
  groupForCategory,
  PRIMAL_GROUPS,
  type AvailabilityStatus,
  type AvailabilityTotals,
  type CustomerAvailabilityColumn,
  type CustomerOrdersForDate,
  type CustomGroupsForDate,
  type CustomRowsForDate,
  type EndingStockByGroup,
  type GroupAvailability,
  type OrderField,
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
//   Primal Total = JP + RWA (the Sow figure shown in the banner comes from
//   the intake's todays_cutting — today's Sow slated for processing).
//
// BK / Sow / Round / Suckling / Customer are excluded from yield entirely,
// matching the YIELD_HOG_TYPES contract in the hog-intake module.
// -------------------------------------------------------------------
export function primalTotalHogCount(
  counts: HogCounts,
  heldOver: YieldAdjustment = NO_YIELD_ADJUSTMENT,
): number {
  // JP + RWA is exactly the yield pool, so the held-over adjustment lives in one
  // place (netYieldTotal) rather than being re-derived here.
  return netYieldTotal(counts, heldOver);
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
  heldOver: YieldAdjustment = NO_YIELD_ADJUSTMENT,
): number {
  void group;
  return calculateExpectedProduction(
    netYieldTotal(counts, heldOver),
    PRIMAL_PIECES_PER_HOG,
  );
}

// Status from today's ending stock: negative means total demand couldn't
// be met (Short); positive-but-thin drops below the reserve.
export function calculateAvailabilityStatus(
  endingStock: number,
  minReserve: number,
): AvailabilityStatus {
  if (endingStock < 0) return "Short";
  if (endingStock < minReserve) return "Low Reserve";
  return "OK";
}

// -------------------------------------------------------------------
// Availability builders — compose the primitives above into the rows and
// totals the chart renders. All derived; nothing here is stored.
//
// Two order streams are subtracted in sequence from the gross supply
// (expected production + opening stock):
//   1. Special Customer Orders — from the Customer Availability chart
//      (the per-customer matrix above) → leaves Available Stock.
//   2. Sales Orders — today's pieces from the per-SKU sections below
//      → leaves Ending Stock (carries into tomorrow).
// -------------------------------------------------------------------
export function buildGroupAvailability(
  group: PrimalGroup,
  specialCustomerOrders: number,
  salesOrders: number,
  counts: HogCounts,
  openingStock: number,
  minReserve: number,
  heldOver: YieldAdjustment = NO_YIELD_ADJUSTMENT,
): GroupAvailability {
  const expectedProduction = groupExpectedProduction(group, counts, heldOver);
  const availableStock =
    expectedProduction + openingStock - specialCustomerOrders;
  const endingStock = availableStock - salesOrders;
  return {
    group: group.key as PrimalGroupKey,
    label: group.label,
    categories: group.categories,
    expectedProduction,
    openingStock,
    specialCustomerOrders,
    availableStock,
    salesOrders,
    endingStock,
    shortage: Math.max(-endingStock, 0),
    status: calculateAvailabilityStatus(endingStock, minReserve),
  };
}

// The production group a custom row belongs to: its explicit groupKey (set for
// rows filed under a custom availability group) or, for catalog rows, the group
// its category resolves to.
function customRowGroupKey(row: CustomRowsForDate[number]): string {
  return row.groupKey ?? groupForCategory(row.spec.category).key;
}

// Sum manually added (custom) rows' today pieces into their owning group. Each
// row pools into exactly one group — a Ribs custom row into the shared Ribs
// production, a custom-group row into that group's id. Keyed by group key so
// both catalog keys and custom group ids are represented.
export function sumCustomRowsByGroup(
  customRows: CustomRowsForDate,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const group of PRIMAL_GROUPS) totals[group.key] = 0;
  for (const row of customRows) {
    const key = customRowGroupKey(row);
    totals[key] = (totals[key] ?? 0) + clampNonNegativeInt(row.order.today_pcs);
  }
  return totals;
}

export function buildAvailabilityRows(
  orders: ProductOrdersForDate,
  counts: HogCounts,
  customerOrders: CustomerOrdersForDate,
  // Opening stock carried in per group — the previous saved date's ending
  // stock (see fetchPreviousEndingStock in ending-stock-source). Supplied
  // by the hook so this stays a pure derivation with no storage reads.
  openingStock: EndingStockByGroup,
  // Manually added rows for the date — their pieces pool into Sales Orders
  // alongside the catalog rows.
  customRows: CustomRowsForDate = [],
  // Held-over hogs (prev day carried in / today held to next day) — shift the
  // yield pool that feeds every group's Expected Production.
  heldOver: YieldAdjustment = NO_YIELD_ADJUSTMENT,
  minReserve: number = DEFAULT_MIN_COOLER_RESERVE,
): GroupAvailability[] {
  const specialByGroup = sumCustomerOrdersByGroup(customerOrders);
  const customByGroup = sumCustomRowsByGroup(customRows);
  return PRIMAL_GROUPS.map((group) => {
    // Today's order pieces are pooled across every category in the group, so
    // a shared cut (Ribs) subtracts both types' orders from its one pool.
    const salesOrdersPcs =
      group.categories.reduce(
        (sum, category) => sum + categoryTotals(category, orders).today_pcs,
        0,
      ) + customByGroup[group.key];
    return buildGroupAvailability(
      group,
      specialByGroup[group.key],
      salesOrdersPcs,
      counts,
      openingStock[group.key],
      minReserve,
      heldOver,
    );
  });
}

// Operator-added availability groups. Each reuses the same production
// primitive as the catalog groups — Expected Production is the whole-hog pool
// (yieldTotal × 2), since production isn't split per group. A custom group
// carries no categories, but keyed by its id it gets its own Custom
// Orders (from the matrix) and Sales Orders (from custom rows tagged with
// its id), subtracted just like a catalog group. No opening stock is carried
// over for it. The synthetic PrimalGroup keys off the row's stable id.
export function buildCustomGroupAvailability(
  customGroups: CustomGroupsForDate,
  counts: HogCounts,
  customerOrders: CustomerOrdersForDate,
  customRows: CustomRowsForDate,
  minReserve: number = DEFAULT_MIN_COOLER_RESERVE,
  heldOver: YieldAdjustment = NO_YIELD_ADJUSTMENT,
): GroupAvailability[] {
  const customByGroup = sumCustomRowsByGroup(customRows);
  return customGroups.map((g) =>
    buildGroupAvailability(
      { key: g.id, label: g.label, categories: [] },
      sumCustomerOrdersForKey(customerOrders, g.id),
      customByGroup[g.id] ?? 0,
      counts,
      0,
      minReserve,
      heldOver,
    ),
  );
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

// Sum every customer's order for one group key (pieces). Works for any key,
// including a custom availability group's id — its custom orders column lives in
// the same matrix, keyed by that id.
export function sumCustomerOrdersForKey(
  customerOrders: CustomerOrdersForDate,
  key: string,
): number {
  let total = 0;
  for (const perGroup of Object.values(customerOrders)) {
    total += clampNonNegativeInt(perGroup?.[key] ?? 0);
  }
  return total;
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
    // Totals Available (gross) = expected production + opening stock.
    availableStock: row.expectedProduction + row.openingStock,
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
      openingStock: acc.openingStock + row.openingStock,
      specialCustomerOrders:
        acc.specialCustomerOrders + row.specialCustomerOrders,
      availableStock: acc.availableStock + row.availableStock,
      salesOrders: acc.salesOrders + row.salesOrders,
      endingStock: acc.endingStock + row.endingStock,
      shortage: acc.shortage + row.shortage,
    }),
    {
      expectedProduction: 0,
      openingStock: 0,
      specialCustomerOrders: 0,
      availableStock: 0,
      salesOrders: 0,
      endingStock: 0,
      shortage: 0,
    },
  );
}
