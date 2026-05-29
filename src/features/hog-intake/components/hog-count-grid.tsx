"use client";

import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { clampNonNegativeInt } from "../calculations";
import {
  YIELD_HOG_TYPES,
  type HogCounts,
  type HogType,
} from "../types";

type HogCountGridProps = {
  counts: HogCounts;
  onChange: (type: HogType, value: number) => void;
  onBumpAll: (delta: number) => void;
  onClearAll: () => void;
};

const YIELD_TYPES: HogType[] = ["JP", "RWA", "BK", "Sow"];
const EXCLUDE_TYPES: HogType[] = ["Round", "Suckling", "Customer"];

export function HogCountGrid({
  counts,
  onChange,
  onBumpAll,
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
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Quick Actions
          </span>
          <QuickActionButton onClick={() => onBumpAll(10)}>+10 to All</QuickActionButton>
          <QuickActionButton onClick={() => onBumpAll(50)}>+50 to All</QuickActionButton>
          <QuickActionButton onClick={() => onBumpAll(100)}>+100 to All</QuickActionButton>
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
          </div>
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
        value={value}
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

function QuickActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
    >
      {children}
    </button>
  );
}
