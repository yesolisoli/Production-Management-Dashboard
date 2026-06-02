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

// Which pool of hogs a product is cut from.
//   REGULAR — drawn from JP + RWA + BK counts
//   SOW     — drawn from the Sow count
export type HogSource = "REGULAR" | "SOW";

// Centralized product definition. Lives in product-specs.ts; the UI never
// hardcodes any of these values.
export type ProductSpec = {
  sku: string;
  name: string;
  category: PrimalCategory;
  casePack: string; // human label shown in the table, e.g. "6 (20-22 KG)"
  piecesPerCase: number; // numeric divisor for cases <-> pieces conversion
  yieldPerHog: number; // expected pieces produced per source hog
  hogSource: HogSource;
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
