"use client";

import { productBadgeClass, productLabel, type AllocationProduct } from "../types";

// Shared product / area filter tabs for orders & allocation. "All" reads as a
// neutral dark pill; each product tab fills with its primal tint when active so
// the selection is obvious. Counts come from the parent — this is presentation
// only, the active value is owned by the caller.
export type ProductFilterTab = {
  key: AllocationProduct;
  count: number;
};

export function ProductFilterTabs({
  value,
  onChange,
  total,
  tabs,
}: {
  value: AllocationProduct | "all";
  onChange: (value: AllocationProduct | "all") => void;
  total: number;
  tabs: ProductFilterTab[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
          value === "all"
            ? "border-transparent bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        All ({total})
      </button>
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase transition ${
              active
                ? productBadgeClass(tab.key) + " border-transparent"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {productLabel(tab.key)} ({tab.count})
          </button>
        );
      })}
    </div>
  );
}
