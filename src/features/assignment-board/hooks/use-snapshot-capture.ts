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
  snapshotRef.current = snapshot;
  const shiftsRef = useRef(workAreaShifts);
  shiftsRef.current = workAreaShifts;
  const attemptedForDateRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;

      const workDate = todayDateString();
      if (attemptedForDateRef.current === workDate) return;

      const latestEnd = getLatestShiftEndMin(shiftsRef.current);
      if (latestEnd === null) return;

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
