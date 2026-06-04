"use client";

import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt } from "../calculations";
import {
  YIELD_HOG_TYPES,
  type HogCounts,
  type HogType,
} from "../types";

type HogCountGridProps = {
  counts: HogCounts;
  onChange: (type: HogType, value: number) => void;
  onClearAll: () => void;
};

const YIELD_TYPES: HogType[] = ["JP", "RWA", "BK"];
const EXCLUDE_TYPES: HogType[] = ["Round", "Suckling", "Customer"];

export function HogCountGrid({
  counts,
  onChange,
  onClearAll,
}: HogCountGridProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Hog Counts by Type
          </h3>
          <p className="text-xs text-slate-500">Enter intake counts by type</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <SectionHeader
            label="YIELD · included"
            dotClass="bg-emerald-500"
            count={YIELD_HOG_TYPES.length}
          />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {YIELD_TYPES.map((type) => (
              <HogCountCard
                key={type}
                type={type}
                value={counts[type]}
                tone="yield"
                onChange={(v) => onChange(type, v)}
              />
            ))}
            <SowReferenceCard
              value={counts.Sow}
              onChange={(v) => onChange("Sow", v)}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Sow is tracked for reference only — it is not counted in Total Hogs,
            Yield Total, or For Cutting.
          </p>
        </div>

        <div className="lg:col-span-3 lg:border-l lg:border-slate-100 lg:pl-4">
          <SectionHeader
            label="EXCLUDE · not in yield"
            dotClass="bg-slate-400"
            count={EXCLUDE_TYPES.length}
          />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EXCLUDE_TYPES.map((type) => (
              <HogCountCard
                key={type}
                type={type}
                value={counts[type]}
                tone="exclude"
                onChange={(v) => onChange(type, v)}
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
  count,
}: {
  label: string;
  dotClass: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={clsx("h-2 w-2 rounded-full", dotClass)} />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </span>
      </div>
      <span className="text-xs text-slate-400">{count} types</span>
    </div>
  );
}

type HogCountCardProps = {
  type: HogType;
  value: number;
  tone: "yield" | "exclude";
  onChange: (next: number) => void;
};

function HogCountCard({ type, value, tone, onChange }: HogCountCardProps) {
  const set = (next: number) => onChange(clampNonNegativeInt(next));
  const blank = useBlankZeroInput(value);
  const isYield = tone === "yield";
  return (
    <div
      className={clsx(
        "flex flex-col items-stretch gap-1.5 rounded-xl border p-2.5",
        isYield
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-slate-200 bg-white",
      )}
    >
      <span className="text-center text-xs font-semibold text-slate-700">
        {type}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        {...blank}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={`${type} count`}
        className="h-8 w-full border-0 bg-transparent text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 0}
          aria-label={`${type} decrement`}
          className="flex h-7 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={() => set(value + 1)}
          aria-label={`${type} increment`}
          className="flex h-7 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

// Sow input, styled as a reference card. Identical mechanics to
// HogCountCard but visually set apart (violet) to signal it never feeds a
// total — it's intake reference only.
function SowReferenceCard({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const set = (next: number) => onChange(clampNonNegativeInt(next));
  const blank = useBlankZeroInput(value);
  return (
    <div className="flex flex-col items-stretch gap-1.5 rounded-xl border border-violet-200 bg-violet-50/60 p-2.5">
      <span className="text-center text-xs font-semibold text-violet-700">
        Sow
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        {...blank}
        onChange={(e) => set(Number(e.target.value))}
        aria-label="Sow count"
        className="h-8 w-full border-0 bg-transparent text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 0}
          aria-label="Sow decrement"
          className="flex h-7 flex-1 items-center justify-center rounded-lg border border-violet-200 bg-white text-violet-600 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={() => set(value + 1)}
          aria-label="Sow increment"
          className="flex h-7 flex-1 items-center justify-center rounded-lg border border-violet-200 bg-white text-violet-600 transition hover:bg-violet-50"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
