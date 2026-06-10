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

// -------------------------------------------------------------------
// Production groups — categories that come off the same primal cut share
// ONE production pool, so quantity (expected production, availability,
// Ending Stock, carry-over, customer reservations) is computed per group,
// never per category. Order entry and per-type display stay at the category
// level. Most groups are a single category; Spareribs + Ribbons/Ribs come
// off the same rib cut, so they form one "Ribs" group.
// -------------------------------------------------------------------
export type PrimalGroup = {
  key: string;
  label: string;
  categories: readonly PrimalCategory[];
};

export const PRIMAL_GROUPS = [
  { key: "Butts", label: "Butts", categories: ["Butts"] },
  { key: "Legs", label: "Legs", categories: ["Legs"] },
  { key: "Loins", label: "Loins", categories: ["Loins"] },
  { key: "Ribs", label: "Ribs", categories: ["Spareribs", "Ribbons/Ribs"] },
  { key: "Picnic", label: "Picnic", categories: ["Picnic"] },
] as const satisfies readonly PrimalGroup[];

export type PrimalGroupKey = (typeof PRIMAL_GROUPS)[number]["key"];

// The group a category belongs to. Every category is in exactly one group.
export function groupForCategory(category: PrimalCategory): PrimalGroup {
  const group = PRIMAL_GROUPS.find((g) =>
    (g.categories as readonly PrimalCategory[]).includes(category),
  );
  if (!group) throw new Error(`No primal group for category ${category}`);
  return group;
}

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
// production/orders only — everything else (ending stock, availability) is
// derived, never typed in. See the Calculated Ending Stock note below.
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
// Manually added (ad-hoc) order rows — products that aren't in the static
// catalog but an operator adds by hand for a single date. Each row is
// self-contained: it carries its own editable spec plus its order, and is
// persisted per date in its own store (mirrors the customer-orders pattern,
// not the catalog). Its pieces pool into the owning group's Sales Orders
// exactly like a catalog row, so Availability / Ending Stock pick it up
// automatically. `id` is an immutable key, independent of the editable SKU.
//   { "YYYY-MM-DD": [ { id, spec, order } ] }
// -------------------------------------------------------------------
export type CustomOrderRow = {
  id: string;
  spec: ProductSpec;
  order: ProductOrder;
};
export type CustomRowsForDate = CustomOrderRow[];
export type CustomRowsByDate = Record<string, CustomRowsForDate>;

// A blank custom spec for a freshly added row. piecesPerCase defaults to 1
// (not 0) so cases↔pieces conversion is a no-op until the operator sets it.
export function emptyCustomSpec(category: PrimalCategory): ProductSpec {
  return { sku: "", name: "", category, casePack: "", piecesPerCase: 1 };
}

// -------------------------------------------------------------------
// Calculated Ending Stock — saved per date, per production group (pieces).
//
// Ending Stock is DERIVED from the Availability Chart (Available Stock −
// Customer Orders) at the group level — production comes from whole hogs,
// not per SKU, so there is no per-SKU figure, and pooled cuts (Ribs) share
// one value. On Save the computed figure is persisted here; opening the next
// production date loads the previous saved date's values as that day's
// Opening Stock (the carry-over).
//   { "YYYY-MM-DD": { "<group>": pcs } }
// -------------------------------------------------------------------
export type EndingStockByGroup = Record<PrimalGroupKey, number>;
export type EndingStockByDate = Record<string, EndingStockByGroup>;

export function emptyEndingStockByGroup(): EndingStockByGroup {
  const out = {} as EndingStockByGroup;
  for (const group of PRIMAL_GROUPS) out[group.key] = 0;
  return out;
}

// -------------------------------------------------------------------
// Availability — combines expected production with opening stock and
// compares against customer orders. Like everything else here this is a
// DERIVED view: never persisted, always recomputed from intake counts +
// orders + opening stock. Ending Stock and Shortage are computed, never
// typed in by an operator.
// -------------------------------------------------------------------
export type AvailabilityStatus = "OK" | "Short" | "Low Reserve";

export type GroupAvailability = {
  group: PrimalGroupKey;
  label: string;
  categories: readonly PrimalCategory[];
  expectedProduction: number; // expected pieces from today's hog intake (per group, once)
  openingStock: number; // stock carried in from the previous day (yesterday's ending stock)
  specialCustomerOrders: number; // orders from the Customer Availability chart (above)
  availableStock: number; // expProd + openingStock − specialCustomerOrders
  salesOrders: number; // today's order pieces from the per-SKU sections (below)
  endingStock: number; // availableStock − salesOrders (may be negative)
  shortage: number; // demand that exceeds availability
  status: AvailabilityStatus;
};

export type AvailabilityTotals = {
  expectedProduction: number;
  openingStock: number;
  specialCustomerOrders: number;
  availableStock: number;
  salesOrders: number;
  endingStock: number;
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

// One customer's order pieces per production group. Pooled cuts (Ribs) take a
// single reservation rather than one per type, matching how production is
// shared.
export type CustomerGroupOrders = Record<PrimalGroupKey, number>;

// Persisted save shape: { "YYYY-MM-DD": { "<customer>": { Butts: n, ... } } }
export type CustomerOrdersForDate = Record<string, CustomerGroupOrders>;
export type CustomerOrdersByDate = Record<string, CustomerOrdersForDate>;

export function emptyCustomerGroupOrders(): CustomerGroupOrders {
  const out = {} as CustomerGroupOrders;
  for (const group of PRIMAL_GROUPS) out[group.key] = 0;
  return out;
}

// Derived per-group column for the customer chart: Available Stock, the summed
// customer orders against it, and what remains after subtracting.
export type CustomerAvailabilityColumn = {
  group: PrimalGroupKey;
  label: string;
  availableStock: number; // from the Availability Chart (production + cooler O/S)
  ordered: number; // sum of all customers' orders for this group
  remaining: number; // availableStock - ordered (may go negative)
};
