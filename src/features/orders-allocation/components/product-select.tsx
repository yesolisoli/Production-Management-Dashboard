"use client";

import { CustomSelect, type SelectOption } from "./custom-select";
import {
  ALLOCATION_PRODUCTS,
  PRIORITIES,
  priorityDotClass,
  productDotClass,
  productLabel,
  type AllocationProduct,
  type Priority,
} from "../types";

// Dropdown option lists for the Orders & Allocation selectors — each carries
// its colour dot, derived from the single-source dot helpers in types.ts.
const PRODUCT_OPTIONS: readonly SelectOption<AllocationProduct>[] =
  ALLOCATION_PRODUCTS.map((group) => ({
    value: group.key as AllocationProduct,
    label: productLabel(group.key),
    dotClass: productDotClass(group.key),
  }));

const PRIORITY_OPTIONS: readonly SelectOption<Priority>[] = PRIORITIES.map(
  (p) => ({
    value: p.value,
    label: p.label,
    dotClass: priorityDotClass(p.value),
  })
);

// Product picker — custom dropdown with a per-product colour dot.
export function ProductSelect({
  value,
  onChange,
  id,
}: {
  value: AllocationProduct;
  onChange: (value: AllocationProduct) => void;
  id?: string;
}) {
  return (
    <CustomSelect
      id={id}
      value={value}
      options={PRODUCT_OPTIONS}
      onChange={onChange}
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
