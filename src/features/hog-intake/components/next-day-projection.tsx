"use client";

import clsx from "clsx";
import { CalendarPlus } from "lucide-react";
import { projectedForCutting } from "../calculations";
import { NumberStepper } from "./number-stepper";
import type { NextDay } from "../types";

type NextDayField = "hog_count" | "side_orders" | "cooler_overstock";

type NextDayProjectionProps = {
  nextDay: NextDay;
  onChange: (field: NextDayField, value: number) => void;
};

const FIELDS: { key: NextDayField; label: string }[] = [
  { key: "hog_count", label: "Next Day Hog Count" },
  { key: "side_orders", label: "Next Day Side Orders" },
  { key: "cooler_overstock", label: "Cooler Overstock" },
];

// Next Day Projection embedded at the bottom of the Weekly Hog Plan box on the
// Hog Intake page (no own card wrapper). Values are stored on the hog_intake
// row. Styled like the Farm Delivery Records footer summary — flat
// label-over-value stats laid out as a right-aligned equation.
export function NextDayProjection({ nextDay, onChange }: NextDayProjectionProps) {
  const projected = projectedForCutting(nextDay);
  const negative = projected < 0;

  return (
    <div className="-mx-4 -mb-4 mt-4 rounded-b-2xl border-t border-slate-200 bg-slate-50/70 px-4 pb-4 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <CalendarPlus size={16} />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Next Day Projection
          </h3>
          <p className="text-xs text-slate-500">
            Plan tomorrow&apos;s intake and orders
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-start gap-x-6 gap-y-4">
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {field.label}
            </span>
            <div className="mt-1 w-36">
              <NumberStepper
                ariaLabel={field.label}
                value={nextDay[field.key]}
                onChange={(v) => onChange(field.key, v)}
              />
            </div>
          </div>
        ))}

        <div className="flex h-8 items-center">
          <span className="text-lg font-light leading-none text-slate-300">
            =
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span
            className={clsx(
              "text-[11px] font-semibold uppercase tracking-wider",
              negative ? "text-red-500" : "text-slate-400",
            )}
          >
            Next day Projected For Cutting
          </span>
          <div className="mt-1 flex h-8 items-center">
            <span
              className={clsx(
                "text-lg font-bold leading-none tabular-nums",
                negative ? "text-red-700" : "text-slate-900",
              )}
            >
              {projected.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
