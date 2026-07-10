"use client";

import { useCallback, useMemo } from "react";
import { CustomSelect, type SelectOption } from "./custom-select";
import { useAllocationAreas } from "../hooks/use-allocation-areas";
import {
  PRIORITIES,
  UNITS,
  priorityBadgeClass,
  priorityDotClass,
  productDotClass,
  productLabel,
  type AllocationProduct,
  type Priority,
  type Unit,
} from "../types";

// Dropdown option list for the priority selector — each carries its colour dot,
// derived from the single-source dot helpers in types.ts. (Product options are
// built dynamically below from the live area vocabulary.)
const PRIORITY_OPTIONS: readonly SelectOption<Priority>[] = PRIORITIES.map(
  (p) => ({
    value: p.value,
    label: p.label,
    dotClass: priorityDotClass(p.value),
    badgeClass: priorityBadgeClass(p.value),
  })
);

// Product picker — custom dropdown with a per-product colour dot. Options are
// the live area vocabulary (Primal groups + extra / custom areas); the "add"
// row lets the operator define a new area, which is persisted and selected.
export function ProductSelect({
  value,
  onChange,
  id,
  defaultOpen,
  onClose,
}: {
  value: AllocationProduct;
  onChange: (value: AllocationProduct) => void;
  id?: string;
  defaultOpen?: boolean;
  onClose?: () => void;
}) {
  const { areaKeys, addArea } = useAllocationAreas();

  const options = useMemo<readonly SelectOption<AllocationProduct>[]>(
    () =>
      areaKeys.map((key) => ({
        value: key,
        label: productLabel(key),
        dotClass: productDotClass(key),
      })),
    [areaKeys],
  );

  const handleAdd = useCallback(
    (label: string) => {
      const key = addArea(label);
      if (key) onChange(key);
    },
    [addArea, onChange],
  );

  return (
    <CustomSelect
      id={id}
      value={value}
      options={options}
      onChange={onChange}
      onAdd={handleAdd}
      addLabel="Add product / area"
      defaultOpen={defaultOpen}
      onClose={onClose}
    />
  );
}

// Rule-type picker — custom dropdown with a per-priority colour dot.
export function PrioritySelect({
  value,
  onChange,
  id,
  defaultOpen,
  onClose,
  flush,
}: {
  value: Priority;
  onChange: (value: Priority) => void;
  id?: string;
  defaultOpen?: boolean;
  onClose?: () => void;
  // Inline-table mode — borderless, full-width pill that keeps the cell's
  // footprint. The standalone form picker leaves this off for a bordered box.
  flush?: boolean;
}) {
  return (
    <CustomSelect
      id={id}
      value={value}
      options={PRIORITY_OPTIONS}
      onChange={onChange}
      defaultOpen={defaultOpen}
      onClose={onClose}
      variant="badge"
      flush={flush}
    />
  );
}

// Qty-unit picker — Pieces or Cases (C/S), paired with the qty number input.
// Only two mutually-exclusive values, so a segmented toggle reads cleaner than a
// dropdown (no truncation, one-tap switch) — matches the "unit toggle" in the UI.
export function UnitSelect({
  value,
  onChange,
  id,
}: {
  value: Unit;
  onChange: (value: Unit) => void;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Quantity unit"
      className="flex h-9 w-full items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
    >
      {UNITS.map((u) => {
        const active = u.value === value;
        return (
          <button
            key={u.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={u.label}
            title={u.label}
            onClick={() => onChange(u.value)}
            className={`flex h-full flex-1 items-center justify-center rounded-md text-[11px] font-bold uppercase tracking-wide transition ${
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {u.short}
          </button>
        );
      })}
    </div>
  );
}
