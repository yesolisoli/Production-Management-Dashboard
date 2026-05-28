"use client";

import {
  HOG_TYPES,
  YIELD_HOG_TYPES,
  type HogCounts,
  type HogType,
} from "../types";
import { yieldTotal } from "../calculations";
import { NumberStepper } from "./number-stepper";

type HogCountGridProps = {
  counts: HogCounts;
  onChange: (type: HogType, value: number) => void;
};

const HOG_LABELS: Record<HogType, string> = {
  JP: "JP",
  RWA: "RWA",
  BK: "BK",
  Sow: "Sow",
  Round: "Round",
  Suckling: "Suckling",
  Customer: "Customer",
};

const YIELD_SET = new Set<HogType>(YIELD_HOG_TYPES);

export function HogCountGrid({ counts, onChange }: HogCountGridProps) {
  const yieldSum = yieldTotal(counts);

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Hog Counts</h3>
        <p className="text-sm text-slate-500">
          Yield Total{" "}
          <span className="ml-1 text-base font-semibold tabular-nums text-slate-900">
            {yieldSum}
          </span>
          <span className="ml-2 text-xs text-slate-400">
            JP + RWA + BK + Sow
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {HOG_TYPES.map((type) => {
          const inYield = YIELD_SET.has(type);
          return (
            <div
              key={type}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  {HOG_LABELS[type]}
                </span>
                {inYield ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Yield
                  </span>
                ) : null}
              </div>
              <NumberStepper
                value={counts[type]}
                onChange={(v) => onChange(type, v)}
                ariaLabel={`${HOG_LABELS[type]} count`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
