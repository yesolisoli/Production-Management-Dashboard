"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NextDayProjection } from "./next-day-projection";
import type { NextDay } from "../types";

type EditableNextDayField = "side_orders" | "cooler_overstock";

// Editable reference panel showing the week's planned Cut/Kill market
// counts. Days run across as columns; the two metrics are rows. Sales uses
// this to forecast next-day production volume. These values are a standalone
// note — they are NOT linked to intake/production figures. Edits persist to
// localStorage so they survive a refresh.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

type Day = (typeof DAYS)[number];

type ScheduleRow = {
  label: string;
  description: string;
  values: Record<Day, number>;
};

const STORAGE_KEY = "hog-intake.weekly-schedule";
const COLLAPSED_KEY = "hog-intake.weekly-schedule.collapsed";

// Row the Next Day Hog Count is sourced from.
const CUT_ROW_LABEL = "Cut - Markets";

// The Weekly Hog Plan only carries Mon–Fri. Given the selected intake date,
// return the plan day for the following business day (Fri/Sat/Sun → Mon).
const NEXT_PLAN_DAY: Record<number, Day> = {
  0: "Mon", // Sun → Mon
  1: "Tue", // Mon → Tue
  2: "Wed", // Tue → Wed
  3: "Thu", // Wed → Thu
  4: "Fri", // Thu → Fri
  5: "Mon", // Fri → Mon
  6: "Mon", // Sat → Mon
};

// How many leading weekday columns are "before today" and therefore locked,
// keyed by today's getDay() (0=Sun … 6=Sat). Mon locks none; Fri locks Mon–Thu;
// Sat locks the whole week; Sun (week not yet started) locks none.
const LOCKED_BEFORE_BY_DOW: Record<number, number> = {
  0: 0, // Sun
  1: 0, // Mon
  2: 1, // Tue → Mon locked
  3: 2, // Wed → Mon, Tue locked
  4: 3, // Thu → Mon–Wed locked
  5: 4, // Fri → Mon–Thu locked
  6: 5, // Sat → all locked
};

function nextPlanDay(dateStr: string): Day | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  // Construct in local time so the weekday isn't shifted by the UTC offset.
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return NEXT_PLAN_DAY[date.getDay()] ?? null;
}

const DEFAULT_ROWS: ScheduleRow[] = [
  {
    label: "Cut - Markets",
    description: "Hogs planned for cutting",
    values: { Mon: 300, Tue: 365, Wed: 340, Thu: 365, Fri: 365 },
  },
  {
    label: "Kill - Markets",
    description: "Hogs planned for slaughter",
    values: { Mon: 392, Tue: 360, Wed: 392, Thu: 392, Fri: 332 },
  },
  {
    label: "JP Sows",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
  {
    label: "ADACA Sows",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
  {
    label: "Custom RH",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
  {
    label: "Custom Market",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
  {
    label: "Custom Sow",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
];

function cloneDefaultRows(): ScheduleRow[] {
  return DEFAULT_ROWS.map((row) => ({
    label: row.label,
    description: row.description,
    values: { ...row.values },
  }));
}

// Merge a stored payload onto the default shape so a partial/corrupt value
// still loads with sane fallbacks, keyed by the fixed row labels.
function coerceRows(raw: unknown): ScheduleRow[] {
  const rows = cloneDefaultRows();
  if (!raw || typeof raw !== "object") return rows;
  const stored = raw as Record<string, unknown>;
  for (const row of rows) {
    const savedValues = stored[row.label];
    if (!savedValues || typeof savedValues !== "object") continue;
    const values = savedValues as Record<string, unknown>;
    for (const day of DAYS) {
      const v = values[day];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        row.values[day] = v;
      }
    }
  }
  return rows;
}

type WeeklyHogScheduleProps = {
  date: string; // selected intake date, YYYY-MM-DD
  nextDay: NextDay;
  onNextDayChange: (field: EditableNextDayField, value: number) => void;
};

export function WeeklyHogSchedule({
  date,
  nextDay,
  onNextDayChange,
}: WeeklyHogScheduleProps) {
  const [rows, setRows] = useState<ScheduleRow[]>(cloneDefaultRows);
  const [collapsed, setCollapsed] = useState(true);
  // Number of leading weekday columns to lock (days before today). Computed
  // after mount from the real clock so it never causes an SSR hydration
  // mismatch — every column is editable on the server's first render.
  const [lockedBefore, setLockedBefore] = useState(0);

  // Next Day Hog Count = the Cut - Markets plan for the day after the selected
  // intake date. Derived, never stored — re-computed from the plan + date.
  const nextDayHogCount = useMemo(() => {
    const day = nextPlanDay(date);
    if (!day) return 0;
    const cutRow = rows.find((row) => row.label === CUT_ROW_LABEL);
    return cutRow?.values[day] ?? 0;
  }, [rows, date]);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setRows(coerceRows(JSON.parse(raw)));
      // Default to collapsed; only honor an explicitly stored preference.
      const storedCollapsed = window.localStorage.getItem(COLLAPSED_KEY);
      if (storedCollapsed !== null) setCollapsed(storedCollapsed === "true");
    } catch {
      // ignore parse / access errors — fall back to defaults
    }
    setLockedBefore(LOCKED_BEFORE_BY_DOW[new Date().getDay()] ?? 0);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // ignore quota / access errors
      }
      return next;
    });
  }

  function updateValue(rowIndex: number, day: Day, value: number) {
    setRows((prev) => {
      const next = prev.map((row, i) =>
        i === rowIndex
          ? { ...row, values: { ...row.values, [day]: value } }
          : row,
      );
      try {
        const payload = Object.fromEntries(
          next.map((row) => [row.label, row.values]),
        );
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore quota / access errors
      }
      return next;
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className={`flex w-full items-start justify-between gap-3 text-left ${collapsed ? "" : "mb-4"}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <CalendarDays size={16} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Weekly Hog Plan
            </h3>
            <p className="text-xs text-slate-500">
              Reference counts for weekly planning
            </p>
          </div>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {!collapsed && (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500" />
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={i > 0 ? "border-t border-slate-100" : undefined}
              >
                <th className="whitespace-nowrap px-4 py-2.5 text-left">
                  <span className="block font-semibold text-slate-700">
                    {row.label}
                  </span>
                  <span className="block text-xs font-normal text-slate-400">
                    {row.description}
                  </span>
                </th>
                {DAYS.map((day, dayIndex) => {
                  // Days before today are read-only — past plan figures are locked.
                  const locked = dayIndex < lockedBefore;
                  return (
                    <td key={day} className="px-2 py-1.5 text-center">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={row.values[day]}
                        readOnly={locked}
                        disabled={locked}
                        onChange={(e) =>
                          updateValue(
                            i,
                            day,
                            Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          )
                        }
                        className={
                          locked
                            ? "w-20 cursor-not-allowed appearance-none rounded-md border border-transparent bg-transparent px-2 py-1 text-center font-bold tabular-nums text-slate-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                            : "w-20 appearance-none rounded-md border border-transparent bg-transparent px-2 py-1 text-center font-bold tabular-nums text-slate-900 hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {!collapsed && (
        <NextDayProjection
          nextDay={nextDay}
          hogCount={nextDayHogCount}
          onChange={onNextDayChange}
        />
      )}
    </section>
  );
}
