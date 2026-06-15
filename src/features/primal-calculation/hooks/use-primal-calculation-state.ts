"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { todayString } from "@/lib/date";
import {
  emptyHogIntakeRecord,
  type HogIntakeRecord,
} from "@/features/hog-intake/types";
import { loadHogIntakeForDate } from "../intake-source";
import { type PrimalGroup, type PrimalGroupKey } from "../types";
import { usePrimalCustomerOrdersState } from "./use-primal-customer-orders-state";
import { usePrimalCustomGroupsState } from "./use-primal-custom-groups-state";
import { usePrimalEndingStockState } from "./use-primal-ending-stock-state";
import { usePrimalOrdersState } from "./use-primal-orders-state";

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

// Public orchestrator for the Primal Calculation screen.
//
// Composes four focused hooks — orders (draft/committed), customer orders,
// custom groups/rows/customers, and the ending-stock carry-over — and owns the
// cross-cutting concerns that span them: the selected date, the read-only Hog
// Intake record (Next Day Projection is displayed here but edited on Hog
// Intake), the shared hydration gate, the compound Save / Save All (orders +
// ending stock), and the cross-store cleanup when a custom customer or group is
// removed.
//
// The public API is unchanged from before the split.
export function usePrimalCalculationState() {
  const [date, setDateState] = useState<string>(todayString);
  const [intake, setIntake] = useState<HogIntakeRecord>(() =>
    emptyHogIntakeRecord(todayString()),
  );
  const [intakeStatus, setIntakeStatus] = useState<IntakeStatus>({
    kind: "loading",
  });
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  // Gate draft / auto-persist writes until after the initial mount load. Shared
  // with the orders + ending-stock hooks, which read it in their write effects.
  const hasHydrated = useRef(false);
  const activeIntakeToken = useRef(0);

  // -------------------------- Focused hooks --------------------------
  const {
    orders,
    loadForDate: loadOrders,
    setOrderField,
    clearGroup,
    applyImportedOrders,
    persistGroupOrders,
    persistAllOrders,
    clearDraftForDate,
  } = usePrimalOrdersState({ date, hasHydrated });

  const {
    customerOrders,
    loadForDate: loadCustomerOrders,
    setCustomerOrder,
    dropCustomer,
    dropGroupColumn,
  } = usePrimalCustomerOrdersState({ date });

  const {
    customCustomers,
    customGroups,
    customRows,
    loadForDate: loadCustomEntities,
    addCustomCustomer,
    renameCustomCustomer,
    removeCustomCustomer: removeCustomCustomerEntity,
    addCustomGroup,
    renameCustomGroup,
    removeCustomGroup: removeCustomGroupEntity,
    addCustomRow,
    updateCustomRowSpec,
    setCustomRowField,
    removeCustomRow,
  } = usePrimalCustomGroupsState({ date });

  const {
    openingStock,
    loadForDate: loadOpeningStock,
    cancelPendingSave,
    persistGroup: persistEndingStockGroup,
    persistAll: persistEndingStockAll,
  } = usePrimalEndingStockState({
    date,
    hasHydrated,
    intake,
    intakeStatusKind: intakeStatus.kind,
    orders,
    customerOrders,
    customRows,
  });

  // ----------------------------- Intake ------------------------------
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

  // Mount — load today's intake + every per-date store.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initial = todayString();
      loadOrders(initial);
      loadCustomerOrders(initial);
      loadCustomEntities(initial);
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

  const setDate = useCallback(
    (nextDate: string) => {
      if (!nextDate) return;
      // Drop any pending ending stock save so it doesn't land on the new date.
      cancelPendingSave();
      setSaveState({ kind: "idle" });
      setDateState(nextDate);
      loadOrders(nextDate);
      loadCustomerOrders(nextDate);
      loadCustomEntities(nextDate);
      void loadOpeningStock(nextDate);
      void loadIntakeForDate(nextDate);
    },
    [
      loadIntakeForDate,
      loadOrders,
      loadCustomerOrders,
      loadCustomEntities,
      loadOpeningStock,
      cancelPendingSave,
    ],
  );

  // Removing a custom customer / group also clears the customer-orders rows or
  // column it owned — the one piece of state that lives in a different hook.
  const removeCustomCustomer = useCallback(
    (id: string) => {
      removeCustomCustomerEntity(id);
      dropCustomer(id);
    },
    [removeCustomCustomerEntity, dropCustomer],
  );

  const removeCustomGroup = useCallback(
    (id: string) => {
      removeCustomGroupEntity(id);
      dropGroupColumn(id);
    },
    [removeCustomGroupEntity, dropGroupColumn],
  );

  // Commit a group's orders + its calculated Ending Stock.
  const saveGroup = useCallback(
    async (group: PrimalGroup) => {
      const groupKey = group.key as PrimalGroupKey;
      setSaveState({ kind: "saving", scope: groupKey });
      try {
        persistGroupOrders(date, group);
        await persistEndingStockGroup(date, groupKey);
        setSaveState({ kind: "saved", scope: group.key, at: Date.now() });
      } catch (err) {
        setSaveState({
          kind: "error",
          scope: group.key,
          message: err instanceof Error ? err.message : "Failed to save",
        });
      }
    },
    [date, persistGroupOrders, persistEndingStockGroup],
  );

  // Commit every group's orders + all calculated Ending Stock. Clears the draft
  // since committed and working copy now match.
  const saveAll = useCallback(async () => {
    setSaveState({ kind: "saving", scope: "all" });
    try {
      persistAllOrders(date);
      await persistEndingStockAll(date);
      clearDraftForDate(date);
      setSaveState({ kind: "saved", scope: "all", at: Date.now() });
    } catch (err) {
      setSaveState({
        kind: "error",
        scope: "all",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [date, persistAllOrders, persistEndingStockAll, clearDraftForDate]);

  return {
    date,
    intake,
    intakeStatus,
    orders,
    customerOrders,
    customCustomers,
    customGroups,
    customRows,
    openingStock,
    saveState,
    setDate,
    setOrderField,
    setCustomerOrder,
    addCustomCustomer,
    renameCustomCustomer,
    removeCustomCustomer,
    addCustomGroup,
    renameCustomGroup,
    removeCustomGroup,
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
