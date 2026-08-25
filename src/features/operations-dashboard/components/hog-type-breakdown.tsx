"use client";

import { ArrowDown, ArrowUp, PieChart, TrendingDown, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { todayString } from "@/lib/date";
import { formatDateLabel } from "../format";
import {
  buildHogTypeBreakdown,
  findTopChange,
  type HogTypeBreakdownKey,
  type HogTypeBreakdownRow,
} from "../hog-type-breakdown";
import type { OverviewStatus } from "../hooks/use-operations-overview";
import type { RecentActivityDay } from "../hooks/use-recent-hog-activity";

// Fixed color per category (never reassigned by rank). Palette validated for
// CVD-safe adjacency around the donut — including the wrap-around pair — on a
// white surface; the list beside the chart direct-labels every slice, so the
// two sub-3:1-contrast hues never carry a value alone.
const SERIES_COLORS: Record<HogTypeBreakdownKey, string> = {
  JP: "#2a78d6",
  RWA: "#eb6834",
  BK: "#1baf7a",
  Round: "#eda100",
  Others: "#e87ba4",
};

const DONUT_SIZE = 168;
const DONUT_STROKE = 28;
// 2px surface gap along the circumference between adjacent slices.
const SLICE_GAP = 2;

// Shared column template so the header labels align with the rows:
// dot | label | share bar | count | percent | change badge.
const ROW_GRID =
  "grid grid-cols-[0.625rem_3.25rem_1fr_2.5rem_4.5rem_4rem] items-center gap-x-2.5";

function Donut({ rows, total }: { rows: HogTypeBreakdownRow[]; total: number }) {
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const center = DONUT_SIZE / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = rows.filter((row) => row.count > 0);
  const gap = visible.length > 1 ? SLICE_GAP : 0;

  const slices: { row: HogTypeBreakdownRow; length: number; start: number }[] =
    [];
  let traversed = 0;
  for (const row of visible) {
    const arc = (row.count / total) * circumference;
    slices.push({
      row,
      length: Math.max(arc - gap, 1),
      start: traversed + gap / 2,
    });
    traversed += arc;
  }

  return (
    <svg
      width={DONUT_SIZE}
      height={DONUT_SIZE}
      role="img"
      aria-label={`Donut chart of hog types: ${visible
        .map((row) => `${row.label} ${row.count}`)
        .join(", ")}`}
      className="shrink-0"
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        {slices.map(({ row, length, start }) => (
          <circle
            key={row.key}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={SERIES_COLORS[row.key]}
            strokeWidth={DONUT_STROKE}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-start}
          />
        ))}
      </g>
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        fontSize={30}
        fontWeight={700}
        fill="#0f172a"
      >
        {total}
      </text>
      <text
        x={center}
        y={center + 18}
        textAnchor="middle"
        fontSize={12}
        fill="#64748b"
      >
        Total Hogs
      </text>
    </svg>
  );
}

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) {
    return (
      <span className="justify-self-end text-sm text-slate-400">—</span>
    );
  }
  if (diff === 0) {
    return (
      <span className="justify-self-end rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-500">
        0
      </span>
    );
  }
  const up = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 justify-self-end rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
        up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
    >
      {up ? (
        <ArrowUp size={11} strokeWidth={2.5} aria-label="up" />
      ) : (
        <ArrowDown size={11} strokeWidth={2.5} aria-label="down" />
      )}
      {Math.abs(diff)}
    </span>
  );
}

// Composition of the selected day's hog intake by type, with head-count change
// vs the most recent recorded day before it. Purely presentational: rows come
// from buildHogTypeBreakdown over data the client already loaded via
// useRecentHogActivity — no fetch of its own.
export function HogTypeBreakdown({
  date,
  days,
  status,
}: {
  date: string;
  days: RecentActivityDay[];
  status: OverviewStatus;
}) {
  const last = days[days.length - 1];
  const selected = last?.date === date ? last : undefined;
  const previous = selected ? days[days.length - 2] : undefined;

  const rows = selected
    ? buildHogTypeBreakdown(selected.hogCounts, previous?.hogCounts ?? null)
    : [];
  const total = selected?.totalHogs ?? 0;
  const previousLabel = previous ? formatDateLabel(previous.date) : null;
  const topChange = findTopChange(rows);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <PieChart size={15} strokeWidth={2} />
        </span>
        <h3 className="text-sm font-semibold text-slate-600">
          Hog Type Breakdown
        </h3>
        {topChange?.diff != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
            {topChange.diff > 0 ? (
              <TrendingUp size={12} strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <TrendingDown size={12} strokeWidth={2.5} aria-hidden="true" />
            )}
            {topChange.label} {topChange.diff > 0 ? "↑" : "↓"}
            {Math.abs(topChange.diff)} largest change
          </span>
        )}
        <p className="text-xs text-slate-400">Intake composition by type</p>
      </div>

      {status === "loading" && (
        <div className="skeleton-shimmer mt-3 h-40 rounded-xl" />
      )}

      {status === "error" && (
        <EmptyState icon={PieChart} title="Couldn't load data" />
      )}

      {status === "ready" && !selected && (
        <EmptyState
          icon={PieChart}
          title="No intake record for this day."
          description="The breakdown fills in once the day is recorded on the Hog Intake page."
        />
      )}

      {status === "ready" && selected && total === 0 && (
        <EmptyState
          icon={PieChart}
          title="No hogs recorded for this day."
        />
      )}

      {status === "ready" && selected && total > 0 && (
        <>
          <div className="mt-3 flex flex-1 flex-col items-center gap-x-6 gap-y-3 sm:flex-row">
            <Donut rows={rows} total={total} />
            <div className="w-full min-w-0 flex-1">
              <div
                className={`${ROW_GRID} border-b border-slate-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400`}
              >
                <span className="col-span-3" />
                <span className="text-right">
                  {date === todayString() ? "Today" : formatDateLabel(date)}
                </span>
                <span className="whitespace-nowrap text-right">
                  % of Total
                </span>
                <span className="whitespace-nowrap text-right">
                  {previousLabel ? `vs ${previousLabel}` : ""}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <li key={row.key} className={`${ROW_GRID} py-2`}>
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SERIES_COLORS[row.key] }}
                    />
                    <span className="truncate text-sm font-medium text-slate-700">
                      {row.label}
                    </span>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${row.percent}%`,
                          minWidth: row.count > 0 ? "0.5rem" : 0,
                          backgroundColor: SERIES_COLORS[row.key],
                        }}
                      />
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums text-slate-800">
                      {row.count}
                    </span>
                    <span className="text-right text-sm tabular-nums text-slate-500">
                      {row.percent}%
                    </span>
                    <DiffBadge diff={row.diff} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <TrendingUp size={15} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <p className="min-w-0 text-sm text-slate-600">
              {previousLabel === null ? (
                "No previous intake record to compare."
              ) : topChange?.diff == null ? (
                `No major type changes from ${previousLabel}.`
              ) : (
                <>
                  <span className="font-semibold text-slate-700">
                    Top Change:
                  </span>{" "}
                  {topChange.label}{" "}
                  {topChange.diff > 0
                    ? `+${topChange.diff}`
                    : `${topChange.diff}`}{" "}
                  head vs {previousLabel}
                </>
              )}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
