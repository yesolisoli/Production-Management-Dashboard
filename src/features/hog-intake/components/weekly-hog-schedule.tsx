"use client";

// Read-only reference panel showing the week's planned Cut/Kill market
// counts. Days run across as columns; the two metrics are rows. Sales uses
// this to forecast next-day production volume. Data is static for now —
// wire it to a weekly source (keyed by week start) when the schedule
// becomes editable/persisted.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

type ScheduleRow = {
  label: string;
  values: Record<(typeof DAYS)[number], number>;
};

const SCHEDULE_ROWS: ScheduleRow[] = [
  {
    label: "Cut - Markets",
    values: { Mon: 300, Tue: 365, Wed: 340, Thu: 365, Fri: 365 },
  },
  {
    label: "Kill - Markets",
    values: { Mon: 392, Tue: 360, Wed: 392, Thu: 392, Fri: 332 },
  },
];

export function WeeklyHogSchedule() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Weekly Hog Schedule
        </h3>
        <p className="text-xs text-slate-500">
          Planned market counts by day — for next-day production forecasting
        </p>
      </div>

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
            {SCHEDULE_ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={i > 0 ? "border-t border-slate-100" : undefined}
              >
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-slate-700">
                  {row.label}
                </th>
                {DAYS.map((day) => (
                  <td
                    key={day}
                    className="px-4 py-2.5 text-center font-bold tabular-nums text-slate-900"
                  >
                    {row.values[day].toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
