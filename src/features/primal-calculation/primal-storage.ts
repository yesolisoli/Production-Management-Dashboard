import {
  emptyCustomerGroupOrders,
  emptyOverstockByGroup,
  emptyProductOrder,
  PRIMAL_GROUPS,
  type CustomerGroupOrders,
  type CustomerOrdersByDate,
  type CustomerOrdersForDate,
  type OverstockByDate,
  type OverstockByGroup,
  type PrimalOrdersByDate,
  type ProductOrder,
  type ProductOrdersForDate,
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
const OVERSTOCK_KEY = "primal-calc.overstock";

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

// ---------------------- Calculated Today's O/S ----------------------
// Per-date, per-group calculated overstock (in pieces). Written on Save
// from the Availability Chart's Today's O/S; read back as the next
// production date's Yesterday O/S (the carry-over). Keyed:
//   { "YYYY-MM-DD": { "<group>": pcs } }

function coerceOverstockByGroup(raw: unknown): OverstockByGroup {
  const out = emptyOverstockByGroup();
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const group of PRIMAL_GROUPS) {
    const v = obj[group.key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[group.key] = Math.floor(v);
    }
  }
  return out;
}

function readOverstock(): OverstockByDate {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERSTOCK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: OverstockByDate = {};
    for (const [date, byGroup] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      out[date] = coerceOverstockByGroup(byGroup);
    }
    return out;
  } catch {
    return {};
  }
}

export function readOverstockForDate(date: string): OverstockByGroup {
  return readOverstock()[date] ?? emptyOverstockByGroup();
}

// Merge the given per-group O/S into the store for a date and persist.
// Merging (rather than replacing) lets a per-group Save write just its own
// group without clobbering the others.
export function saveOverstockForDate(
  date: string,
  byGroup: Partial<OverstockByGroup>,
): void {
  if (typeof window === "undefined") return;
  const all = readOverstock();
  all[date] = { ...(all[date] ?? emptyOverstockByGroup()), ...byGroup };
  try {
    window.localStorage.setItem(OVERSTOCK_KEY, JSON.stringify(all));
  } catch {
    // ignore quota / access errors
  }
}

// The carry-over source: the most recent saved date strictly before
// `beforeDate`. Dates are "YYYY-MM-DD" so a lexicographic compare is a
// correct chronological compare. Returns zeros when nothing precedes it
// (e.g. the very first production date), and skips gaps (weekends) by
// taking the latest prior date rather than calendar −1.
export function readPreviousOverstock(beforeDate: string): OverstockByGroup {
  const all = readOverstock();
  let latest: string | null = null;
  for (const date of Object.keys(all)) {
    if (date < beforeDate && (latest === null || date > latest)) {
      latest = date;
    }
  }
  return latest === null ? emptyOverstockByGroup() : all[latest];
}
