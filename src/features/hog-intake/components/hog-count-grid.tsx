"use client";

import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt } from "../calculations";
import { type HogCounts, type HogType } from "../types";

type HogCountGridProps = {
  counts: HogCounts;
  onChangeCount: (type: HogType, value: number) => void;
};

const YIELD_TYPES: HogType[] = ["JP", "RWA"];
const EXCLUDE_TYPES: HogType[] = ["BK", "Round", "Suckling", "Customer"];

// PRIMAL CALC HOGS (JP / RWA) roll up from Farm Delivery Records and are
// read-only here. EXCLUDED hogs (BK / Round / Suckling / Customer) are entered
// manually on their cards — they count toward Total Hog but not yield.
export function HogCountGrid({ counts, onChangeCount }: HogCountGridProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Hog Counts by Type
        </h3>
        <p className="text-xs text-slate-500">
          JP / RWA roll up from Farm Delivery Records; enter the rest manually
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader label="PRIMAL CALC HOGS" dotClass="bg-emerald-500" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {YIELD_TYPES.map((type) => (
              <ReadOnlyCard key={type} type={type} value={counts[type]} />
            ))}
          </div>
        </div>

        <div className="lg:border-l lg:border-slate-100 lg:pl-4">
          <SectionHeader label="EXCLUDED" dotClass="bg-slate-400" />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXCLUDE_TYPES.map((type) => (
              <EditableCard
                key={type}
                type={type}
                value={counts[type]}
                onChange={(v) => onChangeCount(type, v)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  label,
  dotClass,
}: {
  label: string;
  dotClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={clsx("h-2 w-2 shrink-0 rounded-full", dotClass)} />
      <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>
    </div>
  );
}

// Yield hogs (JP / RWA) — derived, read-only (they roll up from Farm Records).
function ReadOnlyCard({ type, value }: { type: HogType; value: number }) {
  return (
    <div className="flex min-h-28 flex-col rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
      <span className="text-center text-xs font-semibold text-slate-700">
        {type}
      </span>
      <div className="flex flex-1 items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums text-slate-900">
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// Excluded hogs — entered manually with a stepper.
function EditableCard({
  type,
  value,
  onChange,
}: {
  type: HogType;
  value: number;
  onChange: (next: number) => void;
}) {
  const set = (next: number) => onChange(clampNonNegativeInt(next));
  const blank = useBlankZeroInput(value);
  return (
    <div className="flex min-h-28 flex-col rounded-xl border border-slate-200 bg-white p-2.5">
      <span className="text-center text-xs font-semibold text-slate-700">
        {type}
      </span>
      <div className="flex flex-1 items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 0}
          aria-label={`${type} decrement`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={13} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          {...blank}
          onChange={(e) => set(Number(e.target.value))}
          aria-label={type}
          className="h-9 w-10 border-0 bg-transparent text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => set(value + 1)}
          aria-label={`${type} increment`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
