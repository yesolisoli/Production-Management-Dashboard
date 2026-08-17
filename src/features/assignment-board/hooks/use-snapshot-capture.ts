"use client";

import { useEffect, useRef } from "react";
import type { AssignmentBoardSnapshot } from "../supabase";
import { saveAssignmentBoardSnapshot, snapshotExistsForDate } from "../supabase";
import { parseTimeMin, todayDateString } from "../utils";
import type { WorkAreaShiftMap } from "../types";

const GRACE_MIN = 30;
const TICK_MS = 60_000;

function getLatestShiftEndMin(workAreaShifts: WorkAreaShiftMap): number | null {
  let latest = -1;
  for (const perMode of Object.values(workAreaShifts)) {
    for (const shifts of Object.values(perMode)) {
      for (const shift of shifts) {
        if (!shift.time_range.includes("-")) continue;
        const [, end] = shift.time_range.split("-").map((p) => p.trim());
        const endMin = parseTimeMin(end);
        if (Number.isFinite(endMin) && endMin > latest) latest = endMin;
      }
    }
  }
  return latest >= 0 ? latest : null;
}

export function useSnapshotCapture(params: {
  enabled: boolean;
  snapshot: AssignmentBoardSnapshot;
  workAreaShifts: WorkAreaShiftMap;
}) {
  const { enabled, snapshot, workAreaShifts } = params;

  const snapshotRef = useRef(snapshot);
  const shiftsRef = useRef(workAreaShifts);
  const attemptedForDateRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  // Latest-value refs, synced after commit; tick() only reads them from
  // timer callbacks, which always run after this effect.
  useEffect(() => {
    snapshotRef.current = snapshot;
    shiftsRef.current = workAreaShifts;
  }, [snapshot, workAreaShifts]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;

      const workDate = todayDateString();
      if (attemptedForDateRef.current === workDate) return;

      const latestEnd = getLatestShiftEndMin(shiftsRef.current);
      if (latestEnd === null) return;

      const snap = snapshotRef.current;
      if (
        snap.workAreas.length === 0 ||
        snap.stations.length === 0 ||
        snap.employees.length === 0
      ) {
        return;
      }

      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin < latestEnd + GRACE_MIN) return;

      inFlightRef.current = true;
      try {
        const exists = await snapshotExistsForDate(workDate);
        if (cancelled) return;
        if (exists) {
          attemptedForDateRef.current = workDate;
          return;
        }
        await saveAssignmentBoardSnapshot({
          workDate,
          snapshot: snapshotRef.current,
        });
        if (!cancelled) attemptedForDateRef.current = workDate;
      } catch (error) {
        console.warn("[assignment-board] Snapshot capture failed:", error);
      } finally {
        inFlightRef.current = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);
}
