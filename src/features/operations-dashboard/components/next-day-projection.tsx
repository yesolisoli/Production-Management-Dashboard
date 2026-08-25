"use client";

import { CalendarPlus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { previousDateString } from "@/lib/date";
import { formatDayDateLabel } from "../format";
import type { NextDayProjectionOverview } from "../hooks/use-next-day-projection";

// Next Day Projection — its own section card beside Production Status, a
// read-only mirror of the intake page's panel: the projected-for-cutting
// figure up top, with the plan hog count / side orders / cooler overstock
// inputs as tiles underneath. Presentation only; every figure comes from
// use-next-day-projection.

// Same tile treatment as Production Status's MetricTiles: zeros render muted
// so quiet inputs stay quiet.
function InputTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2.5 text-center">
      <div
        className={`text-xl font-bold tabular-nums ${
          value === 0 ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
        {label}
      </div>
    </div>
  );
}

export function NextDayProjection({
  date,
  loading,
  projection,
}: {
  date: string;
  loading: boolean;
  projection: NextDayProjectionOverview;
}) {
  // Only claim "Tomorrow" when the next working day is literally the next
  // calendar day — a Friday's projection points at Monday, not tomorrow.
  const dayLabel =
    projection.status === "ready"
      ? previousDateString(projection.date) === date
        ? `Tomorrow · ${formatDayDateLabel(projection.date)}`
        : formatDayDateLabel(projection.date)
      : null;

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b border-slate-100 px-4 py-3 sm:px-5">
        <span className="flex h-7 w-7 items-center justify-center self-center rounded-lg bg-slate-100 text-slate-500">
          <CalendarPlus size={15} strokeWidth={2} />
        </span>
        <h3 className="text-sm font-semibold text-slate-600">
          Next Day Projection
        </h3>
        {dayLabel ? <p className="text-xs text-slate-400">{dayLabel}</p> : null}
      </header>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {loading ? (
          <div className="skeleton-shimmer h-36 rounded-xl" />
        ) : projection.status === "empty" ? (
          <EmptyState
            icon={CalendarPlus}
            title="No upcoming projection"
            description="Projections come from the Weekly Hog Plan on the Hog Intake page."
            className="py-6 sm:py-8"
          />
        ) : (
          <>
            <p
              className={`mt-2 text-3xl font-bold tabular-nums ${
                projection.projected < 0 ? "text-red-600" : "text-slate-900"
              }`}
            >
              {projection.projected}
              <span className="ml-2 text-sm font-medium text-slate-500">
                hogs projected for cutting
              </span>
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <InputTile value={projection.hogCount} label="Plan Hog Count" />
              <InputTile value={projection.sideOrders} label="Side Orders" />
              <InputTile
                value={projection.coolerOverstock}
                label="Cooler Overstock"
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
