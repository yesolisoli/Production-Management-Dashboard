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
  fetchPreviousEndingStock,
  saveEndingStockForDate,
} from "../ending-stock-source";
import {
  PRODUCT_SPEC_BY_SKU,
  specsForCategory,
} from "../product-specs";
import {
  clearDraft,
  readCommittedForDate,
  readCustomCustomersForDate,
  readCustomerOrdersForDate,
  readCustomRowsForDate,
  readDraft,
  saveCustomCustomersForDate,
  saveCustomerOrdersForDate,
  saveCustomRowsForDate,
  saveOrdersForDate,
  writeDraft,
} from "../primal-storage";
import {
  CASE_TO_PCS,
  emptyCustomerGroupOrders,
  emptyCustomSpec,
  emptyEndingStockByGroup,
  emptyProductOrder,
  PRIMAL_GROUPS,
  type CustomCustomersForDate,
  type CustomerOrdersForDate,
  type CustomRowsForDate,
  type EndingStockByGroup,
  type OrderField,
  type PrimalGroup,
  type PrimalGroupKey,
  type ProductOrder,
  type ProductOrdersForDate,
  type ProductSpec,
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
  // Manually added customer rows for the reservation matrix (selected date).
  // Identity + display name only; their order pieces live in customerOrders
  // keyed by id. Auto-persisted per date — see addCustomCustomer.
  const [customCustomers, setCustomCustomers] =
    useState<CustomCustomersForDate>([]);
  // Manually added (ad-hoc) order rows for the selected date. Self-contained
  // and auto-persisted per date — see CustomOrderRow.
  const [customRows, setCustomRows] = useState<CustomRowsForDate>([]);
  // Opening stock carried in per group — the previous saved date's ending
  // stock, fetched from Supabase on every date change. Feeds the
  // Availability Chart's "Opening Stock" column.
  const [openingStock, setOpeningStock] =
    useState<EndingStockByGroup>(emptyEndingStockByGroup);
  // True once the carry-in for the current date has finished loading. The
  // auto-persist effect waits for this so it never writes today's ending
  // stock using the previous date's stale opening value during the fetch.
  const [openingStockLoaded, setOpeningStockLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const hasHydrated = useRef(false);
  const activeIntakeToken = useRef(0);
  const activeOpeningStockToken = useRef(0);
  // Debounce timer for auto-persisting the recalculated Ending Stock.
  const endingStockSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Set before any non-user-driven setOrders so the draft-write effect
  // doesn't persist a freshly loaded value back as a new draft.
  const suppressNextWrite = useRef(false);
  // Monotonic suffix so two rows added in the same millisecond get distinct ids.
  const customRowSeq = useRef(0);
  const customCustomerSeq = useRef(0);

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
    setCustomCustomers(readCustomCustomersForDate(nextDate));
    setCustomRows(readCustomRowsForDate(nextDate));
  }, []);

  // Carry the previous work date's saved Ending Stock in as this date's
  // Opening Stock. Async (Supabase) and token-guarded so a rapid date change
  // can't let a slow earlier fetch overwrite a newer one.
  const loadOpeningStock = useCallback(async (nextDate: string) => {
    const token = ++activeOpeningStockToken.current;
    setOpeningStockLoaded(false);
    try {
      const previous = await fetchPreviousEndingStock(nextDate);
      if (token !== activeOpeningStockToken.current) return; // stale
      setOpeningStock(previous);
    } catch {
      if (token !== activeOpeningStockToken.current) return;
      setOpeningStock(emptyEndingStockByGroup());
    } finally {
      if (token === activeOpeningStockToken.current) setOpeningStockLoaded(true);
    }
  }, []);

  // Mount — load today's intake + orders.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initial = todayString();
      loadOrdersForDate(initial);
      void loadOpeningStock(initial);
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
      // Drop any pending Next Day / ending stock save so neither lands on
      // the new date.
      if (nextDaySaveTimer.current) clearTimeout(nextDaySaveTimer.current);
      if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
      setSaveState({ kind: "idle" });
      setDateState(nextDate);
      loadOrdersForDate(nextDate);
      void loadOpeningStock(nextDate);
      void loadIntakeForDate(nextDate);
    },
    [loadIntakeForDate, loadOrdersForDate, loadOpeningStock],
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

  // Clear every order for a group — zero out all SKUs across its categories.
  // Treated as a normal edit so the draft auto-persists (surviving refresh);
  // the operator can still Save to commit the cleared state.
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

  // ------------------------ Custom customers ------------------------
  // Ad-hoc customer rows appended to the reservation matrix for the selected
  // date. Identity + display name are tracked here; their per-group order
  // pieces flow through setCustomerOrder keyed by the row's id. Auto-persisted
  // on every edit, mirroring the customer matrix.
  const addCustomCustomer = useCallback(() => {
    setCustomCustomers((prev) => {
      const id = `cust-${Date.now()}-${customCustomerSeq.current++}`;
      const next: CustomCustomersForDate = [...prev, { id, name: "" }];
      saveCustomCustomersForDate(date, next);
      return next;
    });
  }, [date]);

  const renameCustomCustomer = useCallback(
    (id: string, name: string) => {
      setCustomCustomers((prev) => {
        const next = prev.map((row) =>
          row.id === id ? { ...row, name } : row,
        );
        saveCustomCustomersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  const removeCustomCustomer = useCallback(
    (id: string) => {
      setCustomCustomers((prev) => {
        const next = prev.filter((row) => row.id !== id);
        saveCustomCustomersForDate(date, next);
        return next;
      });
      // Drop the row's orders too so a removed customer stops counting.
      setCustomerOrders((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        saveCustomerOrdersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // -------------------------- Custom rows ---------------------------
  // Ad-hoc rows an operator adds by hand for the selected date. Each is
  // self-contained (its own spec + order) and auto-persisted on every edit —
  // no draft/commit split, mirroring the customer matrix above. A new row is
  // filed under the group's first category so it pools into that group.
  const addCustomRow = useCallback(
    (groupKey: PrimalGroupKey) => {
      const group = PRIMAL_GROUPS.find((g) => g.key === groupKey);
      if (!group) return;
      setCustomRows((prev) => {
        const id = `custom-${Date.now()}-${customRowSeq.current++}`;
        const next: CustomRowsForDate = [
          ...prev,
          {
            id,
            spec: emptyCustomSpec(group.categories[0]),
            order: emptyProductOrder(),
          },
        ];
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // Edit a custom row's spec fields (SKU / name / case pack). The single Case
  // Pack input doubles as the pieces-per-case divisor: its leading number
  // multiplies Today Cases into pieces (matching the catalog specs, where
  // "6 (20-22 KG)" carries a piecesPerCase of 6). Changing it re-derives the
  // row's pieces from its case count so the two stay consistent.
  const updateCustomRowSpec = useCallback(
    (id: string, patch: Partial<ProductSpec>) => {
      setCustomRows((prev) => {
        const next = prev.map((row) => {
          if (row.id !== id) return row;
          const spec: ProductSpec = { ...row.spec, ...patch };
          if (patch.casePack !== undefined) {
            const parsed = parseInt(patch.casePack, 10);
            spec.piecesPerCase = parsed > 0 ? parsed : 1;
          }
          const order =
            patch.casePack !== undefined
              ? { ...row.order, today_pcs: casesToPieces(spec, row.order.today_cases) }
              : row.order;
          return { ...row, spec, order };
        });
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // Edit a custom row's order field. Editing today_cases auto-derives today_pcs
  // from the row's own case pack, matching the catalog rows' behavior.
  const setCustomRowField = useCallback(
    (id: string, field: OrderField, value: number) => {
      const clamped = clampNonNegativeInt(value);
      setCustomRows((prev) => {
        const next = prev.map((row) => {
          if (row.id !== id) return row;
          const order: ProductOrder = { ...row.order, [field]: clamped };
          const pcsField = CASE_TO_PCS[field];
          if (pcsField) order[pcsField] = casesToPieces(row.spec, clamped);
          return { ...row, order };
        });
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  const removeCustomRow = useCallback(
    (id: string) => {
      setCustomRows((prev) => {
        const next = prev.filter((row) => row.id !== id);
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // Per-group calculated Ending Stock (pieces) — the Availability Chart's
  // endingStock, derived from today's orders + intake + customer orders
  // + the opening-stock carry-in. Persisted on Save so it becomes the next
  // production date's Opening Stock.
  const computeEndingStockByGroup = useCallback((): EndingStockByGroup => {
    const rows = buildAvailabilityRows(
      orders,
      intake.hog_counts,
      customerOrders,
      openingStock,
      customRows,
    );
    const out = emptyEndingStockByGroup();
    for (const row of rows) out[row.group] = row.endingStock;
    return out;
  }, [orders, intake, customerOrders, openingStock, customRows]);

  // Auto-persist the recalculated Ending Stock (debounced) so the carry-over
  // chain is always current: opening the next work date reads back exactly
  // the value shown here, with no explicit Save required. This is the fix for
  // the stale-snapshot bug — previously it only persisted on Save, so an
  // edited-but-unsaved day carried its old value forward.
  //
  // Gated on hydration + the carry-in having loaded + intake settled so it
  // never writes a value derived from a stale Opening Stock or not-yet-loaded
  // hog counts during a date change's async fetch window.
  useEffect(() => {
    if (!hasHydrated.current || !openingStockLoaded) return;
    if (intakeStatus.kind === "loading") return;
    const byGroup = computeEndingStockByGroup();
    if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
    endingStockSaveTimer.current = setTimeout(() => {
      void saveEndingStockForDate(date, byGroup).catch(() => {
        // Best-effort: a transient persist failure shouldn't block editing;
        // the next recalculation retries.
      });
    }, 600);
    return () => {
      if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
    };
  }, [date, computeEndingStockByGroup, openingStockLoaded, intakeStatus.kind]);

  // Commit a group's orders (every SKU across its categories) to the
  // persistent store, plus its calculated Ending Stock.
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
        if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
        await saveEndingStockForDate(date, {
          [groupKey]: computeEndingStockByGroup()[groupKey],
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
    [date, orders, computeEndingStockByGroup],
  );

  // Commit every group at once, plus all calculated Ending Stock. Clears the draft
  // since committed and working copy now match.
  const saveAll = useCallback(async () => {
    setSaveState({ kind: "saving", scope: "all" });
    try {
      saveOrdersForDate(date, orders);
      if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
      await saveEndingStockForDate(date, computeEndingStockByGroup());
      clearDraft(date);
      setSaveState({ kind: "saved", scope: "all", at: Date.now() });
    } catch (err) {
      setSaveState({
        kind: "error",
        scope: "all",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [date, orders, computeEndingStockByGroup]);

  return {
    date,
    intake,
    intakeStatus,
    orders,
    customerOrders,
    customCustomers,
    customRows,
    openingStock,
    saveState,
    setDate,
    setOrderField,
    setNextDayField,
    setCustomerOrder,
    addCustomCustomer,
    renameCustomCustomer,
    removeCustomCustomer,
    saveGroup,
    saveAll,
    clearGroup,
    applyImportedOrders,
    addCustomRow,
    updateCustomRowSpec,
    setCustomRowField,
    removeCustomRow,
  };
}

export type PrimalCalculationStateApi = ReturnType<
  typeof usePrimalCalculationState
>;
