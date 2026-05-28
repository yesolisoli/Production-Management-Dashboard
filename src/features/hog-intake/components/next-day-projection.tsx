"use client";

import clsx from "clsx";
import { clampNonNegativeInt, projectedForCutting } from "../calculations";
import type { NextDay } from "../types";

type NextDayProjectionProps = {
  nextDay: NextDay;
  onChange: (field: "hog_count" | "side_orders", value: number) => void;
};

export function NextDayProjection({
  nextDay,
  onChange,
}: NextDayProjectionProps) {
  const projected = projectedForCutting(nextDay);
  const negative = projected < 0;

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">
        Next Day Projection
      </h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <span className="text-sm font-semibold text-slate-800">
            Projected Hog Count
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={nextDay.hog_count}
            onChange={(e) =>
              onChange("hog_count", clampNonNegativeInt(e.target.value))
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-base font-semibold tabular-nums text-slate-900 outline-none focus:border-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>

        <label className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <span className="text-sm font-semibold text-slate-800">
            Projected Side Orders
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={nextDay.side_orders}
            onChange={(e) =>
              onChange("side_orders", clampNonNegativeInt(e.target.value))
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-base font-semibold tabular-nums text-slate-900 outline-none focus:border-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>

        <div
          className={clsx(
            "flex flex-col justify-center rounded-xl border p-3",
            negative
              ? "border-red-200 bg-red-50"
              : "border-emerald-200 bg-emerald-50",
          )}
        >
          <span
            className={clsx(
              "text-sm font-semibold",
              negative ? "text-red-700" : "text-emerald-700",
            )}
          >
            Projected For Cutting
          </span>
          <span
            className={clsx(
              "mt-1 text-2xl font-bold tabular-nums",
              negative ? "text-red-700" : "text-emerald-700",
            )}
          >
            {projected}
          </span>
        </div>
      </div>
    </section>
  );
}
