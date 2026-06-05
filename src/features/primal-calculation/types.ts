// Primal Calculation domain types.
//
// Only RAW inputs (the six editable order fields per product) are ever
// stored. Everything else — expected yields, category totals, global
// totals, validation flags — is derived from inputs + the hog intake
// record, never persisted as independent state.

// Display order here is the tab / section order in the UI.
export const PRIMAL_CATEGORIES = [
  "Butts",
  "Legs",
  "Loins",
  "Spareribs",
  "Ribbons/Ribs",
  "Picnic",
] as const;

export type PrimalCategory = (typeof PRIMAL_CATEGORIES)[number];

// Centralized product definition. Lives in product-specs.ts; the UI never
// hardcodes any of these values.
export type ProductSpec = {
  sku: string;
  name: string;
  category: PrimalCategory;
  casePack: string; // human label shown in the table, e.g. "6 (20-22 KG)"
  piecesPerCase: number; // numeric divisor for cases <-> pieces conversion
};

// The editable values a supervisor enters per product. Today's
// production/orders only — everything else (overstock, availability) is
// derived, never typed in. See the Calculated O/S note below.
export type ProductOrder = {
  today_cases: number;
  today_pcs: number;
};

export type OrderField = keyof ProductOrder;

// Which fields are case inputs (editing one auto-derives its *_pcs twin).
export const CASE_FIELDS: ReadonlyArray<OrderField> = ["today_cases"];

// Map each *_cases field to the *_pcs field it drives.
export const CASE_TO_PCS: Record<string, OrderField> = {
  today_cases: "today_pcs",
};

export function emptyProductOrder(): ProductOrder {
  return {
    today_cases: 0,
    today_pcs: 0,
  };
}

// Persisted save shape — matches the spec exactly:
//   { "YYYY-MM-DD": { "<sku>": { today_cases, today_pcs } } }
export type ProductOrdersForDate = Record<string, ProductOrder>;
export type PrimalOrdersByDate = Record<string, ProductOrdersForDate>;

// -------------------------------------------------------------------
// Calculated Today's O/S — saved per date, per category (in pieces).
//
// O/S is DERIVED from the Availability Chart (Available Stock − Customer
// Orders) at the category level — production comes from whole hogs, not
// per SKU, so there is no per-SKU O/S. On Save the computed figure is
// persisted here; opening the next production date loads the previous
// saved date's values as that day's Yesterday O/S (the carry-over).
//   { "YYYY-MM-DD": { "<category>": pcs } }
// -------------------------------------------------------------------
export type OverstockByCategory = Record<PrimalCategory, number>;
export type OverstockByDate = Record<string, OverstockByCategory>;

export function emptyOverstockByCategory(): OverstockByCategory {
  const out = {} as OverstockByCategory;
  for (const category of PRIMAL_CATEGORIES) out[category] = 0;
  return out;
}

// -------------------------------------------------------------------
// Availability — combines expected production with cooler overstock and
// compares against customer orders. Like everything else here this is a
// DERIVED view: never persisted, always recomputed from intake counts +
// orders + cooler O/S. Ending O/S and Shortage are computed, never typed
// in by an operator.
// -------------------------------------------------------------------
export type AvailabilityStatus = "OK" | "Short" | "Low Reserve";

export type CategoryAvailability = {
  category: PrimalCategory;
  expectedProduction: number; // expected pieces from today's hog intake
  yesterdayOverstock: number; // cooler O/S carried in from yesterday
  specialCustomerOrders: number; // orders from the Customer Availability chart (above)
  availableStock: number; // expProd + yesterdayOverstock − specialCustomerOrders
  customerOrders: number; // today's order pieces from the per-SKU sections (below)
  todaysOverstock: number; // availableStock − customerOrders (may be negative)
  shortage: number; // demand that exceeds availability
  status: AvailabilityStatus;
};

export type AvailabilityTotals = {
  expectedProduction: number;
  yesterdayOverstock: number;
  specialCustomerOrders: number;
  availableStock: number;
  customerOrders: number;
  todaysOverstock: number;
  shortage: number;
};

// -------------------------------------------------------------------
// Customer availability — a customer × category matrix (mirrors the
// operations spreadsheet). Each customer has a per-category order
// quantity in pieces; the chart subtracts the column's total orders
// from that category's Available Stock to show what's left.
//
// Like the rest of this feature, only RAW order quantities are stored.
// The "available" and "remaining" figures are derived from the
// Availability Chart's per-category Available Stock + these orders.
// -------------------------------------------------------------------

// Fixed customer list, in display (row) order — matches the reference sheet.
export const PRIMAL_CUSTOMERS = [
  "Curing/Meatcutting",
  "Sungiven Save Product",
  "Continental",
  "Arctic Monday",
  "Taiwan Monday",
  "Polonia Tuesday",
  "Two Rivers Monday",
  "Hertel Hams",
  "RWA Save Wednesday/Thursday",
  "Bradner Freezer/Freezer",
  "Stapleton",
] as const;

export type PrimalCustomer = (typeof PRIMAL_CUSTOMERS)[number];

// One customer's order pieces per category.
export type CustomerCategoryOrders = Record<PrimalCategory, number>;

// Persisted save shape: { "YYYY-MM-DD": { "<customer>": { Butts: n, ... } } }
export type CustomerOrdersForDate = Record<string, CustomerCategoryOrders>;
export type CustomerOrdersByDate = Record<string, CustomerOrdersForDate>;

export function emptyCustomerCategoryOrders(): CustomerCategoryOrders {
  return {
    Butts: 0,
    Legs: 0,
    Loins: 0,
    Spareribs: 0,
    "Ribbons/Ribs": 0,
    Picnic: 0,
  };
}

// Derived per-category column for the customer chart: Available Stock,
// the summed customer orders against it, and what remains after subtracting.
export type CustomerAvailabilityColumn = {
  category: PrimalCategory;
  availableStock: number; // from the Availability Chart (production + cooler O/S)
  ordered: number; // sum of all customers' orders for this category
  remaining: number; // availableStock - ordered (may go negative)
};
