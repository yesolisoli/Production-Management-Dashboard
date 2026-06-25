"use client";

import {
  productBadgeClass,
  productDotClass,
  productLabel,
  type AllocationProduct,
} from "../types";

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
  showAll = true,
  withDots = false,
}: {
  value: AllocationProduct | "all";
  onChange: (value: AllocationProduct | "all") => void;
  total: number;
  tabs: ProductFilterTab[];
  // When false, the neutral "All" pill is hidden and only per-product tabs are
  // shown (the caller views one product at a time).
  showAll?: boolean;
  // When true, each product tab leads with its solid colour dot and the count
  // reads as a plain trailing number (used by the allocation-sheet view).
  withDots?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {showAll && (
        <button
          type="button"
          onClick={() => onChange("all")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            value === "all"
              ? "border-transparent bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {withDots ? (
            <span className="inline-flex items-center gap-1.5">
              All
              <span className="text-[11px] font-bold tabular-nums opacity-70">
                {total}
              </span>
            </span>
          ) : (
            `All (${total})`
          )}
        </button>
      )}
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
            {withDots ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${productDotClass(tab.key)}`}
                />
                {productLabel(tab.key)}
                <span className="text-[11px] font-bold tabular-nums opacity-60">
                  {tab.count}
                </span>
              </span>
            ) : (
              `${productLabel(tab.key)} (${tab.count})`
            )}
          </button>
        );
      })}
    </div>
  );
}
