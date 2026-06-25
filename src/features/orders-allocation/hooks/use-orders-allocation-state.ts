"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayString } from "@/lib/date";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import { deriveInstructionsSummary } from "../calculations";
import {
  clearDraft,
  isDateCleared,
  markDateCleared,
  readDraft,
  unmarkDateCleared,
  writeDraft,
} from "../draft-storage";
import {
  defaultProductionMeta,
  emptyAllocationDraft,
  HOG_TYPES,
  isEmptyAllocationDraft,
  seededAllocationDraft,
  type AllocationDraft,
  type AllocationInstruction,
  type HogBreakCalc,
  type HogType,
  type ProductionMeta,
} from "../types";

export type SaveStatus = { kind: "idle" } | { kind: "saved"; at: number };

// Single source of truth for the Orders & Allocation screen.
//
// The draft (per-SKU production overlay + morning-brief instructions) is the
// only persisted state — written to localStorage on every edit so a day's work
// survives a refresh. The production-sheet rows and per-group ordered counts are
// DERIVED from the Primal snapshot and never stored.
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
  // A date with no saved draft opens to the standing allocation-sheet template
  // (seededAllocationDraft) rather than a blank slate — UNLESS the operator
  // explicitly cleared that date, in which case it stays blank. suppressNextWrite
  // keeps the seed from being persisted until a line is actually edited, so an
  // untouched day leaves localStorage clean and re-seeds on next open.
  const loadForDate = useCallback((nextDate: string) => {
    suppressNextWrite.current = true;
    const saved = readDraft(nextDate);
    setDraft(
      saved ??
        (isDateCleared(nextDate)
          ? emptyAllocationDraft(nextDate)
          : seededAllocationDraft(nextDate)),
    );
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

  // ------------------------- Production overlay ------------------------
  // The production-sheet rows are derived from Primal; only the operator's
  // per-SKU operational fields are stored. Upsert merges the patch onto the
  // existing meta (or a fresh default), clamping numbers and trimming text.
  const setProductionMeta = useCallback(
    (sku: string, patch: Partial<ProductionMeta>) => {
      setDraft((prev) => {
        const base = prev.production_meta[sku] ?? defaultProductionMeta();
        const next: ProductionMeta = {
          ...base,
          ...patch,
          ...(patch.secPerPc !== undefined
            ? { secPerPc: clampNonNegativeInt(patch.secPerPc) }
            : {}),
          ...(patch.cutters !== undefined
            ? { cutters: clampNonNegativeInt(patch.cutters) }
            : {}),
          ...(patch.start !== undefined ? { start: patch.start.trim() } : {}),
          ...(patch.routes !== undefined
            ? {
                routes: patch.routes.map((r) => ({
                  route: r.route.trim(),
                  qty: clampNonNegativeInt(r.qty),
                })),
              }
            : {}),
        };
        return {
          ...prev,
          production_meta: { ...prev.production_meta, [sku]: next },
        };
      });
      setStatus({ kind: "idle" });
    },
    [],
  );

  // ---------------------------- Hog break -----------------------------
  // Merge a patch onto the morning hog-break calc inputs, clamping the per-type
  // count / rate records and the main-room buffer to non-negative ints. The
  // derived timing (total minutes, break end, main-room start) is computed in
  // the view via deriveHogBreak — never stored.
  const setHogBreakCalc = useCallback((patch: Partial<HogBreakCalc>) => {
    setDraft((prev) => {
      const next: HogBreakCalc = { ...prev.hog_break, ...patch };
      const counts = {} as Record<HogType, number>;
      const secPerHead = {} as Record<HogType, number>;
      for (const t of HOG_TYPES) {
        counts[t.value] = clampNonNegativeInt(next.counts[t.value]);
        secPerHead[t.value] = clampNonNegativeInt(next.secPerHead[t.value]);
      }
      return {
        ...prev,
        hog_break: {
          counts,
          secPerHead,
          start: next.start,
          mainRoomBufferMin: clampNonNegativeInt(next.mainRoomBufferMin),
        },
      };
    });
    setStatus({ kind: "idle" });
  }, []);

  // ---------------------------- Instructions ---------------------------
  const addInstruction = useCallback(
    (instruction: Omit<AllocationInstruction, "id">) => {
      setDraft((prev) => {
        // Re-adding content lifts an explicit "cleared" mark so the date is
        // driven by its saved draft again (not the blank-on-purpose path).
        unmarkDateCleared(prev.date);
        return {
          ...prev,
          instructions: [
            ...prev.instructions,
            {
              ...instruction,
              id: crypto.randomUUID(),
              qty: clampNonNegativeInt(instruction.qty),
            },
          ],
        };
      });
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
    setDraft((prev) => {
      // Mark the date cleared so the standing template doesn't re-seed on the
      // next open — the operator wanted this day blank, and that must persist.
      markDateCleared(prev.date);
      return { ...prev, instructions: [] };
    });
  }, []);

  // ------------------------------- Clear / Save ------------------------
  const clearAll = useCallback(() => {
    markDateCleared(date);
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
    instructionsSummary,
    setDate,
    setProductionMeta,
    setHogBreakCalc,
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
