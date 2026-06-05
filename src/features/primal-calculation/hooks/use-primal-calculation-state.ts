"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyHogIntakeRecord,
  type HogIntakeRecord,
} from "@/features/hog-intake/types";
import {
  buildAvailabilityRows,
  casesToPieces,
  clampNonNegativeInt,
} from "../calculations";
import { loadHogIntakeForDate } from "../intake-source";
import {
  PRODUCT_SPEC_BY_SKU,
  specsForCategory,
} from "../product-specs";
import {
  clearDraft,
  readCommittedForDate,
  readCustomerOrdersForDate,
  readDraft,
  readPreviousOverstock,
  saveCustomerOrdersForDate,
  saveOrdersForDate,
  saveOverstockForDate,
  writeDraft,
} from "../primal-storage";
import {
  CASE_TO_PCS,
  emptyCustomerCategoryOrders,
  emptyOverstockByCategory,
  emptyProductOrder,
  type CustomerOrdersForDate,
  type OrderField,
  type OverstockByCategory,
  type PrimalCategory,
  type ProductOrder,
  type ProductOrdersForDate,
} from "../types";

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type IntakeStatus =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "missing" } // no Hog Intake record exists for the selected date
  | { kind: "error"; message: string };

// Transient save indicator. `scope` is a category name or "all".
export type SaveState =
  | { kind: "idle" }
  | { kind: "saving"; scope: string }
  | { kind: "saved"; scope: string; at: number }
  | { kind: "error"; scope: string; message: string };

// Single source of truth for the Primal Calculation screen.
//
// State held here is RAW ONLY: the selected date, the read-only hog
// intake record for that date, and the editable orders map. Expected
// yields and totals are derived in components via the calculations
// helpers — never stored here.
//
// Order resolution when arriving at a date (mirrors Hog Intake):
//   1. Local draft (unsaved edits — newest, wins)
//   2. Committed store for that date
//   3. Empty
export function usePrimalCalculationState() {
  const [date, setDateState] = useState<string>(todayString);
  const [intake, setIntake] = useState<HogIntakeRecord>(() =>
    emptyHogIntakeRecord(todayString()),
  );
  const [intakeStatus, setIntakeStatus] = useState<IntakeStatus>({
    kind: "loading",
  });
  const [orders, setOrders] = useState<ProductOrdersForDate>({});
  const [customerOrders, setCustomerOrders] = useState<CustomerOrdersForDate>(
    {},
  );
  // Yesterday's O/S carried in per category — the previous saved date's
  // calculated O/S. Loaded from storage on every date change; feeds the
  // Availability Chart's "Yesterday O/S" column.
  const [yesterdayOverstock, setYesterdayOverstock] =
    useState<OverstockByCategory>(emptyOverstockByCategory);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const hasHydrated = useRef(false);
  const activeIntakeToken = useRef(0);
  // Set before any non-user-driven setOrders so the draft-write effect
  // doesn't persist a freshly loaded value back as a new draft.
  const suppressNextWrite = useRef(false);

  const loadIntakeForDate = useCallback(async (nextDate: string) => {
    const token = ++activeIntakeToken.current;
    setIntakeStatus({ kind: "loading" });
    try {
      const record = await loadHogIntakeForDate(nextDate);
      if (token !== activeIntakeToken.current) return; // stale
      if (record) {
        setIntake(record);
        setIntakeStatus({ kind: "ready" });
      } else {
        // No DB record for this date — zero counts, no mock substitution.
        setIntake(emptyHogIntakeRecord(nextDate));
        setIntakeStatus({ kind: "missing" });
      }
    } catch (err) {
      if (token !== activeIntakeToken.current) return;
      setIntake(emptyHogIntakeRecord(nextDate));
      setIntakeStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load intake",
      });
    }
  }, []);

  const loadOrdersForDate = useCallback((nextDate: string) => {
    const resolved = readDraft(nextDate) ?? readCommittedForDate(nextDate);
    suppressNextWrite.current = true;
    setOrders(resolved);
    setCustomerOrders(readCustomerOrdersForDate(nextDate));
    // Carry the previous saved date's calculated O/S in as Yesterday O/S.
    setYesterdayOverstock(readPreviousOverstock(nextDate));
  }, []);

  // Mount — load today's intake + orders.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initial = todayString();
      loadOrdersForDate(initial);
      await loadIntakeForDate(initial);
      if (!cancelled) hasHydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only — subsequent date changes go through setDate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-persist draft on every edit (gated until after hydration).
  useEffect(() => {
    if (!hasHydrated.current) return;
    if (suppressNextWrite.current) {
      suppressNextWrite.current = false;
      return;
    }
    writeDraft(date, orders);
  }, [date, orders]);

  const setDate = useCallback(
    (nextDate: string) => {
      if (!nextDate) return;
      setSaveState({ kind: "idle" });
      setDateState(nextDate);
      loadOrdersForDate(nextDate);
      void loadIntakeForDate(nextDate);
    },
    [loadIntakeForDate, loadOrdersForDate],
  );

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

  // Bulk: add `delta` cases to every product's Today column in a category
  // and re-derive Today pieces.
  const bumpCategoryCases = useCallback(
    (category: PrimalCategory, delta: number) => {
      setOrders((prev) => {
        const next = { ...prev };
        for (const spec of specsForCategory(category)) {
          const current = next[spec.sku] ?? emptyProductOrder();
          const today_cases = clampNonNegativeInt(current.today_cases + delta);
          next[spec.sku] = {
            ...current,
            today_cases,
            today_pcs: casesToPieces(spec, today_cases),
          };
        }
        return next;
      });
    },
    [],
  );

  // Apply a CSV import: merge the imported per-SKU orders over the
  // current working copy. Imported SKUs overwrite; untouched SKUs are
  // preserved. Treated as a normal edit, so the draft auto-persists and
  // the operator can review before hitting Save.
  const applyImportedOrders = useCallback(
    (imported: ProductOrdersForDate) => {
      setOrders((prev) => ({ ...prev, ...imported }));
    },
    [],
  );

  // Set one customer's order for one category (pieces). Auto-persisted —
  // the customer chart is informational, so there's no draft/save split.
  const setCustomerOrder = useCallback(
    (customer: string, category: PrimalCategory, value: number) => {
      const clamped = clampNonNegativeInt(value);
      setCustomerOrders((prev) => {
        const current = prev[customer] ?? emptyCustomerCategoryOrders();
        const next: CustomerOrdersForDate = {
          ...prev,
          [customer]: { ...current, [category]: clamped },
        };
        saveCustomerOrdersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // Bulk: clear every order field for all products in a category.
  const clearCategory = useCallback((category: PrimalCategory) => {
    setOrders((prev) => {
      const next = { ...prev };
      for (const spec of specsForCategory(category)) {
        next[spec.sku] = emptyProductOrder();
      }
      return next;
    });
  }, []);

  // Per-category calculated Today's O/S (pieces) — the Availability Chart's
  // todaysOverstock, derived from today's orders + intake + customer orders
  // + yesterday's carry-in. Persisted on Save so it becomes the next
  // production date's Yesterday O/S.
  const computeOverstockByCategory =
    useCallback((): OverstockByCategory => {
      const rows = buildAvailabilityRows(
        orders,
        intake.hog_counts,
        customerOrders,
        yesterdayOverstock,
      );
      const out = emptyOverstockByCategory();
      for (const row of rows) out[row.category] = row.todaysOverstock;
      return out;
    }, [orders, intake, customerOrders, yesterdayOverstock]);

  // Commit a category's orders to the persistent store, plus its
  // calculated O/S.
  const saveCategory = useCallback(
    async (category: PrimalCategory) => {
      setSaveState({ kind: "saving", scope: category });
      try {
        const subset: ProductOrdersForDate = {};
        for (const spec of specsForCategory(category)) {
          subset[spec.sku] = orders[spec.sku] ?? emptyProductOrder();
        }
        saveOrdersForDate(date, subset);
        saveOverstockForDate(date, {
          [category]: computeOverstockByCategory()[category],
        });
        setSaveState({ kind: "saved", scope: category, at: Date.now() });
      } catch (err) {
        setSaveState({
          kind: "error",
          scope: category,
          message: err instanceof Error ? err.message : "Failed to save",
        });
      }
    },
    [date, orders, computeOverstockByCategory],
  );

  // Commit every category at once, plus all calculated O/S. Clears the
  // draft since committed and working copy now match.
  const saveAll = useCallback(async () => {
    setSaveState({ kind: "saving", scope: "all" });
    try {
      saveOrdersForDate(date, orders);
      saveOverstockForDate(date, computeOverstockByCategory());
      clearDraft(date);
      setSaveState({ kind: "saved", scope: "all", at: Date.now() });
    } catch (err) {
      setSaveState({
        kind: "error",
        scope: "all",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [date, orders, computeOverstockByCategory]);

  return {
    date,
    intake,
    intakeStatus,
    orders,
    customerOrders,
    yesterdayOverstock,
    saveState,
    setDate,
    setOrderField,
    setCustomerOrder,
    bumpCategoryCases,
    clearCategory,
    saveCategory,
    saveAll,
    applyImportedOrders,
  };
}

export type PrimalCalculationStateApi = ReturnType<
  typeof usePrimalCalculationState
>;
