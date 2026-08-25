"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SUPABASE_ENABLED } from "@/lib/config";
import { todayString } from "@/lib/date";
import { deriveTotals } from "@/features/hog-intake/calculations";
import {
  fetchHogIntakeByDate,
  fetchLatestIntakeBefore,
  fetchPreviousHeldOver,
} from "@/features/hog-intake/supabase";
import type { HogIntakeRecord } from "@/features/hog-intake/types";
import {
  fetchAssignmentBoardSnapshot,
  loadAssignmentBoardSnapshot,
  loadLatestSnapshotBefore,
  type AssignmentBoardSnapshot,
} from "@/features/assignment-board/supabase";
import { getUnavailableStatusCodes } from "@/features/assignment-board/components/status-select";
import {
  computeAllStats,
  computeSummary,
} from "@/features/daily-lineup/utils/compute-stats";
import type { LineupSummary, WorkAreaStats } from "@/features/daily-lineup/types";

// "missing" = the source has no saved data for the selected date (no intake
// record / no lineup snapshot) — distinct from "error" (fetch failed).
export type OverviewStatus = "loading" | "ready" | "missing" | "error";

export type IntakeOverview = {
  status: OverviewStatus;
  totalHogs: number;
  forCutting: number;
  // The hog-intake card's "Primal Total": yield hogs cut today (JP + RWA,
  // plus BK when opted in), net of held-over carry and deaths.
  primalTotal: number;
  // The raw record behind the totals, so other sections (Primal Usage) can
  // reuse this same fetch. Null unless status is "ready".
  record: HogIntakeRecord | null;
  // Most recent saved intake before the selected date (previous working day).
  previous: { date: string; totalHogs: number; forCutting: number } | null;
};

export type StaffingOverview = {
  status: OverviewStatus;
  available: number;
  assigned: number;
  target: number;
  // Per-department stats and their rollup, exactly as Daily Lineup computes
  // them (computeAllStats/computeSummary on the same board load).
  departments: WorkAreaStats[];
  summary: LineupSummary | null;
  // Most recent lineup snapshot before the selected date. Snapshots are
  // captured best-effort, so this can be null even when yesterday was worked.
  previousAvailable: { date: string; available: number } | null;
};

const LOADING_INTAKE: IntakeOverview = {
  status: "loading",
  totalHogs: 0,
  forCutting: 0,
  primalTotal: 0,
  record: null,
  previous: null,
};

const LOADING_STAFFING: StaffingOverview = {
  status: "loading",
  available: 0,
  assigned: 0,
  target: 0,
  departments: [],
  summary: null,
  previousAvailable: null,
};

// Same availability predicate Daily Lineup uses (compute-stats): active
// employees whose current status is not flagged `unavailable` in
// status_configs; no status row means available.
function availableCount(snapshot: AssignmentBoardSnapshot): number {
  const unavailable = getUnavailableStatusCodes(snapshot.statusConfigs);
  return snapshot.employees.filter((employee) => {
    if (!employee.active) return false;
    const status = snapshot.statuses[employee.id];
    return status ? !unavailable.has(status) : true;
  }).length;
}

// Read-only overview for the Operations dashboard. Composes the existing
// sources — hog_intake_records for the hog cards, the live assignment board
// (or a stored snapshot for past dates) for the staffing cards — and never
// persists anything.
export function useOperationsOverview() {
  const [date, setDate] = useState<string>(todayString);
  const [intake, setIntake] = useState<IntakeOverview>(LOADING_INTAKE);
  const [staffing, setStaffing] = useState<StaffingOverview>(LOADING_STAFFING);
  const token = useRef(0);

  const load = useCallback((forDate: string) => {
    const my = ++token.current;
    setIntake(LOADING_INTAKE);
    setStaffing(LOADING_STAFFING);

    if (!SUPABASE_ENABLED) {
      setIntake({ ...LOADING_INTAKE, status: "error" });
      setStaffing({ ...LOADING_STAFFING, status: "error" });
      return;
    }

    void (async () => {
      try {
        const [record, prevRecord, heldOverPrev] = await Promise.all([
          fetchHogIntakeByDate(forDate),
          fetchLatestIntakeBefore(forDate),
          // Hogs held over from the previous day, cut on this date — needed so
          // primalTotal matches the intake card's adjusted Primal Total.
          fetchPreviousHeldOver(forDate),
        ]);
        if (my !== token.current) return;
        const previous = prevRecord
          ? (() => {
              const totals = deriveTotals(prevRecord);
              return {
                date: prevRecord.date,
                totalHogs: totals.totalHogs,
                forCutting: totals.forCutting,
              };
            })()
          : null;
        if (!record) {
          setIntake({
            status: "missing",
            totalHogs: 0,
            forCutting: 0,
            primalTotal: 0,
            record: null,
            previous,
          });
          return;
        }
        const totals = deriveTotals(record, heldOverPrev);
        setIntake({
          status: "ready",
          totalHogs: totals.totalHogs,
          forCutting: totals.forCutting,
          primalTotal: totals.yieldTotal,
          record,
          previous,
        });
      } catch {
        if (my !== token.current) return;
        setIntake({ ...LOADING_INTAKE, status: "error" });
      }
    })();

    void (async () => {
      try {
        // Employee statuses are live-only (the board holds current state, not
        // history), so past dates can only be read from stored snapshots.
        const isToday = forDate === todayString();
        const [current, prevSnapshot] = await Promise.all([
          isToday
            ? fetchAssignmentBoardSnapshot()
            : loadAssignmentBoardSnapshot(forDate).then(
                (row) => row?.snapshot ?? null,
              ),
          loadLatestSnapshotBefore(forDate),
        ]);
        if (my !== token.current) return;
        const previousAvailable = prevSnapshot
          ? {
              date: prevSnapshot.work_date,
              available: availableCount(prevSnapshot.snapshot),
            }
          : null;
        if (!current) {
          setStaffing({
            status: "missing",
            available: 0,
            assigned: 0,
            target: 0,
            departments: [],
            summary: null,
            previousAvailable,
          });
          return;
        }
        const departments = computeAllStats(current);
        const summary = computeSummary(departments);
        setStaffing({
          status: "ready",
          available: availableCount(current),
          assigned: summary.totalAssigned,
          target: summary.totalTarget,
          departments,
          summary,
          previousAvailable,
        });
      } catch {
        if (my !== token.current) return;
        setStaffing({ ...LOADING_STAFFING, status: "error" });
      }
    })();
  }, []);

  useEffect(() => {
    // Intended date→overview sync (reloads both sources for the date), not an
    // avoidable render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date);
  }, [date, load]);

  return { date, setDate, intake, staffing };
}
