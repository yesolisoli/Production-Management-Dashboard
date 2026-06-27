"use client";

import { useCallback, useMemo } from "react";
import { CustomSelect, type SelectOption } from "./custom-select";
import { useAllocationAreas } from "../hooks/use-allocation-areas";
import {
  PRIORITIES,
  UNITS,
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
  })
);

// Qty-unit options (Pieces / Cases). Units have no colour identity, so each
// carries a neutral dot to satisfy the shared dropdown's option shape.
const UNIT_OPTIONS: readonly SelectOption<Unit>[] = UNITS.map((u) => ({
  value: u.value,
  label: `${u.label} (${u.short})`,
  dotClass: "bg-slate-300",
}));

// Product picker — custom dropdown with a per-product colour dot. Options are
// the live area vocabulary (Primal groups + extra / custom areas); the "add"
// row lets the operator define a new area, which is persisted and selected.
export function ProductSelect({
  value,
  onChange,
  id,
}: {
  value: AllocationProduct;
  onChange: (value: AllocationProduct) => void;
  id?: string;
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
    />
  );
}

// Rule-type picker — custom dropdown with a per-priority colour dot.
export function PrioritySelect({
  value,
  onChange,
  id,
}: {
  value: Priority;
  onChange: (value: Priority) => void;
  id?: string;
}) {
  return (
    <CustomSelect
      id={id}
      value={value}
      options={PRIORITY_OPTIONS}
      onChange={onChange}
    />
  );
}

// Qty-unit picker — Pieces or Cases (C/S), paired with the qty number input.
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
    <CustomSelect
      id={id}
      value={value}
      options={UNIT_OPTIONS}
      onChange={onChange}
    />
  );
}
