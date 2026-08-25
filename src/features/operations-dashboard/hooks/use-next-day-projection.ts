"use client";

import { useMemo } from "react";
import { projectedForCutting } from "@/features/hog-intake/calculations";
import {
  nextPlanDate,
  plannedCutCount,
  useWeeklyHogSchedule,
} from "@/features/hog-intake/hooks/use-weekly-hog-schedule";
import type { HogIntakeRecord } from "@/features/hog-intake/types";

// "empty" = no plan figure exists for a future working day — the card shows a
// neutral "No upcoming projection" note rather than a misleading 0.
export type NextDayProjectionOverview =
  | {
      status: "ready";
      date: string;
      // Weekly Hog Plan "Cut - Markets" count for the next working day.
      hogCount: number;
      // Stored on the selected date's intake record (next_day fields).
      sideOrders: number;
      coolerOverstock: number;
      // hogCount − hogs consumed by side orders + cooler overstock — the same
      // "Next Day Projected For Cutting" figure the intake page shows.
      projected: number;
    }
  | { status: "empty" };

// Read-only mirror of the intake page's Next Day Projection: the Weekly Hog
// Plan's "Cut - Markets" count for the next working day after the selected
// date (use-weekly-hog-schedule, the single source of truth), combined with
// the side orders / cooler overstock saved on the selected date's intake
// record, through the same projectedForCutting calculation — nothing is
// stored or editable here. A missing record contributes zeros, matching how
// the intake page starts an unsaved day.
export function useNextDayProjection(
  date: string,
  record: HogIntakeRecord | null,
): NextDayProjectionOverview {
  const { rows } = useWeeklyHogSchedule();

  return useMemo(() => {
    const next = nextPlanDate(date);
    if (!next) return { status: "empty" };
    const hogCount = plannedCutCount(rows, next.day);
    if (hogCount === null) return { status: "empty" };
    const sideOrders = record?.next_day.side_orders ?? 0;
    const coolerOverstock = record?.next_day.cooler_overstock ?? 0;
    return {
      status: "ready",
      date: next.date,
      hogCount,
      sideOrders,
      coolerOverstock,
      projected: projectedForCutting({
        hog_count: hogCount,
        side_orders: sideOrders,
        cooler_overstock: coolerOverstock,
      }),
    };
  }, [rows, date, record]);
}
