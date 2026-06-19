"use client";

import { useEffect, useMemo, useRef } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { reconcileByGroup } from "../calculations";
import { useOrdersAllocationState } from "../hooks/use-orders-allocation-state";
import { usePrimalDemand } from "../hooks/use-primal-demand";
import { CutOrdersSection } from "./cut-orders-section";
import { DemandHeaderActions } from "./demand-header-actions";
import { SaveBar } from "./save-bar";

// Production Planner — owns the day's CUT PLAN.
//
// Flow: Primal demand (read-only source) seeds suggested cut orders into the
// draft the first time a date's draft is empty → planner adjusts pieces /
// location / notes → Save. The draft (shared with Orders & Allocation via the
// localStorage store, keyed by date) is the single source of truth; Primal is
// reference only.
export function ProductionPlannerClient() {
  const {
    date,
    draft,
    status,
    isEmpty,
    cutOrdersTotals,
    setDate,
    addCutOrder,
    updateCutOrder,
    removeCutOrder,
    clearCutOrders,
    replaceCutOrders,
    clearAll,
    save,
  } = useOrdersAllocationState();

  const { snapshot, status: demandStatus, suggestedCutOrders } =
    usePrimalDemand(date);

  // Per-group reconciliation of Primal demand against the cut orders entered.
  const reconcile = useMemo(
    () => reconcileByGroup(snapshot?.availability ?? [], draft.cut_orders),
    [snapshot, draft.cut_orders],
  );

  // Seed the day's cut orders from Primal demand the first time we see a date
  // whose draft is still empty. Once seeded (or if the planner already entered
  // rows) we never silently overwrite — they regenerate explicitly instead.
  const seededDate = useRef<string | null>(null);
  useEffect(() => {
    if (demandStatus === "loading") return; // wait for the snapshot
    if (seededDate.current === date) return;
    if (draft.cut_orders.length > 0) {
      seededDate.current = date; // already has content — don't seed over it
      return;
    }
    seededDate.current = date;
    // Intended one-time seed of an empty draft from Primal demand.
    if (suggestedCutOrders.length > 0) replaceCutOrders(suggestedCutOrders);
  }, [
    date,
    demandStatus,
    draft.cut_orders.length,
    suggestedCutOrders,
    replaceCutOrders,
  ]);

  return (
    <>
      <AppHeader
        eyebrow="Operations Module"
        title="Production Planner"
        actions={
          <DemandHeaderActions
            reconcile={reconcile}
            date={date}
            onDateChange={setDate}
          />
        }
      />

      <div className="bg-slate-50">
        <div className="flex flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <CutOrdersSection
            rows={draft.cut_orders}
            totals={cutOrdersTotals}
            onAdd={addCutOrder}
            onUpdate={updateCutOrder}
            onRemove={removeCutOrder}
            onClear={clearCutOrders}
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
