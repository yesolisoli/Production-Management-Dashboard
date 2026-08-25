"use client";

import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { buildTrendLine, type TrendLine } from "../daily-comparison";
import type { OverviewStatus } from "../hooks/use-operations-overview";
import type { RecentActivityDay } from "../hooks/use-recent-hog-activity";

// Neutral directional styling on purpose: intake/cutting volume is not
// inherently good or bad, so the delta never wears green or red.
const SPARK_COLOR = "#94a3b8";

function Sparkline({ values }: { values: number[] }) {
  const W = 64;
  const H = 20;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (W - 2) + 1;
      const y = H - 2 - ((v - min) / span) * (H - 4);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} aria-hidden="true" className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={SPARK_COLOR}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function deltaLabel(deltaPercent: number | null): string {
  if (deltaPercent === null) return "—";
  if (deltaPercent === 0) return "Same";
  const arrow = deltaPercent > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(deltaPercent)}%`;
}

function TrendRow({ label, line }: { label: string; line: TrendLine }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-600">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums text-slate-800">
        {line.average}
      </p>
      <p className="w-14 text-right text-sm font-medium tabular-nums text-blue-700">
        {deltaLabel(line.deltaPercent)}
      </p>
      <Sparkline values={line.values} />
    </div>
  );
}

// Average of the latest up-to-7 recorded days vs the 7 recorded before them.
// Only intake metrics appear here: they are the only ones with a continuous
// per-day history (staffing snapshots and primal saves are best-effort).
export function TrendSummary({
  history,
  status,
}: {
  history: RecentActivityDay[];
  status: OverviewStatus;
}) {
  const intake = buildTrendLine(history, (day) => day.totalHogs);
  const cutting = buildTrendLine(history, (day) => day.forCutting);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="flex h-7 w-7 items-center justify-center self-center rounded-lg bg-slate-100 text-slate-500">
          <TrendingUp size={15} strokeWidth={2} />
        </span>
        <h3 className="text-sm font-semibold text-slate-600">
          7-Day Trend Summary
        </h3>
        <p className="text-xs text-slate-400">vs previous 7 records</p>
      </div>

      {status === "loading" && (
        <div className="skeleton-shimmer mt-3 h-24 rounded-xl" />
      )}

      {status === "error" && (
        <EmptyState icon={TrendingUp} title="Couldn't load data" />
      )}

      {status === "ready" && (!intake || !cutting) && (
        <EmptyState
          icon={TrendingUp}
          title="Not enough history to compare."
          description="The trend appears once at least 4 recorded days exist in each period."
        />
      )}

      {status === "ready" && intake && cutting && (
        <div className="mt-2">
          <TrendRow label="Avg Intake" line={intake} />
          <TrendRow label="Avg Cutting" line={cutting} />
        </div>
      )}
    </section>
  );
}
