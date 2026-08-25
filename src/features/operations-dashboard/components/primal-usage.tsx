"use client";

import { Gauge } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateLabel } from "../format";
import type { PrimalUsageOverview } from "../hooks/use-primal-usage";

// Neutral accent — the app's blue, matching the Recent Hog Activity intake
// line. Deliberately NOT a status color: there is no business rule saying a
// high or low usage is good or bad.
const GAUGE_COLOR = "#2563eb";
const TRACK_COLOR = "#e2e8f0";

const GAUGE_WIDTH = 168;
const GAUGE_STROKE = 16;

// Semicircle gauge. The arc caps at 100% (a "Short" day can exceed it — the
// text shows the real figure).
function UsageGauge({ percent }: { percent: number }) {
  const radius = (GAUGE_WIDTH - GAUGE_STROKE) / 2;
  const cx = GAUGE_WIDTH / 2;
  const cy = GAUGE_WIDTH / 2;
  const semicircle = Math.PI * radius;
  const height = cy + 26;
  const filled = (Math.min(Math.max(percent, 0), 100) / 100) * semicircle;

  const arc = `M ${GAUGE_STROKE / 2} ${cy} A ${radius} ${radius} 0 0 1 ${
    GAUGE_WIDTH - GAUGE_STROKE / 2
  } ${cy}`;

  return (
    <svg
      width={GAUGE_WIDTH}
      height={height}
      role="img"
      aria-label={`Primal usage ${percent}%`}
      className="shrink-0"
    >
      <path
        d={arc}
        fill="none"
        stroke={TRACK_COLOR}
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="round"
      />
      <path
        d={arc}
        fill="none"
        stroke={GAUGE_COLOR}
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${semicircle}`}
      />
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize={30}
        fontWeight={700}
        fill="#0f172a"
      >
        {percent}%
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={12} fill="#64748b">
        of supply committed
      </text>
    </svg>
  );
}

function formatPieces(value: number): string {
  return value.toLocaleString("en-US");
}

function comparisonSentence(
  comparison: PrimalUsageOverview["comparison"],
): string {
  if (!comparison) return "No previous primal record to compare.";
  const label = formatDateLabel(comparison.date);
  if (comparison.deltaPoints === 0) return `No change vs ${label}.`;
  const arrow = comparison.deltaPoints > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(comparison.deltaPoints)} pts vs ${label}`;
}

// Share of the day's total primal supply (expected production + opening stock
// + incoming allocations) already committed across orders and allocations —
// read from the Primal page's persisted Ending Stock. Presentational only;
// figures come from use-primal-usage.
export function PrimalUsage({ overview }: { overview: PrimalUsageOverview }) {
  const { status, usage, comparison } = overview;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="flex h-7 w-7 items-center justify-center self-center rounded-lg bg-slate-100 text-slate-500">
          <Gauge size={15} strokeWidth={2} />
        </span>
        <h3 className="text-sm font-semibold text-slate-600">Primal Usage</h3>
        <p className="text-xs text-slate-400">
          Committed share of primal supply
        </p>
      </div>

      {status === "loading" && (
        <div className="skeleton-shimmer mt-3 h-36 rounded-xl" />
      )}

      {status === "error" && (
        <EmptyState icon={Gauge} title="Couldn't load data" />
      )}

      {(status === "missing" || (status === "ready" && !usage)) && (
        <EmptyState
          icon={Gauge}
          title="No primal data for this day."
          description="Usage appears once the day's Primal Calculation is saved."
        />
      )}

      {status === "ready" && usage && (
        <>
          <div className="mt-3 flex flex-1 flex-col items-center gap-x-6 gap-y-3 sm:flex-row">
            <UsageGauge percent={usage.percent} />
            <dl className="w-full min-w-0 flex-1">
              {[
                { label: "Total Supply", value: usage.totalSupply },
                { label: "Committed", value: usage.committed },
                { label: "Remaining", value: usage.remaining },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0"
                >
                  <dt className="text-sm font-medium text-slate-600">
                    {row.label}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums text-slate-800">
                    {formatPieces(row.value)}
                    <span className="ml-1 font-normal text-slate-400">pcs</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2.5 text-sm font-medium text-slate-600">
            {comparisonSentence(comparison)}
          </p>
        </>
      )}
    </section>
  );
}
