"use client";

import Link from "next/link";
import { LayoutGrid, Settings2 } from "lucide-react";
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

  if (workAreaStats.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <LayoutGrid size={22} className="text-slate-400" strokeWidth={2} />
          </span>
          <p className="text-base font-semibold text-slate-900">
            No departments yet
          </p>
          <p className="text-sm text-slate-500">
            Add a department to start tracking your daily lineup. Stats will
            appear here once a department is set up.
          </p>
          <Link
            href="/assignment-board"
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            <Settings2 size={16} />
            Go to Admin View
          </Link>
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
