import {
  emptyProductOrder,
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
