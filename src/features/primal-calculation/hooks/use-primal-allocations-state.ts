"use client";

import { useCallback, useRef, useState } from "react";
import { clampNonNegativeInt } from "../calculations";
import {
  deleteAllocation,
  fetchAllocationsForDate,
  fetchAllocationsForTargetDate,
  saveAllocation,
} from "../allocations-source";
import { SAVE_DEBOUNCE_MS } from "../constants";
import {
  PRIMAL_GROUPS,
  type AllocationsForDate,
  type PrimalAllocation,
  type PrimalGroupKey,
} from "../types";

// Per-date stock allocations for the Availability Chart. Each allocation
// reserves a group's stock (pieces) for a target date; the sum per group is
// subtracted from that group's Available Stock in the view model.
//
// Persisted to Supabase (primal_allocations) one row per allocation. Edits are
// debounced per row so typing a quantity doesn't write on every keystroke;
// add / remove persist immediately since they change which rows exist.
export function usePrimalAllocationsState({ date }: { date: string }) {
  // Allocations entered ON the viewed date — the editable rows, deducted from it.
  const [allocations, setAllocations] = useState<AllocationsForDate>([]);
  // Allocations TARGETING the viewed date — read-only incoming reservations that
  // surface as "Remaining Products" and add to this date's Available Stock.
  const [incomingAllocations, setIncomingAllocations] =
    useState<AllocationsForDate>([]);

  // Token so a slow load for a previous date can't overwrite a newer one.
  const activeLoadToken = useRef(0);
  // Per-allocation debounce timers for the edit upsert.
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const loadForDate = useCallback(async (nextDate: string) => {
    const token = ++activeLoadToken.current;
    try {
      const [entered, incoming] = await Promise.all([
        fetchAllocationsForDate(nextDate),
        fetchAllocationsForTargetDate(nextDate),
      ]);
      if (token !== activeLoadToken.current) return; // stale
      setAllocations(entered);
      setIncomingAllocations(incoming);
    } catch {
      if (token !== activeLoadToken.current) return;
      setAllocations([]);
      setIncomingAllocations([]);
    }
  }, []);

  // Debounced persist of one allocation's current values.
  const scheduleSave = useCallback(
    (allocation: PrimalAllocation) => {
      const timers = saveTimers.current;
      const existing = timers.get(allocation.id);
      if (existing) clearTimeout(existing);
      timers.set(
        allocation.id,
        setTimeout(() => {
          timers.delete(allocation.id);
          void saveAllocation(date, allocation).catch(() => {
            // Best-effort: a transient failure is retried on the next edit.
          });
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [date],
  );

  // Add a blank allocation for the first group, targeting the current date.
  const addAllocation = useCallback(() => {
    const allocation: PrimalAllocation = {
      id: crypto.randomUUID(),
      group: PRIMAL_GROUPS[0].key as PrimalGroupKey,
      qtyPcs: 0,
      targetDate: date,
      label: "",
    };
    setAllocations((prev) => [...prev, allocation]);
    // Persist immediately so the new row exists even if never edited.
    void saveAllocation(date, allocation).catch(() => {});
  }, [date]);

  const updateAllocation = useCallback(
    (id: string, patch: Partial<Omit<PrimalAllocation, "id">>) => {
      setAllocations((prev) => {
        let updated: PrimalAllocation | null = null;
        const next = prev.map((a) => {
          if (a.id !== id) return a;
          updated = {
            ...a,
            ...patch,
            ...(patch.qtyPcs !== undefined
              ? { qtyPcs: clampNonNegativeInt(patch.qtyPcs) }
              : null),
          };
          return updated;
        });
        if (updated) scheduleSave(updated);
        return next;
      });
    },
    [scheduleSave],
  );

  const removeAllocation = useCallback((id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      saveTimers.current.delete(id);
    }
    setAllocations((prev) => prev.filter((a) => a.id !== id));
    void deleteAllocation(id).catch(() => {});
  }, []);

  return {
    allocations,
    incomingAllocations,
    loadForDate,
    addAllocation,
    updateAllocation,
    removeAllocation,
  };
}
