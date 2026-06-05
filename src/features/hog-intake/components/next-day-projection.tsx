"use client";

import clsx from "clsx";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt, projectedForCutting } from "../calculations";
import type { NextDay } from "../types";

type NextDayProjectionProps = {
  nextDay: NextDay;
  onChange: (
    field: "hog_count" | "side_orders" | "cooler_overstock",
    value: number,
  ) => void;
};

export function NextDayProjection({
  nextDay,
  onChange,
}: NextDayProjectionProps) {
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

      <dl className="divide-y divide-slate-100">
        <ProjectionField
          id="next-day-hogs"
          label="Next Day Hog Count"
          value={nextDay.hog_count}
          onChange={(v) => onChange("hog_count", v)}
        />
        <ProjectionField
          id="next-day-side"
          label="Next Day Side Orders"
          value={nextDay.side_orders}
          onChange={(v) => onChange("side_orders", v)}
        />
        <ProjectionField
          id="cooler-overstock"
          label="Cooler Overstock"
          value={nextDay.cooler_overstock}
          onChange={(v) => onChange("cooler_overstock", v)}
        />

        <div className="flex items-baseline justify-between py-2.5">
          <dt
            className={clsx(
              "text-sm",
              negative ? "text-red-700" : "text-slate-600",
            )}
          >
            Projected For Cutting (Tomorrow)
          </dt>
          <dd
            className={clsx(
              "text-lg font-bold tabular-nums",
              negative ? "text-red-700" : "text-slate-900",
            )}
          >
            {projected.toLocaleString()}
          </dd>
        </div>

      </dl>
    </section>
  );
}

type ProjectionFieldProps = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  onChange: (next: number) => void;
};

function ProjectionField({
  id,
  label,
  value,
  unit,
  onChange,
}: ProjectionFieldProps) {
  const blank = useBlankZeroInput(value);
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <label htmlFor={id} className="text-sm text-slate-600">
        {label}
      </label>
      <div className="flex items-baseline gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          {...blank}
          onChange={(e) => onChange(clampNonNegativeInt(e.target.value))}
          className="w-20 border-0 bg-transparent text-right text-lg font-bold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit ? (
          <span className="text-xs font-medium text-slate-400">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}
