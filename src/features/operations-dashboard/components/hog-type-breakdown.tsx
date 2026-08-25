"use client";

import { PieChart } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { todayString } from "@/lib/date";
import { formatDateLabel } from "../format";
import {
  buildHogTypeBreakdown,
  buildTopChangeSentence,
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

const DONUT_SIZE = 156;
const DONUT_STROKE = 26;
// 2px surface gap along the circumference between adjacent slices.
const SLICE_GAP = 2;

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
        fontSize={26}
        fontWeight={700}
        fill="#0f172a"
      >
        {total}
      </text>
      <text
        x={center}
        y={center + 16}
        textAnchor="middle"
        fontSize={12}
        fill="#64748b"
      >
        Total
      </text>
    </svg>
  );
}

function diffLabel(diff: number | null): string {
  if (diff === null) return "—";
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
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

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="flex h-7 w-7 items-center justify-center self-center rounded-lg bg-slate-100 text-slate-500">
          <PieChart size={15} strokeWidth={2} />
        </span>
        <h3 className="text-sm font-semibold text-slate-600">
          Hog Type Breakdown
        </h3>
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
          <div className="mt-3 flex flex-1 flex-col items-center gap-x-5 gap-y-3 sm:flex-row">
            <Donut rows={rows} total={total} />
            <div className="w-full min-w-0 flex-1">
              <div className="grid grid-cols-[auto_1fr_auto_4rem] items-center gap-x-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span />
                <span />
                <span className="text-right">
                  {date === todayString() ? "Today" : formatDateLabel(date)}
                </span>
                <span className="whitespace-nowrap text-right">
                  {previousLabel ? `vs ${previousLabel}` : ""}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <li
                    key={row.key}
                    className="grid grid-cols-[auto_1fr_auto_4rem] items-center gap-x-2 py-1.5"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SERIES_COLORS[row.key] }}
                    />
                    <span className="truncate text-sm font-medium text-slate-700">
                      {row.label}
                    </span>
                    <span className="text-right text-sm tabular-nums text-slate-800">
                      {row.count}
                      <span className="text-slate-400"> ({row.percent}%)</span>
                    </span>
                    <span className="text-right text-sm tabular-nums text-slate-500">
                      {diffLabel(row.diff)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2.5 text-sm font-medium text-slate-600">
            {buildTopChangeSentence(rows, previousLabel)}
          </p>
        </>
      )}
    </section>
  );
}
