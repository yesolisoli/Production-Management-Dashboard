"use client";

import clsx from "clsx";
import { type LucideIcon } from "lucide-react";
import { NumberStepper } from "./number-stepper";

// Shared card primitives used across the Hog Intake summary cards (Intake
// Summary, Sow Inventory, Non-Primal / Primal Hogs, Today's Adjustments).
// Moved out of summary-panel.tsx so any feature can reuse them.

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
  // When true, positive values render with an explicit "+" prefix (negatives
  // already show "−"). Used for adjustment rows that add to a running total.
  signed = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  alignWithSteppers?: boolean;
  signed?: boolean;
}) {
  const display = signed && value > 0 ? `+${value}` : value;
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
        {/* Spacers reserve the +/- button widths. When alignWithSteppers is
            false the value still lines up with stepper rows on mobile (cards are
            stacked, so consistent number columns matter) but goes flush-right on
            desktop where the card sits in its own narrow column. */}
        <span
          className={clsx("h-7 w-7", !alignWithSteppers && "lg:hidden")}
          aria-hidden
        />
        <span
          className={clsx(
            "flex h-8 items-center justify-center text-xl font-extrabold tabular-nums text-slate-900",
            alignWithSteppers ? "w-12" : "w-12 lg:w-auto",
          )}
        >
          {display}
        </span>
        <span
          className={clsx("h-7 w-7", !alignWithSteppers && "lg:hidden")}
          aria-hidden
        />
      </div>
    </div>
  );
}

// Label + editable number stepper, laid out as a card row. The stepper itself
// is the shared NumberStepper (card variant), so the −/input/+ control matches
// every other stepper in the app.
export function StepperRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-slate-500">{label}</span>
      <NumberStepper
        variant="card"
        value={value}
        onChange={onChange}
        ariaLabel={label}
      />
    </div>
  );
}
