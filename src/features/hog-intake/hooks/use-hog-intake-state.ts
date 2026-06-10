"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentUserId } from "@/lib/supabase/current-user";
import {
  clampNonNegativeInt,
  derivedCountsFromFarmRecords,
} from "../calculations";
import { clearDraft, readDraft, writeDraft } from "../draft-storage";
import {
  fetchHogIntakeByDate,
  fetchPreviousSowRemaining,
  upsertHogIntakeRecord,
} from "../supabase";
import {
  emptyHogCounts,
  emptyHogIntakeRecord,
  isEmptyHogIntakeRecord,
  type FarmRecord,
  type HogCounts,
  type HogIntakeRecord,
  type HogType,
} from "../types";

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

// Single source of truth for the Hog Intake screen.
//
// Resolution order when arriving at a date:
//   1. Local draft (unsaved user input — wins because it's newer than DB)
//   2. DB record for that date
//   3. Empty record
//
// Drafts are written on every edit and cleared only after a successful
// DB save.
export function useHogIntakeState() {
  const [date, setDateState] = useState<string>(todayString);
  const [record, setRecord] = useState<HogIntakeRecord>(() =>
    emptyHogIntakeRecord(todayString()),
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  // True when an unsaved local draft exists for the current date — i.e. the
  // on-screen record differs from what's committed to the DB. Downstream
  // screens (Primal Calc) read DB-only, so this flags a divergence the
  // operator must resolve by saving.
  const [dirty, setDirty] = useState(false);

  // Gate draft writes until after we've attempted to hydrate — otherwise
  // the empty initial state would overwrite a saved draft on first render.
  const hasHydrated = useRef(false);

  // Used to ignore stale fetch responses if the user changes date again
  // before the previous fetch resolves.
  const activeFetchToken = useRef(0);

  // Set before any non-user-driven setRecord (DB load, draft restore,
  // post-save replace) so the write effect doesn't immediately persist
  // the loaded value back as a fresh draft. Cleared inside the effect.
  const suppressNextWrite = useRef(false);

  const loadForDate = useCallback(async (nextDate: string) => {
    const token = ++activeFetchToken.current;

    const draft = readDraft(nextDate);
    if (draft && !isEmptyHogIntakeRecord(draft)) {
      // A non-empty draft represents unsaved input — it always wins.
      suppressNextWrite.current = true;
      setRecord(draft);
      setDirty(true);
      setStatus({ kind: "idle" });
      return;
    }
    // An empty draft (e.g. a date opened before data existed) must not
    // shadow the DB — drop it and load from the server instead.
    if (draft) clearDraft(nextDate);

    setStatus({ kind: "loading" });
    try {
      const remote = await fetchHogIntakeByDate(nextDate);
      if (token !== activeFetchToken.current) return; // stale
      if (remote) {
        suppressNextWrite.current = true;
        setRecord(remote);
        setDirty(false);
        setStatus({ kind: "idle" });
        return;
      }
      // No record yet for this date: seed a fresh record whose Sow "Available
      // This Week" carries over from the most recent prior day's "Remaining
      // After Schedule". Everything else starts empty. The seed is suppressed
      // from the draft writer, so merely opening the day doesn't dirty it —
      // only a real edit persists (and locks in) the carried-over value.
      const seededSow = await fetchPreviousSowRemaining(nextDate);
      if (token !== activeFetchToken.current) return; // stale
      const fresh = emptyHogIntakeRecord(nextDate);
      fresh.hog_counts.Sow = seededSow;
      suppressNextWrite.current = true;
      setRecord(fresh);
      setDirty(false);
      setStatus({ kind: "idle" });
    } catch (err) {
      if (token !== activeFetchToken.current) return;
      suppressNextWrite.current = true;
      setRecord(emptyHogIntakeRecord(nextDate));
      setDirty(false);
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadForDate(todayString());
      if (!cancelled) hasHydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only — subsequent date changes go through setDate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;
    if (suppressNextWrite.current) {
      suppressNextWrite.current = false;
      return;
    }
    // Never persist an empty draft — it would shadow the DB record on the
    // next load. Clear any leftover instead.
    if (isEmptyHogIntakeRecord(record)) {
      clearDraft(date);
      setDirty(false);
      return;
    }
    writeDraft(date, record);
    setDirty(true);
  }, [date, record]);

  // Primal hogs (JP / RWA) are derived from Farm Delivery Records — deliveries
  // are their single entry point — and override the stored values. Every other
  // type (BK / Sow / Round / Suckling / Customer) stays manual, passing through
  // from the record's own hog_counts.
  const hogCounts = useMemo<HogCounts>(
    () => ({
      ...record.hog_counts,
      ...derivedCountsFromFarmRecords(record.farm_records),
    }),
    [record.hog_counts, record.farm_records],
  );

  const setDate = useCallback(
    (nextDate: string) => {
      if (!nextDate) return;
      setDateState(nextDate);
      void loadForDate(nextDate);
    },
    [loadForDate],
  );

  const setHogCount = useCallback((type: HogType, value: number) => {
    setRecord((prev) => ({
      ...prev,
      hog_counts: {
        ...prev.hog_counts,
        [type]: clampNonNegativeInt(value),
      },
    }));
  }, []);

  const clearAllHogCounts = useCallback(() => {
    setRecord((prev) => ({ ...prev, hog_counts: emptyHogCounts() }));
  }, []);

  const setProcessField = useCallback(
    (
      field: "side_orders" | "held_over" | "deaths_on_arrival" | "boars_count",
      value: number,
    ) => {
      setRecord((prev) => ({
        ...prev,
        [field]: clampNonNegativeInt(value),
      }));
    },
    [],
  );

  const setSowScheduled = useCallback((value: number) => {
    setRecord((prev) => ({
      ...prev,
      sow_scheduled: clampNonNegativeInt(value),
    }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setRecord((prev) => ({ ...prev, notes }));
  }, []);

  const setNextDayField = useCallback(
    (field: "hog_count" | "side_orders" | "cooler_overstock", value: number) => {
      setRecord((prev) => ({
        ...prev,
        next_day: { ...prev.next_day, [field]: clampNonNegativeInt(value) },
      }));
    },
    [],
  );

  const addFarmRecord = useCallback(() => {
    setRecord((prev) => ({
      ...prev,
      farm_records: [
        ...prev.farm_records,
        {
          id: crypto.randomUUID(),
          farm: "",
          type: "",
          tattoo: "",
          count: 0,
        },
      ],
    }));
  }, []);

  const updateFarmRecord = useCallback(
    (id: string, patch: Partial<Omit<FarmRecord, "id">>) => {
      setRecord((prev) => ({
        ...prev,
        farm_records: prev.farm_records.map((row) =>
          row.id === id
            ? {
                ...row,
                ...patch,
                ...(patch.count !== undefined
                  ? { count: clampNonNegativeInt(patch.count) }
                  : {}),
              }
            : row,
        ),
      }));
    },
    [],
  );

  const removeFarmRecord = useCallback((id: string) => {
    setRecord((prev) => ({
      ...prev,
      farm_records: prev.farm_records.filter((row) => row.id !== id),
    }));
  }, []);

  const reset = useCallback(() => {
    suppressNextWrite.current = true;
    setRecord(emptyHogIntakeRecord(date));
    clearDraft(date);
    setDirty(false);
    setStatus({ kind: "idle" });
  }, [date]);

  const save = useCallback(async () => {
    setStatus({ kind: "saving" });
    try {
      const userId = await getCurrentUserId();
      // Persist the derived counts so downstream readers (Primal Calc reads
      // hog_counts from the DB) see the same totals shown on screen.
      const saved = await upsertHogIntakeRecord(
        { ...record, hog_counts: hogCounts },
        userId,
      );
      clearDraft(saved.date);
      // The post-save setRecord must not re-create a draft for the row
      // we just cleared.
      suppressNextWrite.current = true;
      setRecord(saved);
      setDirty(false);
      setStatus({ kind: "saved", at: Date.now() });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [record, hogCounts]);

  return {
    date,
    record,
    hogCounts,
    status,
    dirty,
    setDate,
    setHogCount,
    clearAllHogCounts,
    setProcessField,
    setSowScheduled,
    setNotes,
    setNextDayField,
    addFarmRecord,
    updateFarmRecord,
    removeFarmRecord,
    reset,
    save,
  };
}

export type HogIntakeStateApi = ReturnType<typeof useHogIntakeState>;
