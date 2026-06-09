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
import { loadHogIntakeForDate, saveHogIntakeRecord } from "../intake-source";
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
  emptyCustomerGroupOrders,
  emptyOverstockByGroup,
  emptyProductOrder,
  type CustomerOrdersForDate,
  type OrderField,
  type OverstockByGroup,
  type PrimalGroup,
  type PrimalGroupKey,
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
  // Yesterday's O/S carried in per group — the previous saved date's
  // calculated O/S. Loaded from storage on every date change; feeds the
  // Availability Chart's "Yesterday O/S" column.
  const [yesterdayOverstock, setYesterdayOverstock] =
    useState<OverstockByGroup>(emptyOverstockByGroup);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const hasHydrated = useRef(false);
  const activeIntakeToken = useRef(0);
  // Set before any non-user-driven setOrders so the draft-write effect
  // doesn't persist a freshly loaded value back as a new draft.
  const suppressNextWrite = useRef(false);

  // Live mirror of `intake` plus a debounce timer, used to persist Next Day
  // Projection edits back to the hog_intake row without re-saving on load.
  const intakeRef = useRef(intake);
  const nextDaySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    intakeRef.current = intake;
  }, [intake]);

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
      // Drop any pending Next Day save so it can't land on the new date.
      if (nextDaySaveTimer.current) clearTimeout(nextDaySaveTimer.current);
      setSaveState({ kind: "idle" });
      setDateState(nextDate);
      loadOrdersForDate(nextDate);
      void loadIntakeForDate(nextDate);
    },
    [loadIntakeForDate, loadOrdersForDate],
  );

  // Edit the Next Day Projection (owned by Hog Intake, but entered here).
  // Updates the in-memory intake immediately and debounce-persists the whole
  // record back to the hog_intake row so the value survives a refresh.
  const setNextDayField = useCallback(
    (field: "hog_count" | "side_orders" | "cooler_overstock", value: number) => {
      const clamped = clampNonNegativeInt(value);
      setIntake((prev) => ({
        ...prev,
        next_day: { ...prev.next_day, [field]: clamped },
      }));
      if (nextDaySaveTimer.current) clearTimeout(nextDaySaveTimer.current);
      nextDaySaveTimer.current = setTimeout(() => {
        void saveHogIntakeRecord(intakeRef.current).catch(() => {
          // Persisted-data integrity matters; surface failures to the user.
          setSaveState({
            kind: "error",
            scope: "next_day",
            message: "Failed to save Next Day Projection",
          });
        });
      }, 600);
    },
    [],
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

  // Bulk: add `delta` cases to every product's Today column across all of a
  // group's categories and re-derive Today pieces.
  const bumpGroupCases = useCallback((group: PrimalGroup, delta: number) => {
    setOrders((prev) => {
      const next = { ...prev };
      for (const category of group.categories) {
        for (const spec of specsForCategory(category)) {
          const current = next[spec.sku] ?? emptyProductOrder();
          const today_cases = clampNonNegativeInt(current.today_cases + delta);
          next[spec.sku] = {
            ...current,
            today_cases,
            today_pcs: casesToPieces(spec, today_cases),
          };
        }
      }
      return next;
    });
  }, []);

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

  // Set one customer's order for one group (pieces). Auto-persisted — the
  // customer chart is informational, so there's no draft/save split.
  const setCustomerOrder = useCallback(
    (customer: string, group: PrimalGroupKey, value: number) => {
      const clamped = clampNonNegativeInt(value);
      setCustomerOrders((prev) => {
        const current = prev[customer] ?? emptyCustomerGroupOrders();
        const next: CustomerOrdersForDate = {
          ...prev,
          [customer]: { ...current, [group]: clamped },
        };
        saveCustomerOrdersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // Bulk: clear every order field for all products across a group's categories.
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

  // Per-group calculated Today's O/S (pieces) — the Availability Chart's
  // todaysOverstock, derived from today's orders + intake + customer orders
  // + yesterday's carry-in. Persisted on Save so it becomes the next
  // production date's Yesterday O/S.
  const computeOverstockByGroup = useCallback((): OverstockByGroup => {
    const rows = buildAvailabilityRows(
      orders,
      intake.hog_counts,
      customerOrders,
      yesterdayOverstock,
    );
    const out = emptyOverstockByGroup();
    for (const row of rows) out[row.group] = row.todaysOverstock;
    return out;
  }, [orders, intake, customerOrders, yesterdayOverstock]);

  // Commit a group's orders (every SKU across its categories) to the
  // persistent store, plus its calculated O/S.
  const saveGroup = useCallback(
    async (group: PrimalGroup) => {
      const groupKey = group.key as PrimalGroupKey;
      setSaveState({ kind: "saving", scope: groupKey });
      try {
        const subset: ProductOrdersForDate = {};
        for (const category of group.categories) {
          for (const spec of specsForCategory(category)) {
            subset[spec.sku] = orders[spec.sku] ?? emptyProductOrder();
          }
        }
        saveOrdersForDate(date, subset);
        saveOverstockForDate(date, {
          [groupKey]: computeOverstockByGroup()[groupKey],
        });
        setSaveState({ kind: "saved", scope: group.key, at: Date.now() });
      } catch (err) {
        setSaveState({
          kind: "error",
          scope: group.key,
          message: err instanceof Error ? err.message : "Failed to save",
        });
      }
    },
    [date, orders, computeOverstockByGroup],
  );

  // Commit every group at once, plus all calculated O/S. Clears the draft
  // since committed and working copy now match.
  const saveAll = useCallback(async () => {
    setSaveState({ kind: "saving", scope: "all" });
    try {
      saveOrdersForDate(date, orders);
      saveOverstockForDate(date, computeOverstockByGroup());
      clearDraft(date);
      setSaveState({ kind: "saved", scope: "all", at: Date.now() });
    } catch (err) {
      setSaveState({
        kind: "error",
        scope: "all",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [date, orders, computeOverstockByGroup]);

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
    setNextDayField,
    setCustomerOrder,
    bumpGroupCases,
    clearGroup,
    saveGroup,
    saveAll,
    applyImportedOrders,
  };
}

export type PrimalCalculationStateApi = ReturnType<
  typeof usePrimalCalculationState
>;
