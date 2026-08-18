"use client";

import clsx from "clsx";
import { LayoutGrid } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { LineupSummary, WorkAreaStats } from "@/features/daily-lineup/types";
import { STATUS_META } from "@/features/daily-lineup/utils/classify-status";
import type { StaffingOverview } from "../hooks/use-operations-overview";

function differenceLabel(overTarget: number): string {
  if (overTarget === 0) return "at target";
  if (overTarget > 0) return `+${overTarget} surplus`;
  return `${-overTarget} below target`;
}

type Metric = { label: string; value: number };

// Same rollups Daily Lineup's summary tiles show: unavailable is
// absent + vacation, short includes critical, on track includes full crew.
function buildMetrics(summary: LineupSummary): Metric[] {
  return [
    { label: "Unavailable", value: summary.totalAbsent + summary.onVacation },
    { label: "Short Depts", value: summary.deptsShort + summary.deptsCritical },
    { label: "Over Depts", value: summary.deptsOver },
    { label: "On Track Depts", value: summary.deptsOnTrack + summary.deptsFullCrew },
  ];
}

function DepartmentRow({ dept }: { dept: WorkAreaStats }) {
  const meta = STATUS_META[dept.status];
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[minmax(0,1.4fr)_auto_minmax(5.5rem,auto)_minmax(0,1fr)]">
      <p className="truncate text-sm font-medium text-slate-800">
        {dept.workAreaName}
      </p>
      <p className="text-sm tabular-nums text-slate-600">
        {dept.assigned}
        <span className="text-slate-400"> / {dept.required}</span>
      </p>
      <span
        className={clsx(
          "inline-block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold",
          meta.badgeClass,
        )}
      >
        {meta.label}
      </span>
      <p className="text-right text-xs text-slate-500 sm:text-left">
        {differenceLabel(dept.overTarget)}
      </p>
    </li>
  );
}

export function DepartmentOverview({ staffing }: { staffing: StaffingOverview }) {
  const { status, departments, summary } = staffing;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="flex h-7 w-7 items-center justify-center self-center rounded-lg bg-slate-100 text-slate-500">
          <LayoutGrid size={15} strokeWidth={2} />
        </span>
        <h3 className="text-sm font-semibold text-slate-600">
          Department Overview
        </h3>
        <p className="text-xs text-slate-400">Department staffing summary</p>
      </div>

      {status === "loading" && (
        <div className="skeleton-shimmer mt-3 h-28 rounded-xl" />
      )}

      {status === "error" && (
        <EmptyState icon={LayoutGrid} title="Couldn't load data" />
      )}

      {status === "missing" && (
        <EmptyState
          icon={LayoutGrid}
          title="No saved department staffing for this day"
          description="Department staffing can only be shown for days the lineup was captured."
        />
      )}

      {status === "ready" && summary && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {buildMetrics(summary).map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
              >
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {metric.value}
                </p>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>

          {departments.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="No departments configured yet"
            />
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {departments.map((dept) => (
                <DepartmentRow key={dept.workAreaId} dept={dept} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
