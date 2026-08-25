"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SUPABASE_ENABLED } from "@/lib/config";
import { forCutting, totalHogs } from "@/features/hog-intake/calculations";
import { fetchRecentIntakeThrough } from "@/features/hog-intake/supabase";
import type { HogCounts } from "@/features/hog-intake/types";
import type { OverviewStatus } from "./use-operations-overview";

export const RECENT_DAYS_LIMIT = 7;
// Two windows of RECENT_DAYS_LIMIT, so the trend summary can compare the
// latest 7 recorded values against the 7 recorded before them — one fetch
// serves the chart (last 7), the comparison table, and the trend.
const HISTORY_LIMIT = RECENT_DAYS_LIMIT * 2;

export type RecentActivityDay = {
  date: string;
  totalHogs: number;
  forCutting: number;
  // Raw stored counts, kept alongside the derived totals so the Hog Type
  // Breakdown can reuse this same fetch instead of issuing its own.
  hogCounts: HogCounts;
  // Yield-adjustment inputs, carried through so the Daily Comparison table can
  // rebuild historical primal supply without refetching intake records.
  heldOver: number;
  deathsOnArrival: number;
  includeBkInYield: boolean;
};

// The most recent recorded intake days up to and including the selected date,
// with the same totals the Hog Intake summary shows. Days with no saved
// record are simply absent — a gap is not a zero. `days` is the last
// RECENT_DAYS_LIMIT records (the chart window, unchanged); `history` is the
// full fetched window of up to HISTORY_LIMIT records, oldest first.
export function useRecentHogActivity(date: string) {
  const [history, setHistory] = useState<RecentActivityDay[]>([]);
  const [status, setStatus] = useState<OverviewStatus>("loading");
  const token = useRef(0);

  const load = useCallback((forDate: string) => {
    const my = ++token.current;
    setStatus("loading");

    if (!SUPABASE_ENABLED) {
      setHistory([]);
      setStatus("error");
      return;
    }

    void (async () => {
      try {
        const rows = await fetchRecentIntakeThrough(forDate, HISTORY_LIMIT);
        if (my !== token.current) return;
        setHistory(
          rows.map((row) => ({
            date: row.date,
            totalHogs: totalHogs(row.hog_counts),
            forCutting: forCutting(row.hog_counts, row.side_orders),
            hogCounts: row.hog_counts,
            heldOver: row.held_over,
            deathsOnArrival: row.deaths_on_arrival,
            includeBkInYield: row.include_bk_in_yield,
          })),
        );
        setStatus("ready");
      } catch {
        if (my !== token.current) return;
        setHistory([]);
        setStatus("error");
      }
    })();
  }, []);

  useEffect(() => {
    // Intended date→history sync (reloads the recent window for the date),
    // not an avoidable render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date);
  }, [date, load]);

  return { days: history.slice(-RECENT_DAYS_LIMIT), history, status };
}
