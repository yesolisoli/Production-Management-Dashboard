"use client";

import { useEffect, useRef, useState } from "react";
import { SUPABASE_ENABLED } from "@/lib/config";
import { previousDateString } from "@/lib/date";
import { loadAssignmentBoardSnapshotsForDates } from "@/features/assignment-board/supabase";
import {
  computeAllStats,
  computeSummary,
} from "@/features/daily-lineup/utils/compute-stats";
import { fetchAllocationsForTargetDate } from "@/features/primal-calculation/allocations-source";
import { fetchRecentSavedEndingStockThrough } from "@/features/primal-calculation/ending-stock-source";
import type { EndingStockByGroup } from "@/features/primal-calculation/types";
import {
  COMPARISON_ROWS,
  historicalPrimalPercent,
  type ComparisonRow,
  type ComparisonStaffing,
} from "../daily-comparison";
import type {
  OverviewStatus,
  StaffingOverview,
} from "./use-operations-overview";
import type { RecentActivityDay } from "./use-recent-hog-activity";

// One extra ending-stock date beyond the table rows, so every row's
// carry-over predecessor is inside the fetched window (or provably absent).
const ENDING_STOCK_DATE_LIMIT = COMPARISON_ROWS + 2;

export type DailyComparisonOverview = {
  status: OverviewStatus;
  // Newest first — the most recent recorded intake days up to the selected
  // date. A day the plant didn't record simply isn't a row.
  rows: ComparisonRow[];
};

// Rows for the Daily Comparison table. Intake/cutting figures come from the
// already-loaded recent history (no new intake fetch); per-date staffing is
// rebuilt from stored board snapshots exactly as the overview does for the
// selected date; per-date primal usage reuses the Primal Usage derivation
// over the saved ending-stock history. Snapshot and primal lookups are
// best-effort: a failure or gap leaves that cell null ("—"), never zero.
export function useDailyComparison(
  date: string,
  history: RecentActivityDay[],
  historyStatus: OverviewStatus,
  staffing: StaffingOverview,
) {
  const [overview, setOverview] = useState<DailyComparisonOverview>({
    status: "loading",
    rows: [],
  });
  const token = useRef(0);

  useEffect(() => {
    const my = ++token.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intended date→table sync
    setOverview({ status: "loading", rows: [] });

    if (historyStatus === "loading" || staffing.status === "loading") return;
    if (!SUPABASE_ENABLED || historyStatus === "error") {
      setOverview({ status: "error", rows: [] });
      return;
    }

    const days = history.slice(-COMPARISON_ROWS);
    if (days.length === 0) {
      setOverview({ status: "missing", rows: [] });
      return;
    }
    const heldOverByDate = new Map(history.map((d) => [d.date, d.heldOver]));

    void (async () => {
      // The selected date's staffing is already loaded by the overview hook
      // (live board today, stored snapshot for a past date) — only the other
      // rows need snapshots.
      const snapshotDates = days
        .map((d) => d.date)
        .filter((d) => d !== date);

      const [snapshots, endingDates, allocationsPerDay] = await Promise.all([
        loadAssignmentBoardSnapshotsForDates(snapshotDates).catch(() => []),
        fetchRecentSavedEndingStockThrough(date, ENDING_STOCK_DATE_LIMIT).catch(
          () => null,
        ),
        Promise.all(
          days.map((d) =>
            fetchAllocationsForTargetDate(d.date).catch(() => null),
          ),
        ),
      ]);
      if (my !== token.current) return;

      const staffingByDate = new Map<string, ComparisonStaffing>();
      for (const record of snapshots) {
        const summary = computeSummary(computeAllStats(record.snapshot));
        staffingByDate.set(record.work_date, {
          assigned: summary.totalAssigned,
          target: summary.totalTarget,
        });
      }
      if (staffing.status === "ready") {
        staffingByDate.set(date, {
          assigned: staffing.assigned,
          target: staffing.target,
        });
      }

      const endingByDate = new Map<string, EndingStockByGroup>(
        (endingDates ?? []).map((entry) => [entry.date, entry.byGroup]),
      );
      const windowComplete =
        endingDates !== null && endingDates.length < ENDING_STOCK_DATE_LIMIT;

      const rows: ComparisonRow[] = days
        .map((day, index) => ({
          date: day.date,
          totalHogs: day.totalHogs,
          forCutting: day.forCutting,
          staffing: staffingByDate.get(day.date) ?? null,
          primalPercent:
            endingDates === null || allocationsPerDay[index] === null
              ? null
              : historicalPrimalPercent(
                  day,
                  endingByDate,
                  windowComplete,
                  allocationsPerDay[index],
                  heldOverByDate.get(previousDateString(day.date)) ?? 0,
                ),
        }))
        .reverse();

      setOverview({ status: "ready", rows });
    })();
  }, [date, history, historyStatus, staffing]);

  return overview;
}
