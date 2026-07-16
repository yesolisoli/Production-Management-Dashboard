"use client";

import { useMemo } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { deriveGroupAvailability, orderedByGroup } from "../calculations";
import { useOrdersAllocationState } from "../hooks/use-orders-allocation-state";
import { usePrimalDemand } from "../hooks/use-primal-demand";
import { AllocationSheetSection } from "./allocation-sheet-section";
import { AvailabilitySection } from "./availability-section";
import { DemandHeaderActions } from "./demand-header-actions";
import { SaveBar } from "./save-bar";

// Presentation orchestrator for Orders & Allocation — owns the morning-brief
// ALLOCATION SHEET. The day's cut plan lives on the Production Planner screen;
// both screens share the same draft (localStorage, keyed by date). Primal demand
// stays wired here as read-only reference for the header's per-group counts.
export function OrdersAllocationClient() {
  const {
    date,
    draft,
    isEmpty,
    setDate,
    addInstruction,
    updateInstruction,
    removeInstruction,
    clearInstructions,
    clearAll,
  } = useOrdersAllocationState();

  const { snapshot, status } = usePrimalDemand(date);

  // Per-group ordered counts from Primal demand — the header strip.
  const ordered = useMemo(
    () => orderedByGroup(snapshot?.availability ?? []),
    [snapshot],
  );

  // Availability — Primal Ending Stock per group, reduced by the date's
  // allocation instructions. Derived here so it recomputes the moment an
  // instruction is added, edited, or removed. Never persisted.
  const availability = useMemo(
    () =>
      deriveGroupAvailability(
        snapshot?.availability ?? [],
        draft.instructions,
      ),
    [snapshot, draft.instructions],
  );

  return (
    <>
      <AppHeader
        eyebrow="Operations Module"
        title="Orders & Allocation"
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
          <AvailabilitySection status={status} rows={availability} />

          <AllocationSheetSection
            rows={draft.instructions}
            date={date}
            onAdd={addInstruction}
            onUpdate={updateInstruction}
            onRemove={removeInstruction}
            onClear={clearInstructions}
          />

          <SaveBar isEmpty={isEmpty} onClear={clearAll} />
        </div>
      </div>
    </>
  );
}
