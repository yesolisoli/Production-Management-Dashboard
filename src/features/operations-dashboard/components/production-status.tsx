"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
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

// Production Status — one parent card, two compact columns: a rollup of the
// Production Planner's sheet and of the Route Printing Schedule for the
// selected date. Presentation only; every figure comes from the planner's own
// pure summary builders via use-production-status.

type MetricTone = "good" | "warn" | "bad" | "neutral";

const METRIC_TONE_TEXT: Record<MetricTone, string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
  neutral: "text-slate-700",
};

// Three small side-by-side counts under the primary figure. A zero renders
// muted so an all-clear column stays quiet instead of flashing status colors.
function MetricTiles({
  metrics,
}: {
  metrics: { value: number; label: string; tone: MetricTone }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl bg-slate-50 px-2 py-2.5 text-center"
        >
          <div
            className={`text-xl font-bold tabular-nums ${
              metric.value === 0 ? "text-slate-300" : METRIC_TONE_TEXT[metric.tone]
            }`}
          >
            {metric.value}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">
            {metric.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// Primary figure, e.g. "26 lines planned".
function PrimaryCount({ value, unit }: { value: number; unit: string }) {
  return (
    <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
      {value}
      <span className="ml-2 text-sm font-medium text-slate-500">{unit}</span>
    </p>
  );
}

// One-line takeaway pinned to the bottom of a column so both sides align.
function ColumnFooter({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: MetricTone;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`mt-auto flex items-center gap-1.5 border-t border-slate-100 pt-2.5 text-sm font-medium ${METRIC_TONE_TEXT[tone]}`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}

function ProductionSide({
  overview,
  isToday,
}: {
  overview: ProductionSideOverview;
  isToday: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col p-4 sm:p-5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {isToday ? "Today's Production" : "Production"}
      </h4>

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
      <div className="mt-3 pb-3">
        <MetricTiles
          metrics={[
            { value: summary.scheduled, label: "Scheduled", tone: "good" },
            { value: summary.needsSetup, label: "Need Setup", tone: "warn" },
            { value: summary.overDeadline, label: "Over Deadline", tone: "bad" },
          ]}
        />
      </div>
      {summary.overDeadline > 0 ? (
        <ColumnFooter icon={AlertTriangle} tone="bad">
          {summary.overDeadline}{" "}
          {summary.overDeadline === 1 ? "line runs" : "lines run"} past the room
          deadline
        </ColumnFooter>
      ) : summary.needsSetup > 0 ? (
        <ColumnFooter icon={AlertTriangle} tone="warn">
          {summary.needsSetup}{" "}
          {summary.needsSetup === 1 ? "line still needs" : "lines still need"}{" "}
          setup
        </ColumnFooter>
      ) : (
        <ColumnFooter icon={CheckCircle2} tone="good">
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Route Printing
      </h4>

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
      <div className="mt-3 pb-3">
        <MetricTiles
          metrics={[
            { value: summary.printed, label: "Printed", tone: "good" },
            { value: summary.remaining, label: "Remaining", tone: "neutral" },
            { value: summary.overdue, label: "Overdue", tone: "bad" },
          ]}
        />
      </div>
      {allPrinted ? (
        <ColumnFooter icon={CheckCircle2} tone="good">
          All routes printed
        </ColumnFooter>
      ) : summary.nextDeadline ? (
        <ColumnFooter
          icon={summary.overdue > 0 ? AlertTriangle : Clock}
          tone={summary.overdue > 0 ? "warn" : "neutral"}
        >
          Next deadline: Route {summary.nextDeadline.route} ·{" "}
          {summary.nextDeadline.deadline}
        </ColumnFooter>
      ) : (
        <ColumnFooter icon={Clock} tone="neutral">
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
        <span className="flex h-7 w-7 items-center justify-center self-center rounded-lg bg-slate-100 text-slate-500">
          <Factory size={15} strokeWidth={2} />
        </span>
        <h3 className="text-sm font-semibold text-slate-600">
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
