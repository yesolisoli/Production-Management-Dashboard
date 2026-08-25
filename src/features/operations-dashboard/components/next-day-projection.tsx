"use client";

import { AlertTriangle, CalendarPlus, Info, Package } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { previousDateString } from "@/lib/date";
import { formatDayDateLabel } from "../format";
import type { NextDayProjectionOverview } from "../hooks/use-next-day-projection";
import {
  ColumnFooter,
  MetricTiles,
  PrimaryCount,
  SectionLabel,
} from "./summary-blocks";

// Next Day Projection — its own section card beside Production Status, a
// read-only mirror of the intake page's panel: the projected-for-cutting
// figure up top, with the plan hog count / side orders / cooler overstock
// inputs as stacked rows underneath. Presentation only; every figure comes
// from use-next-day-projection. Built from the same summary blocks as
// Production Status so the two cards share one column anatomy.

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
        <span className="flex h-8 w-8 items-center justify-center self-center rounded-lg bg-violet-100 text-violet-600">
          <CalendarPlus size={16} strokeWidth={2} />
        </span>
        <h3 className="text-base font-bold text-slate-900">
          Next Day Projection
        </h3>
        {dayLabel ? <p className="text-xs text-slate-400">{dayLabel}</p> : null}
      </header>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <SectionLabel icon={Package} accent="violet">
          Projected for Cutting
        </SectionLabel>

        {loading ? (
          <div className="skeleton-shimmer mt-3 h-36 rounded-xl" />
        ) : projection.status === "empty" ? (
          <EmptyState
            icon={CalendarPlus}
            title="No upcoming projection"
            description="Projections come from the Weekly Hog Plan on the Hog Intake page."
            className="py-6 sm:py-8"
          />
        ) : (
          <>
            <PrimaryCount
              value={projection.projected}
              unit={projection.projected === 1 ? "hog" : "hogs"}
              bad={projection.projected < 0}
            />
            <div className="mt-4 pb-4">
              <MetricTiles
                metrics={[
                  {
                    value: projection.hogCount,
                    label: "Plan Hog Count",
                    accent: "violet",
                  },
                  {
                    value: projection.sideOrders,
                    label: "Side Orders",
                    accent: "blue",
                  },
                  {
                    value: projection.coolerOverstock,
                    label: "Cooler Overstock",
                    accent: "teal",
                  },
                ]}
              />
            </div>
            {projection.projected < 0 ? (
              <ColumnFooter icon={AlertTriangle} accent="red">
                Side orders exceed the planned hog count
              </ColumnFooter>
            ) : (
              <ColumnFooter icon={Info} accent="slate">
                Plan hog count − side orders + cooler overstock
              </ColumnFooter>
            )}
          </>
        )}
      </div>
    </section>
  );
}
