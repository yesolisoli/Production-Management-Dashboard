"use client";

import { Calendar } from "lucide-react";
import type { GroupReconcile } from "../calculations";
import { productLabel } from "../types";

// Shared AppHeader actions for the Primal-demand screens (Production Planner +
// Orders & Allocation): the per-group ordered counts and the date picker that
// drives which day's Primal demand / draft is loaded.
type DemandHeaderActionsProps = {
  reconcile: GroupReconcile[];
  date: string;
  onDateChange: (date: string) => void;
};

export function DemandHeaderActions({
  reconcile,
  date,
  onDateChange,
}: DemandHeaderActionsProps) {
  return (
    <>
      <div className="mr-2 hidden items-center gap-3.5 pr-3 lg:flex">
        {reconcile.map((group) => (
          <div key={group.group} className="flex flex-col items-end leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
              {productLabel(group.group)}
            </span>
            <span className="text-base font-bold tabular-nums text-white">
              {group.ordered}
            </span>
          </div>
        ))}
      </div>

      <label className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-transparent sm:h-auto sm:w-auto sm:justify-start sm:gap-2 sm:px-3 sm:py-2">
        <Calendar size={16} className="shrink-0 text-white/70" />
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0 sm:static sm:h-7 sm:w-auto sm:min-w-0 sm:cursor-auto sm:border-0 sm:bg-transparent sm:text-sm sm:font-semibold sm:tabular-nums sm:text-white sm:opacity-100 sm:outline-none sm:scheme-dark"
        />
      </label>
    </>
  );
}
