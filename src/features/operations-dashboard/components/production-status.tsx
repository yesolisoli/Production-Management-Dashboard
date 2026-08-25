"use client";

import {
  AlertTriangle,
  ChartLine,
  CheckCircle2,
  ClipboardList,
  Clock,
  Factory,
  Printer,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  ProductionStatusSummary,
  RoutePrintingStatusSummary,
} from "@/features/orders-allocation/calculations";
import type {
  ProductionSideOverview,
  RouteSideOverview,
} from "../hooks/use-production-status";
import {
  ColumnFooter,
  MetricTiles,
  PrimaryCount,
  SectionLabel,
} from "./summary-blocks";

// Production Status — one parent card, two compact columns: a rollup of the
// Production Planner's sheet and of the Route Printing Schedule for the
// selected date. Presentation only; every figure comes from the planner's own
// pure summary builders via use-production-status.

function ProductionSide({
  overview,
  isToday,
}: {
  overview: ProductionSideOverview;
  isToday: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col p-4 sm:p-5">
      <SectionLabel icon={ChartLine}>
        {isToday ? "Today's Production" : "Production"}
      </SectionLabel>

      {overview.status === "loading" && (
        <div className="skeleton-shimmer mt-3 h-36 rounded-xl" />
      )}

      {overview.status === "error" && (
        <EmptyState
          icon={ClipboardList}
          title="Couldn't load data"
          className="py-6 sm:py-8"
        />
      )}

      {overview.status === "ready" &&
        (overview.summary.total === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No production lines for this day."
            description="Lines appear once the day has orders or instructions in the Production Planner."
            className="py-6 sm:py-8"
          />
        ) : (
          <ProductionSummaryBody summary={overview.summary} />
        ))}
    </div>
  );
}

function ProductionSummaryBody({
  summary,
}: {
  summary: ProductionStatusSummary;
}) {
  return (
    <>
      <PrimaryCount
        value={summary.total}
        unit={summary.total === 1 ? "line planned" : "lines planned"}
      />
      <div className="mt-4 pb-4">
        <MetricTiles
          metrics={[
            { value: summary.scheduled, label: "Scheduled", accent: "blue" },
            { value: summary.needsSetup, label: "Need Setup", accent: "amber" },
            {
              value: summary.overDeadline,
              label: "Over Deadline",
              accent: "red",
            },
          ]}
        />
      </div>
      {summary.overDeadline > 0 ? (
        <ColumnFooter icon={AlertTriangle} accent="red">
          {summary.overDeadline}{" "}
          {summary.overDeadline === 1 ? "line runs" : "lines run"} past the room
          deadline
        </ColumnFooter>
      ) : summary.needsSetup > 0 ? (
        <ColumnFooter icon={AlertTriangle} accent="amber">
          {summary.needsSetup}{" "}
          {summary.needsSetup === 1 ? "line still needs" : "lines still need"}{" "}
          setup
        </ColumnFooter>
      ) : (
        <ColumnFooter icon={CheckCircle2} accent="emerald">
          All lines scheduled
        </ColumnFooter>
      )}
    </>
  );
}

function RoutesSide({
  overview,
  isToday,
}: {
  overview: RouteSideOverview;
  isToday: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col p-4 sm:p-5">
      <SectionLabel icon={Printer} accent="emerald">
        Route Printing
      </SectionLabel>

      {overview.status === "loading" && (
        <div className="skeleton-shimmer mt-3 h-36 rounded-xl" />
      )}

      {overview.status === "ready" &&
        (overview.summary.total === 0 ? (
          <EmptyState
            icon={Printer}
            title="No printing schedule for this day"
            description="Route deadlines are set Monday through Friday."
            className="py-6 sm:py-8"
          />
        ) : (
          <RoutesSummaryBody summary={overview.summary} isToday={isToday} />
        ))}
    </div>
  );
}

function RoutesSummaryBody({
  summary,
  isToday,
}: {
  summary: RoutePrintingStatusSummary;
  isToday: boolean;
}) {
  const allPrinted = summary.printed === summary.total;
  return (
    <>
      <PrimaryCount
        value={summary.total}
        unit={
          summary.total === 1
            ? isToday
              ? "route today"
              : "route"
            : isToday
              ? "routes today"
              : "routes"
        }
      />
      <div className="mt-4 pb-4">
        <MetricTiles
          metrics={[
            { value: summary.printed, label: "Printed", accent: "emerald" },
            { value: summary.remaining, label: "Remaining", accent: "blue" },
            { value: summary.overdue, label: "Overdue", accent: "red" },
          ]}
        />
      </div>
      {allPrinted ? (
        <ColumnFooter icon={CheckCircle2} accent="emerald">
          All routes printed
        </ColumnFooter>
      ) : summary.nextDeadline ? (
        <ColumnFooter
          icon={summary.overdue > 0 ? AlertTriangle : Clock}
          accent={summary.overdue > 0 ? "amber" : "slate"}
        >
          Next deadline: Route {summary.nextDeadline.route} ·{" "}
          {summary.nextDeadline.deadline}
        </ColumnFooter>
      ) : (
        <ColumnFooter icon={Clock} accent="slate">
          No upcoming print deadlines
        </ColumnFooter>
      )}
    </>
  );
}

export function ProductionStatus({
  isToday,
  production,
  routes,
}: {
  isToday: boolean;
  production: ProductionSideOverview;
  routes: RouteSideOverview;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b border-slate-100 px-4 py-3 sm:px-5">
        <span className="flex h-8 w-8 items-center justify-center self-center rounded-lg bg-indigo-50 text-indigo-600">
          <Factory size={16} strokeWidth={2} />
        </span>
        <h3 className="text-base font-bold text-slate-900">
          Production Status
        </h3>
        <p className="text-xs text-slate-400">
          Production Planner · Route Printing Schedule
        </p>
      </header>

      <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <ProductionSide overview={production} isToday={isToday} />
        <RoutesSide overview={routes} isToday={isToday} />
      </div>
    </section>
  );
}
