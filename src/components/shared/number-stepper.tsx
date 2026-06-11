"use client";

import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";

// Canonical −/input/+ number stepper shared across Hog Intake and Primal
// Calculation. The three variants reproduce the existing visual styles exactly
// (Tailwind utility sets are order-independent, so the rendered output is
// identical to the components this replaced):
//   • inline — standalone stepper (e.g. Next Day Projection): h-8 buttons,
//     flex-1 text-lg input.
//   • card   — compact card rows (Intake/Sow/Process cards, Farm Records):
//     h-7 buttons, w-12 text-xl input.
//   • cell   — Primal order-table cell: h-8 buttons, bordered h-10 w-20 text-sm
//     input with an accent focus ring.
export type NumberStepperVariant = "inline" | "card" | "cell";

// Accent ring used only by the "cell" variant; matches the Primal table accents.
export type NumberStepperAccent = "blue" | "emerald" | "violet" | "none";

const ACCENTS: Record<NumberStepperAccent, string> = {
  blue: "focus:border-blue-400 focus:ring-blue-100",
  emerald: "focus:border-emerald-400 focus:ring-emerald-100",
  violet: "focus:border-violet-400 focus:ring-violet-100",
  none: "focus:border-slate-400 focus:ring-slate-100",
};

const VARIANTS: Record<
  NumberStepperVariant,
  { container: string; button: string; input: string; icon: number }
> = {
  inline: {
    container: "flex items-center justify-between gap-2",
    button:
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
    input:
      "h-8 min-w-0 flex-1 border-0 bg-transparent text-center text-lg font-bold tabular-nums text-slate-900 outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
    icon: 14,
  },
  card: {
    container: "flex items-center gap-1.5",
    button:
      "flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
    input:
      "h-8 w-12 border-0 bg-transparent text-center text-xl font-extrabold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
    icon: 13,
  },
  cell: {
    container: "flex items-center justify-center gap-1.5",
    button:
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40",
    input:
      "h-10 w-20 rounded-lg border border-transparent bg-white text-center text-sm font-semibold tabular-nums text-slate-900 outline-none transition focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
    icon: 14,
  },
};

type NumberStepperProps = {
  value: number;
  onChange: (next: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
  variant?: NumberStepperVariant;
  // Focus-ring accent for the "cell" variant; ignored by other variants.
  accent?: NumberStepperAccent;
  // Overrides the container layout class (e.g. an inline-flex stepper in a
  // table cell). Defaults to the variant's own container.
  className?: string;
};

export function NumberStepper({
  value,
  onChange,
  ariaLabel,
  disabled,
  variant = "inline",
  accent = "none",
  className,
}: NumberStepperProps) {
  const v = VARIANTS[variant];
  const blank = useBlankZeroInput(value);
  const set = (next: number | string) => onChange(clampNonNegativeInt(next));

  return (
    <div className={className ?? v.container}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= 0}
        aria-label={ariaLabel ? `${ariaLabel} decrement` : "Decrement"}
        className={v.button}
      >
        <Minus size={v.icon} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        {...blank}
        onChange={(e) => set(e.target.value)}
        aria-label={ariaLabel}
        disabled={disabled}
        className={
          variant === "cell" ? clsx(v.input, ACCENTS[accent]) : v.input
        }
      />
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} increment` : "Increment"}
        className={v.button}
      >
        <Plus size={v.icon} />
      </button>
    </div>
  );
}
