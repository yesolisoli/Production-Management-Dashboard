"use client";

import { SUPABASE_ENABLED } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import {
  emptyProductOrder,
  type ProductOrder,
  type ProductOrdersForDate,
} from "./types";

// -------------------------------------------------------------------
// Supabase persistence for the COMMITTED per-SKU production orders (the
// values previously stored only in the localStorage key
// `primal-calc.orders`). One row per (work_date, sku) in `primal_orders`.
//
// Only an explicit Save writes here; per-keystroke drafts stay in
// localStorage (see primal-storage.ts / usePrimalOrdersState). Saving is
// an UPSERT of just the passed SKU subset, so a per-group Save never
// deletes or overwrites the other groups' rows.
//
// Resilient-by-design, matching ending-stock-source.ts: when Supabase
// isn't configured, fetch returns {} and the writes are no-ops so the
// screen still renders off the localStorage fallback. Real query failures
// throw so callers can surface them.
// -------------------------------------------------------------------

type OrderRow = {
  sku: string;
  today_cases: number;
  today_pcs: number;
};

// Coerce a DB row's numeric fields into a valid ProductOrder, matching the
// existing localStorage coercion (non-negative, finite, floored, default 0).
function coerceOrder(raw: { today_cases: unknown; today_pcs: unknown }): ProductOrder {
  const order = emptyProductOrder();
  if (
    typeof raw.today_cases === "number" &&
    Number.isFinite(raw.today_cases) &&
    raw.today_cases >= 0
  ) {
    order.today_cases = Math.floor(raw.today_cases);
  }
  if (
    typeof raw.today_pcs === "number" &&
    Number.isFinite(raw.today_pcs) &&
    raw.today_pcs >= 0
  ) {
    order.today_pcs = Math.floor(raw.today_pcs);
  }
  return order;
}

function ordersToRows(
  date: string,
  orders: ProductOrdersForDate,
  userId: string | null,
): Array<{
  work_date: string;
  sku: string;
  today_cases: number;
  today_pcs: number;
  updated_by: string | null;
}> {
  return Object.entries(orders).map(([sku, order]) => ({
    work_date: date,
    sku,
    today_cases: Math.max(0, Math.floor(order.today_cases)),
    today_pcs: Math.max(0, Math.floor(order.today_pcs)),
    updated_by: userId,
  }));
}

// All committed orders for a date, as ProductOrdersForDate. Returns {} when
// Supabase is disabled or the date has no rows yet (callers fall back to the
// legacy localStorage committed store).
export async function fetchOrdersForDate(
  date: string,
): Promise<ProductOrdersForDate> {
  if (!SUPABASE_ENABLED) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from("primal_orders")
    .select("sku, today_cases, today_pcs")
    .eq("work_date", date);
  if (error) throw new Error(error.message);
  const out: ProductOrdersForDate = {};
  for (const row of (data ?? []) as OrderRow[]) {
    out[row.sku] = coerceOrder(row);
  }
  return out;
}

// Explicit Save. Upserts ONLY the provided SKU subset on (work_date, sku).
// ignoreDuplicates:false so an existing row's values are overwritten with the
// saved ones; rows for SKUs not in `orders` are left untouched (never deleted),
// which is what makes a per-group Save safe. No-op when nothing to write or
// Supabase is disabled.
export async function saveOrdersForDate(
  date: string,
  orders: ProductOrdersForDate,
  userId: string | null = null,
): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  const rows = ordersToRows(date, orders, userId);
  if (rows.length === 0) return;
  const supabase = createClient();

  // Skip no-op writes. A Save re-upserts every SKU in its subset even when the
  // values are unchanged, and each identical upsert would still bump
  // `updated_at` and create a meaningless audit-log entry. Read the currently
  // stored values first and upsert only the SKUs that actually changed (or have
  // no stored row yet — `stored.get` is undefined, so those still insert).
  const { data: existing, error: readError } = await supabase
    .from("primal_orders")
    .select("sku, today_cases, today_pcs")
    .eq("work_date", date)
    .in(
      "sku",
      rows.map((r) => r.sku),
    );
  if (readError) throw new Error(readError.message);
  const stored = new Map(
    ((existing ?? []) as OrderRow[]).map((r) => [r.sku, r]),
  );
  const changed = rows.filter((r) => {
    const prev = stored.get(r.sku);
    return (
      prev === undefined ||
      prev.today_cases !== r.today_cases ||
      prev.today_pcs !== r.today_pcs
    );
  });
  if (changed.length === 0) return;

  const { error } = await supabase
    .from("primal_orders")
    .upsert(changed, { onConflict: "work_date,sku", ignoreDuplicates: false });
  if (error) throw new Error(error.message);
}

// One-time lazy migration of a date's legacy localStorage committed orders.
// ignoreDuplicates:true so it INSERTs only the SKUs that have no row yet and
// never overwrites an existing Supabase row (a value the user has already
// saved wins over the stale local copy). No-op when Supabase is disabled.
export async function backfillOrdersForDate(
  date: string,
  orders: ProductOrdersForDate,
  userId: string | null = null,
): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  const rows = ordersToRows(date, orders, userId);
  if (rows.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("primal_orders")
    .upsert(rows, { onConflict: "work_date,sku", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
