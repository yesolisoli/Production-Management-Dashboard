"use client";

import clsx from "clsx";
import { Boxes, ClipboardList, type LucideIcon, Minus, Plus } from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt, sowRemaining } from "../calculations";
import type { HogIntakeTotals } from "../calculations";

type SummaryPanelProps = {
  totals: HogIntakeTotals;
  sideOrders: number;
  onChangeSideOrders: (value: number) => void;
  // Rendered as the middle column, between Intake Summary and Sow Availability.
  middle?: React.ReactNode;
  // Rendered as the last column, to the right of Sow Availability.
  after?: React.ReactNode;
  sowAvailable: number;
  todaysCutting: number;
  onChangeTodaysCutting: (value: number) => void;
};

export function SummaryPanel({
  totals,
  sideOrders,
  onChangeSideOrders,
  middle,
  after,
  sowAvailable,
  todaysCutting,
  onChangeTodaysCutting,
}: SummaryPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      <IntakeSummaryCard
        totalIntake={totals.totalIntake}
        sideOrders={sideOrders}
        onChangeSideOrders={onChangeSideOrders}
        forCutting={totals.forCutting}
        overSold={totals.overSold}
      />
      {middle}
      <SowProcessingCard
        available={sowAvailable}
        todaysCutting={todaysCutting}
        onChangeTodaysCutting={onChangeTodaysCutting}
      />
      {after}
    </div>
  );
}

export function CardShell({
  label,
  subtitle,
  icon,
  className,
  children,
}: {
  label: string;
  subtitle?: string;
  // Small colored badge shown in the top-right corner of the card.
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{label}</h3>
          {subtitle ? (
            <p className="text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {icon}
      </div>
      {children}
    </div>
  );
}

// Small colored icon badge for the top-right corner of a CardShell. Tones
// mirror the soft pill styling used across the Primal Calc cards.
const CARD_ICON_TONES = {
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
} as const;

export function CardIcon({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone: keyof typeof CARD_ICON_TONES;
}) {
  return (
    <span
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        CARD_ICON_TONES[tone],
      )}
    >
      <Icon size={16} />
    </span>
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
    <CardShell
      label="Intake Summary"
      subtitle="Daily intake overview"
      icon={<CardIcon icon={ClipboardList} tone="blue" />}
    >
      <div className="space-y-2">
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

// Sow is its own operational track. "Available This Week" is derived (Weekly
// Hog Plan sow rows + farm-delivered sows) and therefore read-only; only the
// daily schedule is editable here.
function SowProcessingCard({
  available,
  todaysCutting,
  onChangeTodaysCutting,
}: {
  available: number;
  todaysCutting: number;
  onChangeTodaysCutting: (value: number) => void;
}) {
  return (
    <CardShell
      label="Sow Inventory"
      subtitle="Sow inventory tracking"
      icon={<CardIcon icon={Boxes} tone="emerald" />}
    >
      <div className="space-y-2">
        <ReadOnlyRow label="Available This Week" value={available} />
        <StepperRow
          label="Today's Cutting"
          value={todaysCutting}
          onChange={onChangeTodaysCutting}
        />
        <div className="-mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-1">
          <span className="text-sm text-slate-500">Remaining After Cutting</span>
          <div className="flex items-center gap-1.5">
            <span className="h-7 w-7" aria-hidden />
            <span className="w-12 text-center text-xl font-extrabold tabular-nums text-slate-900">
              {sowRemaining(available, todaysCutting).toLocaleString()}
            </span>
            <span className="h-7 w-7" aria-hidden />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// Read-only counterpart to StepperRow for derived counts (e.g. JP / RWA / BK
// that roll up from Farm Delivery Records). Spacers reserve the width of the
// +/- buttons so the value lines up with the editable rows.
export function ReadOnlyRow({
  label,
  value,
  emphasis = false,
  // When true, spacers reserve the +/- button widths so the value lines up with
  // StepperRows. Set false to right-align the value flush to the edge.
  alignWithSteppers = true,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  alignWithSteppers?: boolean;
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
      <div className="flex items-center gap-1.5">
        {alignWithSteppers ? <span className="h-7 w-7" aria-hidden /> : null}
        <span
          className={clsx(
            "flex h-8 items-center justify-center text-xl font-extrabold tabular-nums text-slate-900",
            alignWithSteppers && "w-12",
          )}
        >
          {value}
        </span>
        {alignWithSteppers ? <span className="h-7 w-7" aria-hidden /> : null}
      </div>
    </div>
  );
}

export function StepperRow({
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
