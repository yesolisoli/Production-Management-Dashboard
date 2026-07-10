"use client";

import clsx from "clsx";
import { Boxes, ClipboardList } from "lucide-react";
import {
  CardIcon,
  CardShell,
  ReadOnlyRow,
  StepperRow,
} from "@/components/shared/card";
import { sowRemaining } from "../calculations";
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
