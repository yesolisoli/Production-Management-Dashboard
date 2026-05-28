"use client";

import { useDailyLineup } from "../hooks/use-daily-lineup";
import { SummaryTiles } from "./summary-tiles";
import { WorkAreaCard } from "./work-area-card";

export function DailyLineupDashboard() {
  const { workAreaStats, summary, isHydrating, loadError } = useDailyLineup();

  if (isHydrating) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
          Loading daily lineup...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          <p className="font-semibold">Could not load daily lineup</p>
          <p className="mt-1 wrap-break-word text-xs text-red-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SummaryTiles summary={summary} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workAreaStats.map((s) => (
          <WorkAreaCard key={s.workAreaId} stats={s} />
        ))}
      </div>
    </div>
  );
}
