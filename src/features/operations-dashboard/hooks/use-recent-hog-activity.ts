"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SUPABASE_ENABLED } from "@/lib/config";
import { forCutting, totalHogs } from "@/features/hog-intake/calculations";
import { fetchRecentIntakeThrough } from "@/features/hog-intake/supabase";
import type { OverviewStatus } from "./use-operations-overview";

export const RECENT_DAYS_LIMIT = 7;

export type RecentActivityDay = {
  date: string;
  totalHogs: number;
  forCutting: number;
};

// The most recent recorded intake days up to and including the selected date
// (max 7), with the same totals the Hog Intake summary shows. Days with no
// saved record are simply absent — a gap is not a zero.
export function useRecentHogActivity(date: string) {
  const [days, setDays] = useState<RecentActivityDay[]>([]);
  const [status, setStatus] = useState<OverviewStatus>("loading");
  const token = useRef(0);

  const load = useCallback((forDate: string) => {
    const my = ++token.current;
    setStatus("loading");

    if (!SUPABASE_ENABLED) {
      setDays([]);
      setStatus("error");
      return;
    }

    void (async () => {
      try {
        const rows = await fetchRecentIntakeThrough(forDate, RECENT_DAYS_LIMIT);
        if (my !== token.current) return;
        setDays(
          rows.map((row) => ({
            date: row.date,
            totalHogs: totalHogs(row.hog_counts),
            forCutting: forCutting(row.hog_counts, row.side_orders),
          })),
        );
        setStatus("ready");
      } catch {
        if (my !== token.current) return;
        setDays([]);
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

  return { days, status };
}
