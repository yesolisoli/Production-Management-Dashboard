"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { casesToPieces, clampNonNegativeInt } from "../calculations";
import { PRODUCT_SPEC_BY_SKU, specsForCategory } from "../product-specs";
import {
  clearDraft,
  readCommittedForDate,
  readDraft,
  writeDraft,
} from "../primal-storage";
import {
  backfillOrdersForDate,
  fetchOrdersForDate,
  saveOrdersForDate,
} from "../orders-source";
import { getCurrentUserId } from "@/lib/supabase/current-user";
import {
  CASE_TO_PCS,
  emptyProductOrder,
  type OrderField,
  type PrimalGroup,
  type ProductOrder,
  type ProductOrdersForDate,
} from "../types";

type UsePrimalOrdersStateArgs = {
  date: string;
  // Hydration gate owned by the orchestrator. Draft writes are suppressed until
  // the initial mount load has populated state, exactly as before.
  hasHydrated: MutableRefObject<boolean>;
};

// Per-SKU production orders for the selected date, with the draft/committed
// localStorage split. Owns the orders slice + its draft auto-persist; the
// orchestrator drives loads and composes the compound (orders + ending stock)
// saves.
export function usePrimalOrdersState({
  date,
  hasHydrated,
}: UsePrimalOrdersStateArgs) {
  const [orders, setOrders] = useState<ProductOrdersForDate>({});
  // Set before any non-user-driven setOrders so the draft-write effect doesn't
  // persist a freshly loaded value back as a new draft.
  const suppressNextWrite = useRef(false);
  // Guards the async committed read: a newer load (rapid date switch) bumps the
  // token so a stale in-flight resolve can't clobber the current date's orders.
  const activeLoadToken = useRef(0);

  // Order resolution for a date, in priority order:
  //   1. local draft (unsaved edits) — always wins, no server read needed
  //   2. Supabase committed orders (primal_orders) — the shared source of truth
  //   3. legacy localStorage committed store — fallback only when Supabase has
  //      no rows for the date; that legacy data is then lazily backfilled to
  //      Supabase once (insert-only, never overwriting existing rows).
  // Draft edits never leave localStorage; only committed orders live on the
  // server. Suppress is armed up-front so the date-change effect tick can't
  // persist the previous date's orders into the new date's draft while the
  // async committed read is still in flight, then re-armed before the resolved
  // value lands.
  const loadForDate = useCallback(async (nextDate: string) => {
    const token = ++activeLoadToken.current;
    suppressNextWrite.current = true;

    const draft = readDraft(nextDate);
    if (draft) {
      setOrders(draft);
      return;
    }

    let resolved: ProductOrdersForDate;
    try {
      const server = await fetchOrdersForDate(nextDate);
      if (Object.keys(server).length > 0) {
        resolved = server;
      } else {
        const local = readCommittedForDate(nextDate);
        if (Object.keys(local).length > 0) {
          // Lazy one-date backfill — best-effort and fully detached from the
          // load: the value is already resolved from `local`, so a failure must
          // neither block the load nor surface to the user. The explicit
          // .catch keeps a failed backfill from becoming an unhandled
          // rejection; the date simply backfills again on a later load.
          void getCurrentUserId()
            .then((userId) => backfillOrdersForDate(nextDate, local, userId))
            .catch(() => {});
        }
        resolved = local;
      }
    } catch {
      // Supabase read failed — degrade to the legacy localStorage committed
      // store so the screen still renders.
      resolved = readCommittedForDate(nextDate);
    }

    if (token !== activeLoadToken.current) return; // superseded by a newer load
    suppressNextWrite.current = true;
    setOrders(resolved);
  }, []);

  // Auto-persist draft on every edit (gated until after hydration).
  useEffect(() => {
    if (!hasHydrated.current) return;
    if (suppressNextWrite.current) {
      suppressNextWrite.current = false;
      return;
    }
    writeDraft(date, orders);
  }, [date, orders, hasHydrated]);

  // Edit one field of one product's order. Editing a *_cases field also
  // auto-derives its paired *_pcs from the product's case pack.
  const setOrderField = useCallback(
    (sku: string, field: OrderField, value: number) => {
      const spec = PRODUCT_SPEC_BY_SKU[sku];
      if (!spec) return;
      const clamped = clampNonNegativeInt(value);
      setOrders((prev) => {
        const current = prev[sku] ?? emptyProductOrder();
        const next: ProductOrder = { ...current, [field]: clamped };
        const pcsField = CASE_TO_PCS[field];
        if (pcsField) {
          next[pcsField] = casesToPieces(spec, clamped);
        }
        return { ...prev, [sku]: next };
      });
    },
    [],
  );

  // Clear every order for a group — zero out all SKUs across its categories.
  // Treated as a normal edit so the draft auto-persists (surviving refresh).
  const clearGroup = useCallback((group: PrimalGroup) => {
    setOrders((prev) => {
      const next = { ...prev };
      for (const category of group.categories) {
        for (const spec of specsForCategory(category)) {
          next[spec.sku] = emptyProductOrder();
        }
      }
      return next;
    });
  }, []);

  // Merge imported per-SKU orders over the working copy. Imported SKUs
  // overwrite; untouched SKUs are preserved. Treated as a normal edit.
  const applyImportedOrders = useCallback((imported: ProductOrdersForDate) => {
    setOrders((prev) => ({ ...prev, ...imported }));
  }, []);

  // Commit a group's orders (every SKU across its categories) to Supabase.
  // Upserts only this group's SKU subset, so other groups' rows are untouched.
  const persistGroupOrders = useCallback(
    async (nextDate: string, group: PrimalGroup) => {
      const subset: ProductOrdersForDate = {};
      for (const category of group.categories) {
        for (const spec of specsForCategory(category)) {
          subset[spec.sku] = orders[spec.sku] ?? emptyProductOrder();
        }
      }
      const userId = await getCurrentUserId();
      await saveOrdersForDate(nextDate, subset, userId);
    },
    [orders],
  );

  // Commit every order for the date to Supabase.
  const persistAllOrders = useCallback(
    async (nextDate: string) => {
      const userId = await getCurrentUserId();
      await saveOrdersForDate(nextDate, orders, userId);
    },
    [orders],
  );

  const clearDraftForDate = useCallback((nextDate: string) => {
    clearDraft(nextDate);
  }, []);

  return {
    orders,
    loadForDate,
    setOrderField,
    clearGroup,
    applyImportedOrders,
    persistGroupOrders,
    persistAllOrders,
    clearDraftForDate,
  };
}
