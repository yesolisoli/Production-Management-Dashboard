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
  saveOrdersForDate,
  writeDraft,
} from "../primal-storage";
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

  // Order resolution for a date: local draft (unsaved edits — newest, wins),
  // then the committed store, then empty.
  const loadForDate = useCallback((nextDate: string) => {
    const resolved = readDraft(nextDate) ?? readCommittedForDate(nextDate);
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

  // Commit a group's orders (every SKU across its categories) to the store.
  const persistGroupOrders = useCallback(
    (nextDate: string, group: PrimalGroup) => {
      const subset: ProductOrdersForDate = {};
      for (const category of group.categories) {
        for (const spec of specsForCategory(category)) {
          subset[spec.sku] = orders[spec.sku] ?? emptyProductOrder();
        }
      }
      saveOrdersForDate(nextDate, subset);
    },
    [orders],
  );

  // Commit every order for the date.
  const persistAllOrders = useCallback(
    (nextDate: string) => {
      saveOrdersForDate(nextDate, orders);
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
