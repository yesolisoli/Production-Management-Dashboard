"use client";

import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Gauge,
  Info,
  Package,
  PieChart,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateLabel } from "../format";
import type { PrimalUsageOverview } from "../hooks/use-primal-usage";

// Neutral accent — the app's blue, matching the Recent Hog Activity intake
// line. Deliberately NOT a status color: there is no business rule saying a
// high or low usage is good or bad.
const GAUGE_COLOR = "#2563eb";
const TRACK_COLOR = "#e2e8f0";

const GAUGE_WIDTH = 200;
const GAUGE_STROKE = 20;
// Room for the knob to overhang the arc at either end.
const GAUGE_PAD = 10;
const KNOB_RADIUS = GAUGE_STROKE / 2 + 4;

// Semicircle gauge with a knob marking the current position. The arc and knob
// cap at 100% (a "Short" day can exceed it — the text shows the real figure).
function UsageGauge({ percent }: { percent: number }) {
  const radius = (GAUGE_WIDTH - GAUGE_STROKE) / 2;
  const cx = GAUGE_PAD + GAUGE_WIDTH / 2;
  const cy = GAUGE_WIDTH / 2;
  const semicircle = Math.PI * radius;
  const height = cy + KNOB_RADIUS + 8;
  const capped = Math.min(Math.max(percent, 0), 100) / 100;
  const filled = capped * semicircle;

  const arc = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${
    cx + radius
  } ${cy}`;
  // Arc runs from 180° (left) to 0° (right); the knob sits at the filled end.
  const knobAngle = Math.PI * (1 - capped);
  const knobX = cx + radius * Math.cos(knobAngle);
  const knobY = cy - radius * Math.sin(knobAngle);

  return (
    <svg
      width={GAUGE_WIDTH + GAUGE_PAD * 2}
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
      {filled > 0 && (
        <path
          d={arc}
          fill="none"
          stroke={GAUGE_COLOR}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${semicircle}`}
        />
      )}
      <circle
        cx={knobX}
        cy={knobY}
        r={KNOB_RADIUS}
        fill={GAUGE_COLOR}
        stroke="#ffffff"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fontSize={32}
        fontWeight={700}
        fill="#0f172a"
      >
        {percent}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={12} fill="#64748b">
        of supply committed
      </text>
    </svg>
  );
}

function formatPieces(value: number): string {
  return value.toLocaleString("en-US");
}

// One-line reading of the day's usage for the callout under the gauge.
function usageCallout(usage: {
  committed: number;
  remaining: number;
}): { title: string; detail: string } {
  if (usage.committed === 0) {
    return {
      title: "All primals are currently uncommitted",
      detail: `You have ${formatPieces(usage.remaining)} pcs remaining`,
    };
  }
  if (usage.remaining < 0) {
    return {
      title: "Commitments exceed supply",
      detail: `Short ${formatPieces(Math.abs(usage.remaining))} pcs`,
    };
  }
  if (usage.remaining === 0) {
    return {
      title: "All supply is committed",
      detail: "0 pcs remaining",
    };
  }
  return {
    title: `${formatPieces(usage.committed)} pcs committed`,
    detail: `You have ${formatPieces(usage.remaining)} pcs remaining`,
  };
}

const STAT_TILES = [
  {
    key: "totalSupply",
    label: "Total Supply",
    icon: Package,
    chip: "bg-blue-50 text-blue-600",
  },
  {
    key: "committed",
    label: "Committed",
    icon: ClipboardList,
    chip: "bg-amber-50 text-amber-600",
  },
  {
    key: "remaining",
    label: "Remaining",
    icon: PieChart,
    chip: "bg-emerald-50 text-emerald-600",
  },
] as const;

function ComparisonFooter({
  comparison,
}: {
  comparison: PrimalUsageOverview["comparison"];
}) {
  if (!comparison) {
    return (
      <p className="text-sm text-slate-400">
        No previous primal record to compare.
      </p>
    );
  }
  const label = formatDateLabel(comparison.date);
  const delta = comparison.deltaPoints;
  if (delta === 0) {
    return (
      <p className="text-sm text-slate-500">No change vs {label}.</p>
    );
  }
  const up = delta > 0;
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        }`}
      >
        {up ? (
          <ArrowUp size={15} strokeWidth={2.5} aria-label="up" />
        ) : (
          <ArrowDown size={15} strokeWidth={2.5} aria-label="down" />
        )}
      </span>
      <p className="text-sm">
        <span
          className={`font-bold tabular-nums ${
            up ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {Math.abs(delta)} pts
        </span>{" "}
        <span className="text-slate-500">vs {label}</span>
      </p>
    </div>
  );
}

// Share of the day's total primal supply (expected production + opening stock
// + incoming allocations) already committed across orders and allocations —
// read from the Primal page's persisted Ending Stock. Presentational only;
// figures come from use-primal-usage.
export function PrimalUsage({ overview }: { overview: PrimalUsageOverview }) {
  const { status, usage, comparison } = overview;
  const callout = usage ? usageCallout(usage) : null;

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

      {status === "ready" && usage && callout && (
        <>
          <div className="mt-3 flex flex-1 flex-col gap-x-5 gap-y-4 sm:flex-row sm:items-center">
            <div className="flex w-full flex-col items-center gap-3 sm:w-60">
              <UsageGauge percent={usage.percent} />
              <div className="flex w-full items-start gap-2.5 rounded-xl bg-blue-50/60 px-3 py-2.5">
                <Info
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-blue-600"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700">
                    {callout.title}
                  </p>
                  <p className="text-xs text-slate-500">{callout.detail}</p>
                </div>
              </div>
            </div>
            <div className="hidden w-px self-stretch bg-slate-100 sm:block" />
            <div className="flex w-full min-w-0 flex-1 flex-col gap-2.5">
              {STAT_TILES.map((tile) => (
                <div
                  key={tile.key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tile.chip}`}
                  >
                    <tile.icon size={17} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="truncate text-sm font-medium text-slate-700">
                    {tile.label}
                  </span>
                  <span className="ml-auto whitespace-nowrap text-lg font-bold tabular-nums text-slate-900">
                    {formatPieces(usage[tile.key])}
                    <span className="ml-1 text-sm font-normal text-slate-400">
                      pcs
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <ComparisonFooter comparison={comparison} />
          </div>
        </>
      )}
    </section>
  );
}
