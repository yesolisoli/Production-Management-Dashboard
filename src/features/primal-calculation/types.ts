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
// Ending Stock, carry-over, custom orders) is computed per group,
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
  // Owning production group's key. When set it overrides the category-based
  // bucketing — needed for rows filed under a custom availability group, which
  // has no category. Absent on catalog rows (their group is resolved from
  // spec.category), so stored rows stay backward-compatible.
  groupKey?: string;
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

export function emptyEndingStockByGroup(): EndingStockByGroup {
  const out = {} as EndingStockByGroup;
  for (const group of PRIMAL_GROUPS) out[group.key] = 0;
  return out;
}

// -------------------------------------------------------------------
// Allocations — operator-entered reservations of a production group's
// stock (pieces) for a target date. RAW input, persisted per work date in
// Supabase (primal_allocations). The Availability Chart sums them per
// group and subtracts the total from Available Stock — so reserved stock
// is carved out of what's sellable and, via Ending Stock, out of the
// next day's carry-over pool.
//
// `id` is the stable client-generated key (crypto.randomUUID). The row is
// deducted from the date it was entered on (its work_date); `targetDate`
// records where the reserved stock is destined.
// -------------------------------------------------------------------
export type PrimalAllocation = {
  id: string;
  group: PrimalGroupKey;
  qtyPcs: number;
  targetDate: string; // YYYY-MM-DD
  label: string; // optional destination / note (may be empty)
};
export type AllocationsForDate = PrimalAllocation[];

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
  allocated: number; // pieces reserved via allocations LEAVING for a later date
  remainingProducts: number; // pieces arriving from allocations that TARGET this date
  availableStock: number; // expProd + openingStock + remainingProducts − specialCustomerOrders − allocated
  salesOrders: number; // today's order pieces from the per-SKU sections (below)
  endingStock: number; // availableStock − salesOrders (may be negative)
  shortage: number; // demand that exceeds availability
  status: AvailabilityStatus;
};

export type AvailabilityTotals = {
  expectedProduction: number;
  openingStock: number;
  specialCustomerOrders: number;
  allocated: number;
  remainingProducts: number;
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
// Each carries a STABLE id that is the storage / row key; `name` is display
// only. Ids are frozen constants (prefixed `fixed-` so they can never collide
// with the `cust-…` ids of manually added customers) — renaming a `name` later
// never moves the key, so saved orders can't be orphaned by a label change.
export const PRIMAL_CUSTOMERS = [
  { id: "fixed-curing-meatcutting", name: "Curing/Meatcutting" },
  { id: "fixed-sungiven-save-product", name: "Sungiven Save Product" },
  { id: "fixed-continental", name: "Continental" },
  { id: "fixed-arctic-monday", name: "Arctic Monday" },
  { id: "fixed-taiwan-monday", name: "Taiwan Monday" },
  { id: "fixed-polonia-tuesday", name: "Polonia Tuesday" },
  { id: "fixed-two-rivers-monday", name: "Two Rivers Monday" },
  { id: "fixed-hertel-hams", name: "Hertel Hams" },
  { id: "fixed-rwa-save-wednesday-thursday", name: "RWA Save Wednesday/Thursday" },
  { id: "fixed-bradner-freezer-freezer", name: "Bradner Freezer/Freezer" },
  { id: "fixed-stapleton", name: "Stapleton" },
] as const;

export type PrimalCustomerDef = (typeof PRIMAL_CUSTOMERS)[number];

// One customer's order pieces per production group. Pooled cuts (Ribs) take a
// single custom order rather than one per type, matching how production is
// shared. Keyed by group key — the catalog PrimalGroupKeys plus any custom
// availability group's id (custom groups get their own custom orders column).
export type CustomerGroupOrders = Record<string, number>;

// Persisted save shape: { "YYYY-MM-DD": { "<customerId>": { Butts: n, ... } } }
// The key is the stable id of the customer — a fixed PRIMAL_CUSTOMERS `fixed-…`
// id or a manually added customer's `cust-…` id (see CustomCustomer). Older
// payloads keyed fixed customers by display name; those are remapped to the
// stable id on read (see migrateCustomerOrders in primal-storage).
export type CustomerOrdersForDate = Record<string, CustomerGroupOrders>;
export type CustomerOrdersByDate = Record<string, CustomerOrdersForDate>;

// A manually added customer row appended to the custom orders matrix. Its orders
// live in CustomerOrdersForDate keyed by `id` — calculations sum over the map's
// values, so a free-form id key is safe and keeps the editable name decoupled
// from the orders. Persisted per date, like CustomRowsForDate.
export type CustomCustomer = { id: string; name: string };
export type CustomCustomersForDate = CustomCustomer[];
export type CustomCustomersByDate = Record<string, CustomCustomersForDate>;

// A manually added (ad-hoc) availability group appended to the Availability
// Chart for a single date. Only identity + display label are stored; its
// Expected Production is derived from the same whole-hog pool as every catalog
// group (yieldTotal × 2). It carries no categories, but — keyed by its id — it
// gets its own Custom Orders column and a Sales Orders section whose
// rows are ad-hoc CustomOrderRows tagged with its id. Persisted per date, like
// CustomCustomer. The id is the stable key, independent of the editable label.
export type CustomGroup = { id: string; label: string };
export type CustomGroupsForDate = CustomGroup[];
export type CustomGroupsByDate = Record<string, CustomGroupsForDate>;

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
