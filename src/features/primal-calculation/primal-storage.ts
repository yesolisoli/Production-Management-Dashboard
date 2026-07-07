import {
  emptyCustomerGroupOrders,
  emptyProductOrder,
  PRIMAL_CATEGORIES,
  PRIMAL_CUSTOMERS,
  type CustomCustomer,
  type CustomCustomersByDate,
  type CustomCustomersForDate,
  type CustomGroup,
  type CustomGroupsByDate,
  type CustomGroupsForDate,
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
import { createDateDraftStore } from "@/lib/local-storage";

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
const CUSTOM_CUSTOMERS_KEY = "primal-calc.custom-customers";
const CUSTOM_GROUPS_KEY = "primal-calc.custom-groups";
const CUSTOM_ROWS_KEY = "primal-calc.custom-rows";

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
const draftStore = createDateDraftStore<ProductOrdersForDate>(
  DRAFT_KEY_PREFIX,
  coerceOrdersForDate,
);

export const readDraft = draftStore.readDraft;
export const writeDraft = draftStore.writeDraft;
export const clearDraft = draftStore.clearDraft;

// ------------------------- Customer orders --------------------------
// Per-date customer × category order matrix. Auto-persisted on every
// edit (no separate draft/commit split — the chart is informational and
// always reflects the latest typed values), keyed identically to the
// product store: { "YYYY-MM-DD": { "<customer>": { Butts: n, ... } } }.

function coerceCustomerGroupOrders(raw: unknown): CustomerGroupOrders {
  const orders = emptyCustomerGroupOrders();
  if (!raw || typeof raw !== "object") return orders;
  const obj = raw as Record<string, unknown>;
  // Keep every valid numeric entry, not just the catalog groups — custom
  // availability groups store their custom orders column keyed by the group's id.
  for (const [key, v] of Object.entries(obj)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      orders[key] = Math.floor(v);
    }
  }
  return orders;
}

// Map a fixed customer's CURRENT display name → its stable id. Drives the
// migration of payloads saved before fixed customers had stable ids.
const FIXED_NAME_TO_ID: Record<string, string> = Object.fromEntries(
  PRIMAL_CUSTOMERS.map((c) => [c.name, c.id]),
);

// Remap legacy display-name keys for the fixed customers to their stable ids.
//
// Idempotent: keys that are already stable ids (fixed-… / cust-…) or otherwise
// unknown are kept verbatim — only keys that exactly equal a current fixed
// display name are remapped, and on already-migrated data no key matches a
// name, so it's a no-op. When both a legacy name key and its target stable id
// are present, they merge per group preferring the existing stable-id value and
// filling only the groups it lacks (two passes make this order-independent).
function migrateCustomerOrders(
  orders: CustomerOrdersForDate,
): CustomerOrdersForDate {
  const out: CustomerOrdersForDate = {};
  // Pass 1 — copy every already-canonical key (stable fixed id, cust-* custom
  // id, or unknown). Legacy display-name keys are deferred to pass 2.
  for (const [key, perGroup] of Object.entries(orders)) {
    if (FIXED_NAME_TO_ID[key] !== undefined) continue;
    out[key] = { ...perGroup };
  }
  // Pass 2 — remap legacy display-name keys to their stable id. If the id
  // already exists (from pass 1), keep its values and fill only missing groups.
  for (const [key, perGroup] of Object.entries(orders)) {
    const id = FIXED_NAME_TO_ID[key];
    if (id === undefined) continue;
    if (out[id] === undefined) {
      out[id] = { ...perGroup };
    } else {
      const merged = { ...out[id] };
      for (const [group, v] of Object.entries(perGroup)) {
        if (merged[group] === undefined) merged[group] = v;
      }
      out[id] = merged;
    }
  }
  return out;
}

function coerceCustomerOrdersForDate(raw: unknown): CustomerOrdersForDate {
  if (!raw || typeof raw !== "object") return {};
  const out: CustomerOrdersForDate = {};
  for (const [customer, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    out[customer] = coerceCustomerGroupOrders(value);
  }
  return migrateCustomerOrders(out);
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

// ------------------------ Custom customers --------------------------
// Per-date list of manually added customer rows for the custom orders matrix.
// Only the row's identity + display name live here; its per-group order
// pieces are stored in the customer-orders store above, keyed by `id`.
// Auto-persisted on every edit, keyed by date.

function coerceCustomCustomer(raw: unknown): CustomCustomer | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) return null;
  return { id: obj.id, name: typeof obj.name === "string" ? obj.name : "" };
}

function coerceCustomCustomersForDate(raw: unknown): CustomCustomersForDate {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(coerceCustomCustomer)
    .filter((row): row is CustomCustomer => row !== null);
}

function readCustomCustomers(): CustomCustomersByDate {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_CUSTOMERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: CustomCustomersByDate = {};
    for (const [date, rows] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      out[date] = coerceCustomCustomersForDate(rows);
    }
    return out;
  } catch {
    return {};
  }
}

export function readCustomCustomersForDate(
  date: string,
): CustomCustomersForDate {
  return readCustomCustomers()[date] ?? [];
}

export function saveCustomCustomersForDate(
  date: string,
  rows: CustomCustomersForDate,
): void {
  if (typeof window === "undefined") return;
  const all = readCustomCustomers();
  if (rows.length === 0) {
    delete all[date];
  } else {
    all[date] = rows;
  }
  try {
    window.localStorage.setItem(CUSTOM_CUSTOMERS_KEY, JSON.stringify(all));
  } catch {
    // ignore quota / access errors
  }
}

// ------------------------- Custom groups ----------------------------
// Per-date list of operator-added availability groups for the Availability
// Chart. Only identity + display label live here; every other figure is
// derived (see buildCustomGroupAvailability). Auto-persisted on every edit,
// keyed by date — mirrors the custom-customers store above.

function coerceCustomGroup(raw: unknown): CustomGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) return null;
  return { id: obj.id, label: typeof obj.label === "string" ? obj.label : "" };
}

function coerceCustomGroupsForDate(raw: unknown): CustomGroupsForDate {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(coerceCustomGroup)
    .filter((row): row is CustomGroup => row !== null);
}

function readCustomGroups(): CustomGroupsByDate {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: CustomGroupsByDate = {};
    for (const [date, rows] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      out[date] = coerceCustomGroupsForDate(rows);
    }
    return out;
  } catch {
    return {};
  }
}

export function readCustomGroupsForDate(date: string): CustomGroupsForDate {
  return readCustomGroups()[date] ?? [];
}

export function saveCustomGroupsForDate(
  date: string,
  rows: CustomGroupsForDate,
): void {
  if (typeof window === "undefined") return;
  const all = readCustomGroups();
  if (rows.length === 0) {
    delete all[date];
  } else {
    all[date] = rows;
  }
  try {
    window.localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(all));
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
  const row: CustomOrderRow = { id: obj.id, spec, order: coerceOrder(obj.order) };
  // Preserve the explicit owning group (custom-group rows) when present.
  if (typeof obj.groupKey === "string" && obj.groupKey) {
    row.groupKey = obj.groupKey;
  }
  return row;
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
