"use client";

import { useEffect, useRef, useState } from "react";
import { SUPABASE_ENABLED } from "@/lib/config";
import {
  fetchHogIntakeByDate,
  fetchPreviousHeldOver,
} from "@/features/hog-intake/supabase";
import type { HogIntakeRecord } from "@/features/hog-intake/types";
import { fetchAllocationsForTargetDate } from "@/features/primal-calculation/allocations-source";
import {
  fetchLatestEndingStockDateBefore,
  fetchSavedEndingStockForDate,
} from "@/features/primal-calculation/ending-stock-source";
import { emptyEndingStockByGroup } from "@/features/primal-calculation/types";
import { buildPrimalUsage, type PrimalUsage } from "../primal-usage";
import type { OverviewStatus } from "./use-operations-overview";

export type PrimalUsageOverview = {
  status: OverviewStatus;
  usage: PrimalUsage | null;
  // Usage on the most recent earlier date with complete comparable data
  // (saved ending stock + an intake record), or null when none exists.
  comparison: { date: string; deltaPoints: number } | null;
};

const LOADING: PrimalUsageOverview = {
  status: "loading",
  usage: null,
  comparison: null,
};

// Usage for one date: the date's saved ending stock read against a supply
// side rebuilt with the same existing primal helpers the page uses. Null when
// the date has no saved ending stock, no intake record, or inconsistent data.
async function loadUsageForDate(
  date: string,
  record: HogIntakeRecord,
): Promise<PrimalUsage | null> {
  const [endingStock, prevDate, heldOverPrev, incomingAllocations] =
    await Promise.all([
      fetchSavedEndingStockForDate(date),
      fetchLatestEndingStockDateBefore(date),
      fetchPreviousHeldOver(date),
      fetchAllocationsForTargetDate(date),
    ]);
  if (!endingStock) return null;
  const openingStock = prevDate
    ? ((await fetchSavedEndingStockForDate(prevDate)) ??
      emptyEndingStockByGroup())
    : emptyEndingStockByGroup();
  return buildPrimalUsage({
    record,
    heldOverPrev,
    openingStock,
    incomingAllocations,
    endingStock,
    date,
  });
}

// Read-only Primal Usage for the Operations dashboard. Consumes the intake
// record the overview hook already fetched (no duplicate intake query) and
// reads only focused primal sources: saved ending stock, allocations targeting
// the date, and the carry-over chain. Never persists anything.
export function usePrimalUsage(
  date: string,
  intakeStatus: OverviewStatus,
  record: HogIntakeRecord | null,
) {
  const [overview, setOverview] = useState<PrimalUsageOverview>(LOADING);
  const token = useRef(0);

  useEffect(() => {
    const my = ++token.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intended date→usage sync
    setOverview(LOADING);

    if (intakeStatus === "loading") return;
    if (!SUPABASE_ENABLED || intakeStatus === "error") {
      setOverview({ status: "error", usage: null, comparison: null });
      return;
    }
    // No intake record ⇒ expected production can't be rebuilt for the date.
    if (intakeStatus === "missing" || record === null) {
      setOverview({ status: "missing", usage: null, comparison: null });
      return;
    }

    void (async () => {
      try {
        const usage = await loadUsageForDate(date, record);
        if (my !== token.current) return;
        if (!usage) {
          setOverview({ status: "missing", usage: null, comparison: null });
          return;
        }

        // Comparison: the most recent earlier date with saved ending stock.
        // Best-effort — skipped (not an error) when that date can't be
        // reconstructed, e.g. it has no intake record.
        let comparison: PrimalUsageOverview["comparison"] = null;
        const prevDate = await fetchLatestEndingStockDateBefore(date);
        if (prevDate) {
          const prevRecord = await fetchHogIntakeByDate(prevDate);
          if (prevRecord) {
            const prevUsage = await loadUsageForDate(prevDate, prevRecord);
            if (prevUsage) {
              comparison = {
                date: prevDate,
                deltaPoints: usage.percent - prevUsage.percent,
              };
            }
          }
        }
        if (my !== token.current) return;
        setOverview({ status: "ready", usage, comparison });
      } catch {
        if (my !== token.current) return;
        setOverview({ status: "error", usage: null, comparison: null });
      }
    })();
  }, [date, intakeStatus, record]);

  return overview;
}
