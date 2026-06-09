"use client";

import clsx from "clsx";
import { projectedForCutting } from "@/features/hog-intake/calculations";
import { NumberStepper } from "@/features/hog-intake/components/number-stepper";
import type { NextDay } from "@/features/hog-intake/types";

type NextDayField = "hog_count" | "side_orders" | "cooler_overstock";

type PrimalNextDayProjectionProps = {
  nextDay: NextDay;
  onChange: (field: NextDayField, value: number) => void;
};

const FIELDS: { key: NextDayField; label: string }[] = [
  { key: "hog_count", label: "Next Day Hog Count" },
  { key: "side_orders", label: "Next Day Side Orders" },
  { key: "cooler_overstock", label: "Cooler Overstock" },
];

// Full-width Next Day Projection entered on the Primal screen. The values are
// stored on the hog_intake row; edits debounce-persist via the primal hook.
export function PrimalNextDayProjection({
  nextDay,
  onChange,
}: PrimalNextDayProjectionProps) {
  const projected = projectedForCutting(nextDay);
  const negative = projected < 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Next Day Projection
        </h3>
        <p className="text-xs text-slate-500">Plan tomorrow&apos;s intake and orders</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
          >
            <span className="text-xs font-medium text-slate-500">
              {field.label}
            </span>
            <NumberStepper
              ariaLabel={field.label}
              value={nextDay[field.key]}
              onChange={(v) => onChange(field.key, v)}
            />
          </div>
        ))}

        <div
          className={clsx(
            "flex flex-col justify-between gap-1 rounded-xl border px-4 py-3",
            negative ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50",
          )}
        >
          <span
            className={clsx(
              "text-xs font-medium",
              negative ? "text-red-700" : "text-slate-500",
            )}
          >
            Projected For Cutting (Tomorrow)
          </span>
          <span
            className={clsx(
              "text-2xl font-bold tabular-nums",
              negative ? "text-red-700" : "text-slate-900",
            )}
          >
            {projected.toLocaleString()}
          </span>
        </div>
      </div>
    </section>
  );
}
