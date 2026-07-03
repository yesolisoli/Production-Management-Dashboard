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
  type ProductionRoom,
} from "../types";

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
    hasHydrated.current = true;  }, []);

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
          ...(patch.bufferSec !== undefined
            ? { bufferSec: clampNonNegativeInt(patch.bufferSec) }
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
          // Carry Forward override: null clears it back to the auto (deadline-
          // derived) split; a number is the supervisor's manual carry count.
          ...(patch.carryForwardPcs !== undefined
            ? {
                carryForwardPcs:
                  patch.carryForwardPcs === null
                    ? null
                    : clampNonNegativeInt(patch.carryForwardPcs),
              }
            : {}),
        };
        return {
          ...prev,
          production_meta: { ...prev.production_meta, [sku]: next },
        };
      });    },
    [],
  );

  // The operator's manual row ordering. The sheet computes the full next SKU
  // sequence (from the derived rows) and hands it back here to persist; the rows
  // themselves stay derived from Primal. Stored as-is — orderProductionRows
  // ignores any SKUs that no longer resolve to a row.
  const setProductionOrder = useCallback((order: string[]) => {
    setDraft((prev) => ({ ...prev, production_order: order }));
  }, []);

  // Per-room "cut until" deadline (available-time window end). Stored as raw time
  // text keyed by room; a blank value drops the room's deadline (no check). The
  // exceeds flag and Carry Forward split derive from it in deriveProductionSchedule.
  const setRoomDeadline = useCallback(
    (room: ProductionRoom, time: string) => {
      setDraft((prev) => {
        const next = { ...prev.room_deadlines };
        if (time.trim()) next[room] = time.trim();
        else delete next[room];
        return { ...prev, room_deadlines: next };
      });
    },
    [],
  );

  // ------------------------- Route printing ---------------------------
  // Operator-entered printed time per route (Route Printing Schedule). Stored as
  // raw text keyed by route number so the deadline/difference/status can derive
  // from it; a blank value drops the route back to "Not Printed".
  const setRoutePrint = useCallback((route: string, time: string) => {
    setDraft((prev) => {
      const next = { ...prev.route_prints };
      if (time.trim()) next[route] = time;
      else delete next[route];
      return { ...prev, route_prints: next };
    });  }, []);

  // Operator-entered free-text note per route (Route Printing Schedule). Stored
  // keyed by route number; a blank value drops the route's note. Mirrors
  // setRoutePrint — independent of the printed time.
  const setRouteNote = useCallback((route: string, note: string) => {
    setDraft((prev) => {
      const next = { ...prev.route_notes };
      if (note.trim()) next[route] = note;
      else delete next[route];
      return { ...prev, route_notes: next };
    });  }, []);

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
          bufferMin: clampNonNegativeInt(next.bufferMin),
          mainRoomBufferMin: clampNonNegativeInt(next.mainRoomBufferMin),
          secondlineOffsetMin: clampNonNegativeInt(next.secondlineOffsetMin),
        },
      };
    });  }, []);

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
      });    },
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
      }));    },
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
    clearDraft(date);  }, [date]);

  const instructionsSummary = useMemo(
    () => deriveInstructionsSummary(draft.instructions),
    [draft.instructions],
  );
  const isEmpty = isEmptyAllocationDraft(draft);

  return {
    date,
    draft,
    isEmpty,
    instructionsSummary,
    setDate,
    setProductionMeta,
    setProductionOrder,
    setRoomDeadline,
    setRoutePrint,
    setRouteNote,
    setHogBreakCalc,
    addInstruction,
    updateInstruction,
    removeInstruction,
    clearInstructions,
    clearAll,
  };
}

export type OrdersAllocationStateApi = ReturnType<
  typeof useOrdersAllocationState
>;
