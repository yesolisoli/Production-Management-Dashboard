"use client";

import { useMemo } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { orderedByGroup } from "../calculations";
import { useOrdersAllocationState } from "../hooks/use-orders-allocation-state";
import { usePrimalDemand } from "../hooks/use-primal-demand";
import { HogBreakCalculator } from "./hog-break-calculator";
import { ProductionSheetSection } from "./production-sheet-section";
import { DemandHeaderActions } from "./demand-header-actions";
import { SaveBar } from "./save-bar";

// Production Planner — owns the day's PRODUCTION SHEET.
//
// Flow: Primal demand (read-only source) derives one SKU row per ordered SKU →
// the planner overlays operational fields (room / start / finish / net min /
// cutters / phase) per SKU → Save. The derived rows are never stored; only the
// per-SKU overlay (and the morning-brief instructions) persist, shared with
// Orders & Allocation via the localStorage store keyed by date.
export function ProductionPlannerClient() {
  const {
    date,
    draft,
    status,
    isEmpty,
    setDate,
    setProductionMeta,
    setHogBreakCalc,
    clearAll,
    save,
  } = useOrdersAllocationState();

  const { snapshot, productionRows } = usePrimalDemand(date);

  // Per-group ordered counts from Primal demand — the header strip.
  const ordered = useMemo(
    () => orderedByGroup(snapshot?.availability ?? []),
    [snapshot],
  );

  return (
    <>
      <AppHeader
        eyebrow="Operations Module"
        title="Production Planner"
        actions={
          <DemandHeaderActions
            ordered={ordered}
            date={date}
            onDateChange={setDate}
          />
        }
      />

      <div className="bg-slate-50">
        <div className="flex flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <HogBreakCalculator
            calc={draft.hog_break}
            onChange={setHogBreakCalc}
            intakeCounts={snapshot?.hogCounts ?? {}}
          />

          <ProductionSheetSection
            rows={productionRows}
            meta={draft.production_meta}
            onSetMeta={setProductionMeta}
          />

          <SaveBar
            status={status}
            isEmpty={isEmpty}
            onSave={save}
            onClear={clearAll}
          />
        </div>
      </div>
    </>
  );
}
