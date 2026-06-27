"use client";

import { Info, Printer } from "lucide-react";
import {
  buildRoutePrinting,
  formatDiff,
  fromTimeInputValue,
  type RoutePrintStatus,
} from "../route-printing";
import { TimeInput } from "./time-input";

// Route Printing Schedule — merges the operator-entered printed times with the
// weekday deadline reference (route-printing.ts). The deadline, difference and
// status are fully DERIVED; the only input is the printed time per route, which
// is owned by the parent state hook (persisted in the draft). Presentation only.
type RoutePrintingSectionProps = {
  date: string; // "YYYY-MM-DD" — the planner's selected day
  prints: Record<string, string>; // route number → entered printed time
  notes: Record<string, string>; // route number → entered free-text note
  onSetRoutePrint: (route: string, time: string) => void;
  onSetRouteNote: (route: string, note: string) => void;
};

// Per-status badge styling, mirroring the sheet's status legend.
const STATUS_BADGE: Record<
  RoutePrintStatus,
  { label: string; dot: string; chip: string }
> = {
  on_time: {
    label: "On Time",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
  },
  late: {
    label: "Late",
    dot: "bg-red-500",
    chip: "bg-red-50 text-red-600",
  },
  not_printed: {
    label: "Not Printed",
    dot: "bg-slate-300",
    chip: "bg-slate-100 text-slate-500",
  },
};

// One item in the status-guide / summary legend.
function LegendItem({
  dot,
  label,
  hint,
}: {
  dot: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="leading-tight">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className="ml-1.5 text-[11px] text-slate-400">{hint}</span>
      </div>
    </div>
  );
}

const emptyCell = <span className="text-slate-300">—</span>;

export function RoutePrintingSection({
  date,
  prints,
  notes,
  onSetRoutePrint,
  onSetRouteNote,
}: RoutePrintingSectionProps) {
  const { rows } = buildRoutePrinting(date, prints, notes);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Printer size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Route Printing Schedule
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Enter each route&apos;s printed time — status derives from the
              weekday deadline.
            </p>
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center sm:py-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Printer size={20} />
          </span>
          <p className="text-sm font-semibold text-slate-600">
            No printing schedule for this day
          </p>
          <p className="max-w-md text-xs text-slate-400">
            Route deadlines are set Monday through Friday. Pick a weekday to see
            its schedule.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto p-4 sm:p-5">
            <table className="w-full min-w-225 table-fixed text-sm">
              <colgroup>
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[35%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400 [&>th]:border-b [&>th]:border-slate-200 [&>th]:px-3 [&>th]:pb-2">
                  <th>Route</th>
                  <th>Deadline</th>
                  <th>Time Printed</th>
                  <th>Difference</th>
                  <th>
                    <span className="group relative inline-flex items-center gap-1 border-b border-dotted border-slate-300">
                      Status
                      <Info size={11} className="text-slate-400" />
                      {/* Hover legend — the three states, revealed on hover. */}
                      <div className="invisible absolute left-0 top-full z-20 mt-2 w-max rounded-xl border border-slate-200 bg-white p-3 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                        <div className="flex flex-col gap-2 normal-case">
                          <LegendItem
                            dot={STATUS_BADGE.on_time.dot}
                            label="On Time"
                            hint="on or before deadline"
                          />
                          <LegendItem
                            dot={STATUS_BADGE.late.dot}
                            label="Late"
                            hint="after deadline"
                          />
                          <LegendItem
                            dot={STATUS_BADGE.not_printed.dot}
                            label="Not Printed"
                            hint="not printed yet"
                          />
                        </div>
                      </div>
                    </span>
                  </th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const badge = STATUS_BADGE[row.status];
                  return (
                    <tr
                      key={row.route}
                      className="[&>td]:border-b [&>td]:border-slate-100 [&>td]:px-3 [&>td]:py-3"
                    >
                      <td className="font-semibold tabular-nums text-slate-900">
                        {row.route}
                      </td>
                      <td className="tabular-nums text-slate-600">
                        {fromTimeInputValue(row.deadline)}
                      </td>
                      <td>
                        <TimeInput
                          value={prints[String(row.route)] ?? ""}
                          onChange={(v) =>
                            onSetRoutePrint(
                              String(row.route),
                              fromTimeInputValue(v),
                            )
                          }
                          ariaLabel={`Route ${row.route} time printed`}
                          className="h-9 w-32"
                        />
                      </td>
                      <td>
                        {row.diffMinutes === null ? (
                          emptyCell
                        ) : (
                          <span
                            className={`font-semibold tabular-nums ${
                              row.diffMinutes > 0
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {formatDiff(row.diffMinutes)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${badge.chip}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
                          />
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={notes[String(row.route)] ?? ""}
                          onChange={(e) =>
                            onSetRouteNote(String(row.route), e.target.value)
                          }
                          placeholder="Add note…"
                          aria-label={`Route ${row.route} note`}
                          className="h-9 w-full min-w-40 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
