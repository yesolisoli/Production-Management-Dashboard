"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayString } from "@/lib/date";
import { getCurrentUserId } from "@/lib/supabase/current-user";
import {
  clampNonNegativeInt,
  derivedCountsFromFarmRecords,
  farmRecordCountForType,
} from "../calculations";
import { clearDraft, readDraft, writeDraft } from "../draft-storage";
import {
  fetchHogIntakeByDate,
  fetchPreviousHeldOver,
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
// Drafts are written on every edit (the instant safety net) and auto-committed
// to the DB ~1s after the last edit (debounced); a successful commit clears the
// draft. No manual save — downstream screens (Primal Calc) read DB-only, so the
// commit must happen on its own.
type UseHogIntakeStateArgs = {
  // Weekly planned-sow total (JP + ADACA + Custom Sows, Mon–Fri) from the
  // Weekly Hog Plan. Combined with farm-delivered sows to derive Sow
  // "Available This Week".
  sowPlanTotal: number;
};

export function useHogIntakeState({ sowPlanTotal }: UseHogIntakeStateArgs) {
  const [date, setDateState] = useState<string>(todayString);
  const [record, setRecord] = useState<HogIntakeRecord>(() =>
    emptyHogIntakeRecord(todayString()),
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  // Held-over hogs carried in from the previous production day — cut today, so
  // added into the Primal Total. Fetched on every date load, independent of the
  // current record's source (draft or DB).
  const [prevHeldOver, setPrevHeldOver] = useState(0);
  // True when an unsaved local draft exists for the current date — i.e. the
  // on-screen record differs from what's committed to the DB. Drives the
  // debounced auto-commit below (and the "Saving…/Up to date" indicator).
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

  // Latest values mirrored into refs so the debounced DB auto-save and the
  // flush-on-leave handlers read current data without having to re-subscribe.
  const recordRef = useRef(record);
  const hogCountsRef = useRef<HogCounts>(record.hog_counts);
  const dateRef = useRef(date);
  const dirtyRef = useRef(dirty);
  // Supersedes a slow in-flight DB commit when a newer one starts.
  const saveToken = useRef(0);
  // The in-flight commit promise, so flush() can await an existing save instead
  // of stacking a duplicate one on top of it.
  const inFlightRef = useRef<Promise<void> | null>(null);

  const loadForDate = useCallback(async (nextDate: string) => {
    const token = ++activeFetchToken.current;

    // Carry the previous production day's held-over hogs in, independent of how
    // today's record resolves (draft or DB). Fired in parallel; failures fall
    // back to 0 without blocking the record load.
    void (async () => {
      try {
        const prev = await fetchPreviousHeldOver(nextDate);
        if (token === activeFetchToken.current) setPrevHeldOver(prev);
      } catch {
        if (token === activeFetchToken.current) setPrevHeldOver(0);
      }
    })();

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
      // No record yet for this date: start from an empty record. Sow
      // "Available This Week" is no longer carried forward day-to-day — it is
      // derived from the Weekly Hog Plan's sow rows plus farm-delivered sows
      // (see hogCounts below), so there is nothing to seed here.
      suppressNextWrite.current = true;
      setRecord(emptyHogIntakeRecord(nextDate));
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

  // Persist drafts keyed by the RECORD's own date, never the `date` state,
  // and depend only on `record`. During a date switch the `date` state
  // updates immediately but `record` still holds the previous day's data
  // until the async load replaces it. Keying off `date` here would copy that
  // stale record into the NEW date's draft — duplicating whole records across
  // days and shadowing the DB. `record.date` always matches the data, so the
  // transient window writes nothing it shouldn't.
  useEffect(() => {
    if (!hasHydrated.current) return;
    if (suppressNextWrite.current) {
      suppressNextWrite.current = false;
      return;
    }
    // Never persist an empty draft — it would shadow the DB record on the
    // next load. Clear any leftover instead.
    if (isEmptyHogIntakeRecord(record)) {
      clearDraft(record.date);
      // Mirrors the just-cleared draft state (no unsaved draft → not dirty).
      // This effect is the draft-persistence side-effect itself, not a
      // render-sync, so keep the synchronous flag update as-is.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirty(false);
      return;
    }
    writeDraft(record.date, record);
    setDirty(true);
  }, [record]);

  // Derived counts override the record's stored (input-only) values:
  //   • JP / RWA / BK roll up from Farm Delivery Records — deliveries are their
  //     single entry point.
  //   • Sow "Available This Week" = the Weekly Hog Plan's sow rows (JP / ADACA /
  //     Custom Sows, summed Mon–Fri) plus any farm deliveries typed "Sow".
  // Round / Suckling / Customer stay manual, passing through from hog_counts.
  const hogCounts = useMemo<HogCounts>(
    () => ({
      ...record.hog_counts,
      ...derivedCountsFromFarmRecords(record.farm_records),
      Sow: sowPlanTotal + farmRecordCountForType(record.farm_records, "Sow"),
    }),
    [record.hog_counts, record.farm_records, sowPlanTotal],
  );

  // Keep the refs pointed at the latest render values for the auto-save below
  // (read only inside async callbacks / effects, never during render).
  useEffect(() => {
    recordRef.current = record;
    hogCountsRef.current = hogCounts;
    dateRef.current = date;
    dirtyRef.current = dirty;
  });

  // Commit the current record to the DB. Drafts (localStorage) are the instant
  // safety net; the DB is what downstream screens read (Primal Calc is
  // DB-only), so this must run automatically — see the debounced effect below.
  // The derived counts are persisted so the DB matches what's on screen.
  // Tokened + date-guarded so a newer commit or a date switch supersedes a slow
  // in-flight save instead of clobbering the current view.
  const commitToDb = useCallback((): Promise<void> => {
    const run = async () => {
      const snapshot: HogIntakeRecord = {
        ...recordRef.current,
        hog_counts: hogCountsRef.current,
      };
      if (isEmptyHogIntakeRecord(snapshot)) return;
      const token = ++saveToken.current;
      setStatus({ kind: "saving" });
      try {
        const userId = await getCurrentUserId();
        const saved = await upsertHogIntakeRecord(snapshot, userId);
        clearDraft(saved.date);
        if (token !== saveToken.current) return; // a newer commit started
        if (dateRef.current !== saved.date) return; // operator left this date
        suppressNextWrite.current = true;
        setRecord(saved);
        setDirty(false);
        setStatus({ kind: "saved", at: Date.now() });
      } catch (err) {
        if (token !== saveToken.current || dateRef.current !== snapshot.date) {
          return;
        }
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to save",
        });
      }
    };
    const promise = run().finally(() => {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    });
    inFlightRef.current = promise;
    return promise;
  }, []);

  // Awaitable commit used by leave paths (date switch, navigation guard). Waits
  // out any in-flight save first, then commits once more if edits remain, so the
  // DB always holds the latest before the caller proceeds.
  const flush = useCallback(async () => {
    if (inFlightRef.current) await inFlightRef.current;
    if (dirtyRef.current) await commitToDb();
  }, [commitToDb]);

  // Auto-commit to the DB ~1s after the last edit (debounced). `dirty` flips
  // true only on a real edit or a restored unsaved draft, so an untouched or
  // freshly DB-loaded record never triggers a write. Each edit reschedules the
  // timer, and a restored draft auto-commits — recovering data that was stuck
  // in localStorage but never reached the DB.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      void commitToDb();
    }, 1000);
    return () => clearTimeout(timer);
  }, [dirty, record, commitToDb]);

  // Flush a pending debounced save when the screen unmounts (backstop for any
  // unmount path not already routed through the navigation guard).
  useEffect(() => {
    return () => {
      if (dirtyRef.current) void flush();
    };
  }, [flush]);

  const setDate = useCallback(
    (nextDate: string) => {
      if (!nextDate) return;
      // Flush pending edits for the current date before leaving it, so a quick
      // hop to another date (or Primal) doesn't lose the last keystrokes.
      if (dirtyRef.current) void flush();
      setDateState(nextDate);
      void loadForDate(nextDate);
    },
    [loadForDate, flush],
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

  const setTodaysCutting = useCallback((value: number) => {
    setRecord((prev) => ({
      ...prev,
      todays_cutting: clampNonNegativeInt(value),
    }));
  }, []);

  const setIncludeBkInYield = useCallback((value: boolean) => {
    setRecord((prev) => ({ ...prev, include_bk_in_yield: value }));
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
          delivery_time: "",
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

  return {
    date,
    record,
    hogCounts,
    prevHeldOver,
    status,
    dirty,
    setDate,
    setHogCount,
    clearAllHogCounts,
    setProcessField,
    setTodaysCutting,
    setIncludeBkInYield,
    setNotes,
    setNextDayField,
    addFarmRecord,
    updateFarmRecord,
    removeFarmRecord,
    reset,
    flush,
  };
}

export type HogIntakeStateApi = ReturnType<typeof useHogIntakeState>;
