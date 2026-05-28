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
    <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= 0}
        aria-label={ariaLabel ? `${ariaLabel} decrement` : "Decrement"}
        className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus size={16} />
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
        className="h-10 w-16 border-x border-slate-200 bg-white text-center text-base font-semibold text-slate-900 outline-none focus:bg-slate-50 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} increment` : "Increment"}
        className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
