"use client";

import clsx from "clsx";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import {
  clampNonNegativeInt,
  expectedLoins,
  loinsAvailableTomorrow,
  projectedForCutting,
} from "../calculations";
import type { NextDay } from "../types";

type NextDayProjectionProps = {
  nextDay: NextDay;
  // Today's yield total (JP + RWA + BK) — drives expected loin production.
  yieldTotal: number;
  onChange: (
    field: "hog_count" | "side_orders" | "cooler_overstock",
    value: number,
  ) => void;
};

export function NextDayProjection({
  nextDay,
  yieldTotal,
  onChange,
}: NextDayProjectionProps) {
  const projected = projectedForCutting(nextDay);
  const negative = projected < 0;

  const expected = expectedLoins(yieldTotal);
  const available = loinsAvailableTomorrow(yieldTotal, nextDay.cooler_overstock);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Next Day Projection
        </h3>
        <p className="text-xs text-slate-500">Plan tomorrow&apos;s intake and orders</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <ProjectionField
          id="next-day-hogs"
          label="NEXT DAY HOG COUNT"
          value={nextDay.hog_count}
          onChange={(v) => onChange("hog_count", v)}
        />
        <ProjectionField
          id="next-day-side"
          label="NEXT DAY SIDE ORDERS"
          value={nextDay.side_orders}
          onChange={(v) => onChange("side_orders", v)}
        />
        <ProjectionField
          id="cooler-overstock"
          label="COOLER OVERSTOCK"
          unit="loins"
          value={nextDay.cooler_overstock}
          onChange={(v) => onChange("cooler_overstock", v)}
        />
      </div>

      <div
        className={clsx(
          "mt-3 rounded-xl border px-4 py-2.5",
          negative
            ? "border-red-200 bg-red-50"
            : "border-indigo-100 bg-indigo-50/60",
        )}
      >
        <p
          className={clsx(
            "text-xs font-medium",
            negative ? "text-red-700" : "text-slate-600",
          )}
        >
          Projected For Cutting (Tomorrow)
        </p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span
            className={clsx(
              "text-xl font-extrabold tabular-nums leading-none",
              negative ? "text-red-700" : "text-slate-900",
            )}
          >
            {projected.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-400">head</span>
        </p>
      </div>

      <div className="mt-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5">
        <p className="text-xs font-medium text-slate-600">
          Loins Available Tomorrow
        </p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold tabular-nums leading-none text-emerald-700">
            {available.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-400">loins</span>
        </p>
        <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
          {expected.toLocaleString()} expected (yield × 2)
          <span className="mx-1 text-slate-300">+</span>
          {nextDay.cooler_overstock.toLocaleString()} cooler overstock
        </p>
      </div>
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
  unit = "head",
  onChange,
}: ProjectionFieldProps) {
  const blank = useBlankZeroInput(value);
  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>
      <div className="mt-0.5 flex items-baseline gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          {...blank}
          onChange={(e) => onChange(clampNonNegativeInt(e.target.value))}
          className="h-9 min-w-0 flex-1 border-0 bg-transparent text-xl font-extrabold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-xs font-medium text-slate-400">{unit}</span>
      </div>
    </div>
  );
}
