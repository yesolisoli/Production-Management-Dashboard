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

// The six editable values a supervisor enters per product.
export type ProductOrder = {
  today_cases: number;
  today_pcs: number;
  tmrw_cases: number;
  tmrw_pcs: number;
  overstock_cases: number;
  overstock_pcs: number;
};

export type OrderField = keyof ProductOrder;

// Which fields are case inputs (editing one auto-derives its *_pcs twin).
export const CASE_FIELDS: ReadonlyArray<OrderField> = [
  "today_cases",
  "tmrw_cases",
  "overstock_cases",
];

// Map each *_cases field to the *_pcs field it drives.
export const CASE_TO_PCS: Record<string, OrderField> = {
  today_cases: "today_pcs",
  tmrw_cases: "tmrw_pcs",
  overstock_cases: "overstock_pcs",
};

export function emptyProductOrder(): ProductOrder {
  return {
    today_cases: 0,
    today_pcs: 0,
    tmrw_cases: 0,
    tmrw_pcs: 0,
    overstock_cases: 0,
    overstock_pcs: 0,
  };
}

// Persisted save shape — matches the spec exactly:
//   { "YYYY-MM-DD": { "<sku>": { today_cases, today_pcs, ... } } }
export type ProductOrdersForDate = Record<string, ProductOrder>;
export type PrimalOrdersByDate = Record<string, ProductOrdersForDate>;

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
  coolerOverstock: number; // existing cooler O/S pieces
  availableStock: number; // production + cooler O/S
  customerOrders: number; // today + tomorrow order pieces
  availableToShip: number; // available stock minus the minimum reserve
  adjustedShip: number; // min(customer orders, available to ship)
  endingOverstock: number; // available stock minus adjusted ship
  shortage: number; // unfulfilled customer orders
  status: AvailabilityStatus;
};

export type AvailabilityTotals = {
  expectedProduction: number;
  coolerOverstock: number;
  availableStock: number;
  customerOrders: number;
  adjustedShip: number;
  shortage: number;
};
