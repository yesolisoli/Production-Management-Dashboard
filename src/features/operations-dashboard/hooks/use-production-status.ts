"use client";

import { useEffect, useMemo, useState } from "react";
import { todayString } from "@/lib/date";
import {
  buildProductionStatusSummary,
  buildRoutePrintingStatusSummary,
  instructionProductionRows,
  type ProductionStatusSummary,
  type RoutePrintingStatusSummary,
} from "@/features/orders-allocation/calculations";
import {
  isDateCleared,
  readDraft,
} from "@/features/orders-allocation/draft-storage";
import { usePrimalDemand } from "@/features/orders-allocation/hooks/use-primal-demand";
import {
  emptyAllocationDraft,
  seededAllocationDraft,
  type AllocationDraft,
} from "@/features/orders-allocation/types";

// Each side of the Production Status card loads and fails independently: the
// production summary needs the async Primal demand snapshot, while the route
// summary reads only the local draft (so it can never hit a fetch error).
export type ProductionSideOverview =
  | { status: "loading" | "error" }
  | { status: "ready"; summary: ProductionStatusSummary };

export type RouteSideOverview =
  | { status: "loading" }
  | { status: "ready"; summary: RoutePrintingStatusSummary };

// Read-only Production Status for the Operations dashboard. Rebuilds exactly
// what the Production Planner shows for the date — the saved draft, or the
// planner's own fallbacks (blank when explicitly cleared, else the standing
// seeded template) — plus the Primal-derived production rows, and rolls both
// into compact summaries via the planner's own pure helpers. Never persists.
export function useProductionStatus(date: string) {
  // The planner's draft for the date, resolved with the planner's fallback
  // chain so the dashboard always mirrors the source page. Read in an effect:
  // localStorage is client-only.
  const [draft, setDraft] = useState<AllocationDraft | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intended date→draft sync
    setDraft(
      readDraft(date) ??
        (isDateCleared(date)
          ? emptyAllocationDraft(date)
          : seededAllocationDraft(date)),
    );
  }, [date]);

  const demand = usePrimalDemand(date);

  // Guard on draft.date so the frame between a date change and the reload
  // effect can't summarise the old day's draft under the new date.
  const draftForDate = draft && draft.date === date ? draft : null;

  const production = useMemo<ProductionSideOverview>(() => {
    if (!draftForDate || demand.status === "loading")
      return { status: "loading" };
    if (demand.status === "error") return { status: "error" };
    // "missing" (no intake record) still derives rows from committed orders —
    // the planner renders the same way, so the summary follows it.
    const rows = [
      ...demand.productionRows,
      ...instructionProductionRows(draftForDate.instructions),
    ];
    return {
      status: "ready",
      summary: buildProductionStatusSummary({
        rows,
        meta: draftForDate.production_meta,
        order: draftForDate.production_order,
        roomDeadlines: draftForDate.room_deadlines,
      }),
    };
  }, [draftForDate, demand.status, demand.productionRows]);

  const routes = useMemo<RouteSideOverview>(() => {
    if (!draftForDate) return { status: "loading" };
    const today = todayString();
    const position =
      date === today ? "today" : date < today ? "past" : "future";
    const now = new Date();
    return {
      status: "ready",
      summary: buildRoutePrintingStatusSummary({
        date,
        prints: draftForDate.route_prints,
        deadlines: draftForDate.route_deadlines,
        position,
        nowMinutes:
          position === "today"
            ? now.getHours() * 60 + now.getMinutes()
            : undefined,
      }),
    };
  }, [date, draftForDate]);

  return { production, routes };
}
