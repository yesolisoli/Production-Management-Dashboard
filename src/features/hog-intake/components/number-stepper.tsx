"use client";

import { Minus, Plus } from "lucide-react";
import { clampNonNegativeInt } from "../calculations";

type NumberStepperProps = {
  value: number;
  onChange: (next: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
};

export function NumberStepper({
  value,
  onChange,
  ariaLabel,
  disabled,
}: NumberStepperProps) {
  const set = (next: number) => onChange(clampNonNegativeInt(next));

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= 0}
        aria-label={ariaLabel ? `${ariaLabel} decrement` : "Decrement"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={ariaLabel}
        disabled={disabled}
        className="h-8 min-w-0 flex-1 border-0 bg-transparent text-center text-lg font-bold tabular-nums text-slate-900 outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} increment` : "Increment"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
