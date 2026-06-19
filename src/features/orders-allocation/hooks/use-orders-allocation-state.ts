"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayString } from "@/lib/date";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import {
  deriveCutOrdersTotals,
  deriveInstructionsSummary,
} from "../calculations";
import { clearDraft, readDraft, writeDraft } from "../draft-storage";
import {
  emptyAllocationDraft,
  isEmptyAllocationDraft,
  type AllocationDraft,
  type AllocationInstruction,
  type CutOrder,
} from "../types";

export type SaveStatus = { kind: "idle" } | { kind: "saved"; at: number };

// Single source of truth for the Orders & Allocation screen.
//
// The draft (cut orders + morning-brief instructions) is the only persisted
// state — written to localStorage on every edit so a day's work survives a
// refresh. Totals, estimated times and the per-group ordered counts are DERIVED
// here with useMemo and never stored.
export function useOrdersAllocationState() {
  const [date, setDateState] = useState<string>(todayString);
  const [draft, setDraft] = useState<AllocationDraft>(() =>
    emptyAllocationDraft(todayString()),
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  // Gate persistence until after the first localStorage load so the empty
  // initial state can't overwrite a saved draft on first render (also avoids a
  // hydration mismatch — the load runs in an effect, client-side only).
  const hasHydrated = useRef(false);
  // Set before any non-user-driven setDraft so the auto-persist effect doesn't
  // write the freshly loaded value straight back (and, when that value is the
  // empty initial draft, clearDraft the saved key). Mirrors usePrimalOrdersState.
  const suppressNextWrite = useRef(false);

  // Load the draft for a date from localStorage. Extracted from the effect so
  // the setState happens in a callback (mirrors the Primal hooks' loadForDate)
  // rather than synchronously in the effect body.
  const loadForDate = useCallback((nextDate: string) => {
    suppressNextWrite.current = true;
    setDraft(readDraft(nextDate) ?? emptyAllocationDraft(nextDate));
    hasHydrated.current = true;
    setStatus({ kind: "idle" });
  }, []);

  // Load on mount and whenever the date changes. The setState here is the
  // intended date→draft sync (reading the external localStorage store), not an
  // avoidable render cascade.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadForDate(date);
  }, [date, loadForDate]);

  // Persist on every change, keyed by the DRAFT's own date so a date switch
  // can't copy one day's rows into another date's key.
  useEffect(() => {
    if (!hasHydrated.current) return;
    if (suppressNextWrite.current) {
      suppressNextWrite.current = false;
      return;
    }
    if (isEmptyAllocationDraft(draft)) clearDraft(draft.date);
    else writeDraft(draft.date, draft);
  }, [draft]);

  const setDate = useCallback((nextDate: string) => {
    if (nextDate) setDateState(nextDate);
  }, []);

  // ----------------------------- Cut orders ----------------------------
  const addCutOrder = useCallback((order: Omit<CutOrder, "id">) => {
    setDraft((prev) => ({
      ...prev,
      cut_orders: [
        ...prev.cut_orders,
        { ...order, id: crypto.randomUUID(), pieces: clampNonNegativeInt(order.pieces) },
      ],
    }));
    setStatus({ kind: "idle" });
  }, []);

  const updateCutOrder = useCallback(
    (id: string, patch: Partial<Omit<CutOrder, "id">>) => {
      setDraft((prev) => ({
        ...prev,
        cut_orders: prev.cut_orders.map((row) =>
          row.id === id
            ? {
                ...row,
                ...patch,
                ...(patch.pieces !== undefined
                  ? { pieces: clampNonNegativeInt(patch.pieces) }
                  : {}),
              }
            : row,
        ),
      }));
      setStatus({ kind: "idle" });
    },
    [],
  );

  const removeCutOrder = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      cut_orders: prev.cut_orders.filter((row) => row.id !== id),
    }));
  }, []);

  const clearCutOrders = useCallback(() => {
    setDraft((prev) => ({ ...prev, cut_orders: [] }));
  }, []);

  // Replace all cut-order rows in one shot — used to seed (or regenerate) the
  // day's cut orders from Primal demand. Each row gets a fresh stable id; the
  // planner then adjusts pieces / location / note as usual.
  const replaceCutOrders = useCallback(
    (orders: Omit<CutOrder, "id">[]) => {
      setDraft((prev) => ({
        ...prev,
        cut_orders: orders.map((o) => ({
          ...o,
          id: crypto.randomUUID(),
          pieces: clampNonNegativeInt(o.pieces),
        })),
      }));
      setStatus({ kind: "idle" });
    },
    [],
  );

  // ---------------------------- Instructions ---------------------------
  const addInstruction = useCallback(
    (instruction: Omit<AllocationInstruction, "id">) => {
      setDraft((prev) => ({
        ...prev,
        instructions: [
          ...prev.instructions,
          {
            ...instruction,
            id: crypto.randomUUID(),
            qty: clampNonNegativeInt(instruction.qty),
          },
        ],
      }));
      setStatus({ kind: "idle" });
    },
    [],
  );

  const updateInstruction = useCallback(
    (id: string, patch: Partial<Omit<AllocationInstruction, "id">>) => {
      setDraft((prev) => ({
        ...prev,
        instructions: prev.instructions.map((row) =>
          row.id === id
            ? {
                ...row,
                ...patch,
                ...(patch.qty !== undefined
                  ? { qty: clampNonNegativeInt(patch.qty) }
                  : {}),
              }
            : row,
        ),
      }));
      setStatus({ kind: "idle" });
    },
    [],
  );

  const removeInstruction = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((row) => row.id !== id),
    }));
  }, []);

  const clearInstructions = useCallback(() => {
    setDraft((prev) => ({ ...prev, instructions: [] }));
  }, []);

  // ------------------------------- Clear / Save ------------------------
  const clearAll = useCallback(() => {
    setDraft(emptyAllocationDraft(date));
    clearDraft(date);
    setStatus({ kind: "idle" });
  }, [date]);

  // Persistence already happens on every edit; Save is an explicit commit that
  // flushes the current draft and flashes a confirmation.
  const save = useCallback(() => {
    if (isEmptyAllocationDraft(draft)) clearDraft(draft.date);
    else writeDraft(draft.date, draft);
    setStatus({ kind: "saved", at: Date.now() });
  }, [draft]);

  const cutOrdersTotals = useMemo(
    () => deriveCutOrdersTotals(draft.cut_orders),
    [draft.cut_orders],
  );
  const instructionsSummary = useMemo(
    () => deriveInstructionsSummary(draft.instructions),
    [draft.instructions],
  );
  const isEmpty = isEmptyAllocationDraft(draft);

  return {
    date,
    draft,
    status,
    isEmpty,
    cutOrdersTotals,
    instructionsSummary,
    setDate,
    addCutOrder,
    updateCutOrder,
    removeCutOrder,
    clearCutOrders,
    replaceCutOrders,
    addInstruction,
    updateInstruction,
    removeInstruction,
    clearInstructions,
    clearAll,
    save,
  };
}

export type OrdersAllocationStateApi = ReturnType<
  typeof useOrdersAllocationState
>;
