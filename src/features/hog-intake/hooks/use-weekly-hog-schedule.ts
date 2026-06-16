"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// The Weekly Hog Plan only carries Mon–Fri. Days run across as table columns.
export const WEEKLY_PLAN_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export type WeeklyPlanDay = (typeof WEEKLY_PLAN_DAYS)[number];

// Stable identity for each weekly plan row. Business logic (the sow roll-up and
// the next-day Cut count) and persistence key off these ids, never the display
// labels — so a label can be renamed without breaking calculations or
// shadowing saved data.
export type WeeklyPlanRowId =
  | "cut-markets"
  | "kill-markets"
  | "jp-sows"
  | "adaca-sows"
  | "custom-rh"
  | "custom-market"
  | "custom-sow";

export type ScheduleRow = {
  id: WeeklyPlanRowId;
  label: string;
  description: string;
  values: Record<WeeklyPlanDay, number>;
};

const STORAGE_KEY = "hog-intake.weekly-schedule";

// Row whose Cut count seeds the Next Day Hog Count (see weekly-hog-schedule.tsx).
export const CUT_ROW_ID: WeeklyPlanRowId = "cut-markets";

// Plan rows whose weekly totals roll up into Sow "Available This Week".
const SOW_PLAN_IDS: readonly WeeklyPlanRowId[] = [
  "jp-sows",
  "adaca-sows",
  "custom-sow",
];
const SOW_PLAN_ID_SET = new Set<string>(SOW_PLAN_IDS);

const DEFAULT_ROWS: ScheduleRow[] = [
  {
    id: "cut-markets",
    label: "Cut - Markets",
    description: "Hogs planned for cutting",
    values: { Mon: 300, Tue: 365, Wed: 340, Thu: 365, Fri: 365 },
  },
  {
    id: "kill-markets",
    label: "Kill - Markets",
    description: "Hogs planned for slaughter",
    values: { Mon: 392, Tue: 360, Wed: 392, Thu: 392, Fri: 332 },
  },
  {
    id: "jp-sows",
    label: "JP Sows",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
  {
    id: "adaca-sows",
    label: "ADACA Sows",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
  {
    id: "custom-rh",
    label: "Custom RH",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
  {
    id: "custom-market",
    label: "Custom Market",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
  {
    id: "custom-sow",
    label: "Custom Sow",
    description: "Hogs planned",
    values: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
  },
];

function cloneDefaultRows(): ScheduleRow[] {
  return DEFAULT_ROWS.map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    values: { ...row.values },
  }));
}

// Merge a stored payload onto the default shape so a partial/corrupt value
// still loads with sane fallbacks, keyed by the fixed row ids. Payloads written
// before ids existed were keyed by the display label, so each row also falls
// back to its label key — old saved data migrates transparently and is rewritten
// id-keyed on the next edit.
function coerceRows(raw: unknown): ScheduleRow[] {
  const rows = cloneDefaultRows();
  if (!raw || typeof raw !== "object") return rows;
  const stored = raw as Record<string, unknown>;
  for (const row of rows) {
    const savedValues = stored[row.id] ?? stored[row.label];
    if (!savedValues || typeof savedValues !== "object") continue;
    const values = savedValues as Record<string, unknown>;
    for (const day of WEEKLY_PLAN_DAYS) {
      const v = values[day];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        row.values[day] = v;
      }
    }
  }
  return rows;
}

// Sum of every weekday value across the Sow plan rows (JP / ADACA / Custom
// Sows) — the weekly planned-sow contribution to "Available This Week".
function weeklySowPlanTotal(rows: ScheduleRow[]): number {
  let total = 0;
  for (const row of rows) {
    if (!SOW_PLAN_ID_SET.has(row.id)) continue;
    for (const day of WEEKLY_PLAN_DAYS) total += row.values[day];
  }
  return total;
}

// Single source of truth for the Weekly Hog Plan grid. Owns the persisted rows
// (localStorage, so they survive refresh) and exposes the derived weekly sow
// total that feeds Sow "Available This Week". Lifted to the page so both the
// grid and the Sow card read the same rows — no parallel copies.
export function useWeeklyHogSchedule() {
  const [rows, setRows] = useState<ScheduleRow[]>(cloneDefaultRows);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // One-shot hydration from localStorage after mount (SSR-safe) — not a
      // render-driven sync, so the cascading-render concern doesn't apply.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setRows(coerceRows(JSON.parse(raw)));
    } catch {
      // ignore parse / access errors — fall back to defaults
    }
  }, []);

  const updateValue = useCallback(
    (rowIndex: number, day: WeeklyPlanDay, value: number) => {
      setRows((prev) => {
        const next = prev.map((row, i) =>
          i === rowIndex
            ? { ...row, values: { ...row.values, [day]: value } }
            : row,
        );
        try {
          const payload = Object.fromEntries(
            next.map((row) => [row.id, row.values]),
          );
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // ignore quota / access errors
        }
        return next;
      });
    },
    [],
  );

  const sowPlanTotal = useMemo(() => weeklySowPlanTotal(rows), [rows]);

  return { rows, updateValue, sowPlanTotal };
}
