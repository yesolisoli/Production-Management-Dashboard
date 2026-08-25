"use client";

import clsx from "clsx";
import { Table } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { todayString } from "@/lib/date";
import {
  staffingCellLabel,
  type ComparisonRow,
} from "../daily-comparison";
import { formatDateLabel } from "../format";
import type { DailyComparisonOverview } from "../hooks/use-daily-comparison";

// Short = understaffed (existing amber semantics from the Staffing card);
// over is neutral. A missing snapshot renders "—", never zero or "On target".
function StaffingCell({ staffing }: { staffing: ComparisonRow["staffing"] }) {
  if (!staffing) return <span className="text-slate-300">—</span>;
  const diff = staffing.assigned - staffing.target;
  return (
    <span
      className={clsx(
        "font-medium",
        diff < 0 ? "text-amber-700" : diff === 0 ? "text-emerald-700" : "text-slate-600",
      )}
    >
      {staffingCellLabel(staffing)}
    </span>
  );
}

// Exact values for the last recorded operational days — the numeric
// counterpart to Recent Hog Activity's visual trend.
export function DailyComparison({
  date,
  overview,
}: {
  date: string;
  overview: DailyComparisonOverview;
}) {
  const { status, rows } = overview;
  const isToday = date === todayString();

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="flex h-7 w-7 items-center justify-center self-center rounded-lg bg-slate-100 text-slate-500">
          <Table size={15} strokeWidth={2} />
        </span>
        <h3 className="text-sm font-semibold text-slate-600">
          Daily Comparison
        </h3>
        <p className="text-xs text-slate-400">Last recorded days, exact values</p>
      </div>

      {status === "loading" && (
        <div className="skeleton-shimmer mt-3 h-40 rounded-xl" />
      )}

      {status === "error" && (
        <EmptyState icon={Table} title="Couldn't load data" />
      )}

      {status === "missing" && (
        <EmptyState
          icon={Table}
          title="No recorded days to compare yet"
          description="Rows appear as days are recorded on the Hog Intake page."
        />
      )}

      {status === "ready" && rows.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[430px] text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-3 text-left font-semibold">Date</th>
                <th className="px-3 py-1.5 text-right font-semibold">Intake</th>
                <th className="px-3 py-1.5 text-right font-semibold">
                  For Cutting
                </th>
                <th className="px-3 py-1.5 text-right font-semibold">
                  Staffing
                </th>
                <th className="py-1.5 pl-3 text-right font-semibold">
                  Primal Usage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const selected = row.date === date;
                return (
                  <tr key={row.date} className={clsx(selected && "bg-slate-50")}>
                    <td className="py-2 pr-3 text-left font-medium text-slate-700">
                      {formatDateLabel(row.date)}
                      {selected && (
                        <span className="ml-1.5 text-[11px] font-semibold uppercase text-slate-400">
                          {isToday ? "Today" : "Selected"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                      {row.totalHogs}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                      {row.forCutting}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <StaffingCell staffing={row.staffing} />
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-slate-800">
                      {row.primalPercent === null ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        `${row.primalPercent}%`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
