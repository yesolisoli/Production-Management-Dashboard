"use client";

import clsx from "clsx";
import {
  Award,
  ClipboardList,
  Minus,
  PiggyBank,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt } from "../calculations";
import type { HogIntakeTotals } from "../calculations";

type SummaryPanelProps = {
  totals: HogIntakeTotals;
  sideOrders: number;
  onChangeSideOrders: (value: number) => void;
  sowAvailable: number;
  sowScheduled: number;
  onChangeSowAvailable: (value: number) => void;
  onChangeSowScheduled: (value: number) => void;
};

type Tone = "blue" | "violet" | "rose";

const TONES: Record<Tone, { chipBg: string; chipFg: string }> = {
  blue: { chipBg: "bg-blue-50", chipFg: "text-blue-500" },
  violet: { chipBg: "bg-violet-50", chipFg: "text-violet-500" },
  rose: { chipBg: "bg-rose-50", chipFg: "text-rose-500" },
};

export function SummaryPanel({
  totals,
  sideOrders,
  onChangeSideOrders,
  sowAvailable,
  sowScheduled,
  onChangeSowAvailable,
  onChangeSowScheduled,
}: SummaryPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <IntakeSummaryCard
        totalIntake={totals.totalIntake}
        sideOrders={sideOrders}
        onChangeSideOrders={onChangeSideOrders}
        forCutting={totals.forCutting}
        overSold={totals.overSold}
      />
      <PrimalCalcCard value={totals.yieldTotal} />
      <SowProcessingCard
        available={sowAvailable}
        scheduled={sowScheduled}
        onChangeAvailable={onChangeSowAvailable}
        onChangeScheduled={onChangeSowScheduled}
      />
    </div>
  );
}

function CardShell({
  label,
  tone,
  icon: Icon,
  children,
}: {
  label: string;
  tone: Tone;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span
          className={clsx(
            "flex h-6 w-6 items-center justify-center rounded-md",
            t.chipBg,
          )}
        >
          <Icon size={13} className={t.chipFg} strokeWidth={2} />
        </span>
      </div>
      {children}
    </div>
  );
}

// Total Intake → Side Orders → For Cutting Today, presented as one grouped
// flow since the three values are directly related (the third is derived
// from the first two).
function IntakeSummaryCard({
  totalIntake,
  sideOrders,
  onChangeSideOrders,
  forCutting,
  overSold,
}: {
  totalIntake: number;
  sideOrders: number;
  onChangeSideOrders: (value: number) => void;
  forCutting: number;
  overSold: boolean;
}) {
  return (
    <CardShell label="Intake Summary" tone="blue" icon={ClipboardList}>
      <div className="mt-2 space-y-1.5">
        <FlowRow label="Total Intake" value={totalIntake} />
        <StepperRow
          label="Side Orders"
          value={sideOrders}
          onChange={onChangeSideOrders}
        />
        <FlowRow label="For Cutting Today" value={forCutting} danger={overSold} />
      </div>
    </CardShell>
  );
}

function FlowRow({
  label,
  value,
  muted,
  emphasis,
  danger,
  prefix,
}: {
  label: string;
  value: number;
  muted?: boolean;
  emphasis?: boolean;
  danger?: boolean;
  prefix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={clsx(
          "text-sm",
          emphasis ? "font-semibold text-slate-700" : "text-slate-500",
        )}
      >
        {label}
      </span>
      {/* Spacers mirror the stepper rows' -/+ buttons so values share the
          same centered number column. */}
      <div className="flex items-center gap-1.5">
        <span className="h-7 w-7" aria-hidden />
        <span
          className={clsx(
            "w-12 text-center tabular-nums",
            emphasis ? "text-2xl font-extrabold leading-none" : "text-xl font-bold",
            danger
              ? "text-rose-600"
              : muted
                ? "text-slate-400"
                : "text-slate-900",
          )}
        >
          {prefix}
          {value.toLocaleString()}
        </span>
        <span className="h-7 w-7" aria-hidden />
      </div>
    </div>
  );
}

function PrimalCalcCard({ value }: { value: number }) {
  return (
    <CardShell label="Primal Calc (JP + RWA)" tone="violet" icon={Award}>
      <p className="mt-2 text-3xl font-extrabold tabular-nums leading-none text-slate-900">
        {value.toLocaleString()}
      </p>
      <p className="mt-2 text-[11px] leading-snug text-slate-400">
        JP + RWA only. BK, Sow, Round, Suckling, and Customer hogs excluded.
      </p>
    </CardShell>
  );
}

// Sow is its own operational track — editable here rather than in Hog Counts.
function SowProcessingCard({
  available,
  scheduled,
  onChangeAvailable,
  onChangeScheduled,
}: {
  available: number;
  scheduled: number;
  onChangeAvailable: (value: number) => void;
  onChangeScheduled: (value: number) => void;
}) {
  return (
    <CardShell label="Sow Availability" tone="rose" icon={PiggyBank}>
      <div className="mt-2 space-y-2">
        <StepperRow
          label="Available This Week"
          value={available}
          onChange={onChangeAvailable}
        />
        <StepperRow
          label="Scheduled For Today"
          value={scheduled}
          onChange={onChangeScheduled}
        />
        <div className="-mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-1">
          <span className="text-sm text-slate-500">Remaining After Schedule</span>
          <div className="flex items-center gap-1.5">
            <span className="h-7 w-7" aria-hidden />
            <span className="w-12 text-center text-xl font-extrabold tabular-nums text-slate-900">
              {Math.max(0, available - scheduled).toLocaleString()}
            </span>
            <span className="h-7 w-7" aria-hidden />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function StepperRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const set = (next: number) => onChange(clampNonNegativeInt(next));
  const blank = useBlankZeroInput(value);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 0}
          aria-label={`${label} decrement`}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
          aria-label={label}
          className="h-8 w-12 border-0 bg-transparent text-center text-xl font-extrabold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => set(value + 1)}
          aria-label={`${label} increment`}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
