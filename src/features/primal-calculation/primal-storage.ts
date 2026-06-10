import {
  emptyCustomerGroupOrders,
  emptyProductOrder,
  PRIMAL_CATEGORIES,
  PRIMAL_GROUPS,
  type CustomerGroupOrders,
  type CustomerOrdersByDate,
  type CustomerOrdersForDate,
  type CustomOrderRow,
  type CustomRowsByDate,
  type CustomRowsForDate,
  type PrimalCategory,
  type PrimalOrdersByDate,
  type ProductOrder,
  type ProductOrdersForDate,
  type ProductSpec,
} from "./types";

// -------------------------------------------------------------------
// Local persistence layer for primal production orders.
//
// Two stores, both in localStorage so data survives refresh:
//   * COMMITTED — the saved orders, keyed exactly as the spec save shape:
//       { "YYYY-MM-DD": { "<sku>": { today_cases, today_pcs, ... } } }
//   * DRAFT     — per-date unsaved edits (auto-written on every change).
//
// Keeping this isolated means a future Supabase-backed save can replace
// just saveOrdersForDate()/readCommittedForDate() without touching the
// hook or UI.
// -------------------------------------------------------------------

const COMMITTED_KEY = "primal-calc.orders";
const DRAFT_KEY_PREFIX = "primal-calc.draft.";
const CUSTOMER_KEY = "primal-calc.customer-orders";
const CUSTOM_ROWS_KEY = "primal-calc.custom-rows";

function draftKey(date: string): string {
  return `${DRAFT_KEY_PREFIX}${date}`;
}

// Coerce an unknown value into a valid ProductOrder. Missing or invalid
// fields fall back to 0 so a partially corrupt store still loads.
function coerceOrder(raw: unknown): ProductOrder {
  const order = emptyProductOrder();
  if (!raw || typeof raw !== "object") return order;
  const obj = raw as Record<string, unknown>;
  for (const field of Object.keys(order) as (keyof ProductOrder)[]) {
    const v = obj[field];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      order[field] = Math.floor(v);
    }
  }
  return order;
}

function coerceOrdersForDate(raw: unknown): ProductOrdersForDate {
  if (!raw || typeof raw !== "object") return {};
  const out: ProductOrdersForDate = {};
  for (const [sku, value] of Object.entries(raw as Record<string, unknown>)) {
    out[sku] = coerceOrder(value);
  }
  return out;
}

// ----------------------------- Committed ----------------------------
export function readCommitted(): PrimalOrdersByDate {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COMMITTED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: PrimalOrdersByDate = {};
    for (const [date, orders] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      out[date] = coerceOrdersForDate(orders);
    }
    return out;
  } catch {
    return {};
  }
}

export function readCommittedForDate(date: string): ProductOrdersForDate {
  return readCommitted()[date] ?? {};
}

// Merge the given product orders into the committed store for a date and
// persist. Used by both per-category save (subset of skus) and global
// save (every sku). Returns the merged orders for the date.
export function saveOrdersForDate(
  date: string,
  orders: ProductOrdersForDate,
): ProductOrdersForDate {
  const all = readCommitted();
  const merged: ProductOrdersForDate = { ...(all[date] ?? {}), ...orders };
  all[date] = merged;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(COMMITTED_KEY, JSON.stringify(all));
    } catch {
      // ignore quota / access errors
    }
  }
  return merged;
}

// ------------------------------- Draft ------------------------------
export function readDraft(date: string): ProductOrdersForDate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(date));
    if (!raw) return null;
    return coerceOrdersForDate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeDraft(date: string, orders: ProductOrdersForDate): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(date), JSON.stringify(orders));
  } catch {
    // ignore
  }
}

export function clearDraft(date: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(date));
  } catch {
    // ignore
  }
}

// ------------------------- Customer orders --------------------------
// Per-date customer × category order matrix. Auto-persisted on every
// edit (no separate draft/commit split — the chart is informational and
// always reflects the latest typed values), keyed identically to the
// product store: { "YYYY-MM-DD": { "<customer>": { Butts: n, ... } } }.

function coerceCustomerGroupOrders(raw: unknown): CustomerGroupOrders {
  const orders = emptyCustomerGroupOrders();
  if (!raw || typeof raw !== "object") return orders;
  const obj = raw as Record<string, unknown>;
  for (const group of PRIMAL_GROUPS) {
    const v = obj[group.key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      orders[group.key] = Math.floor(v);
    }
  }
  return orders;
}

function coerceCustomerOrdersForDate(raw: unknown): CustomerOrdersForDate {
  if (!raw || typeof raw !== "object") return {};
  const out: CustomerOrdersForDate = {};
  for (const [customer, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    out[customer] = coerceCustomerGroupOrders(value);
  }
  return out;
}

function readCustomerOrders(): CustomerOrdersByDate {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CUSTOMER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: CustomerOrdersByDate = {};
    for (const [date, orders] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      out[date] = coerceCustomerOrdersForDate(orders);
    }
    return out;
  } catch {
    return {};
  }
}

export function readCustomerOrdersForDate(date: string): CustomerOrdersForDate {
  return readCustomerOrders()[date] ?? {};
}

export function saveCustomerOrdersForDate(
  date: string,
  orders: CustomerOrdersForDate,
): void {
  if (typeof window === "undefined") return;
  const all = readCustomerOrders();
  all[date] = orders;
  try {
    window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify(all));
  } catch {
    // ignore quota / access errors
  }
}

// --------------------------- Custom rows ----------------------------
// Per-date list of manually added order rows. Auto-persisted on every edit
// (no draft/commit split — like the customer matrix), keyed by date:
//   { "YYYY-MM-DD": [ { id, spec, order } ] }

function coerceCustomSpec(raw: unknown): ProductSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const category = obj.category;
  if (
    typeof category !== "string" ||
    !(PRIMAL_CATEGORIES as readonly string[]).includes(category)
  ) {
    return null;
  }
  const pieces = obj.piecesPerCase;
  return {
    sku: typeof obj.sku === "string" ? obj.sku : "",
    name: typeof obj.name === "string" ? obj.name : "",
    category: category as PrimalCategory,
    casePack: typeof obj.casePack === "string" ? obj.casePack : "",
    piecesPerCase:
      typeof pieces === "number" && Number.isFinite(pieces) && pieces >= 1
        ? Math.floor(pieces)
        : 1,
  };
}

function coerceCustomRow(raw: unknown): CustomOrderRow | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const spec = coerceCustomSpec(obj.spec);
  if (typeof obj.id !== "string" || !obj.id || !spec) return null;
  return { id: obj.id, spec, order: coerceOrder(obj.order) };
}

function coerceCustomRowsForDate(raw: unknown): CustomRowsForDate {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(coerceCustomRow)
    .filter((row): row is CustomOrderRow => row !== null);
}

function readCustomRows(): CustomRowsByDate {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_ROWS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: CustomRowsByDate = {};
    for (const [date, rows] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      out[date] = coerceCustomRowsForDate(rows);
    }
    return out;
  } catch {
    return {};
  }
}

export function readCustomRowsForDate(date: string): CustomRowsForDate {
  return readCustomRows()[date] ?? [];
}

export function saveCustomRowsForDate(
  date: string,
  rows: CustomRowsForDate,
): void {
  if (typeof window === "undefined") return;
  const all = readCustomRows();
  if (rows.length === 0) {
    delete all[date];
  } else {
    all[date] = rows;
  }
  try {
    window.localStorage.setItem(CUSTOM_ROWS_KEY, JSON.stringify(all));
  } catch {
    // ignore quota / access errors
  }
}

// NOTE: Calculated Ending Stock is no longer persisted here. It moved to
// Supabase (primal_ending_stock) so the day-to-day carry-over survives refresh
// and is shared across devices/users. See ending-stock-source.ts.
