"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, Users } from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt } from "../calculations";
import {
  PRIMAL_CUSTOMERS,
  emptyCustomerCategoryOrders,
  type CustomerAvailabilityColumn,
  type CustomerOrdersForDate,
  type PrimalCategory,
} from "../types";

type PrimalCustomerChartProps = {
  columns: CustomerAvailabilityColumn[];
  customerOrders: CustomerOrdersForDate;
  onChange: (customer: string, category: PrimalCategory, value: number) => void;
};

// Customer × category order matrix (mirrors the operations spreadsheet).
// Each customer's per-category order is subtracted from that category's
// Available Stock; the footer shows what remains. Collapsed by default —
// it's a reference view that's expanded only when needed.
export function PrimalCustomerChart({
  columns,
  customerOrders,
  onChange,
}: PrimalCustomerChartProps) {
  const [expanded, setExpanded] = useState(false);

  const shortCount = columns.filter((c) => c.remaining < 0).length;
  const totalOrdered = columns.reduce((sum, c) => sum + c.ordered, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header — click to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
      >
        <ChevronDown
          size={18}
          className={clsx(
            "shrink-0 text-slate-400 transition-transform",
            expanded ? "rotate-0" : "-rotate-90",
          )}
        />
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Users size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            Customer Reservations
          </h2>
          <p className="text-xs text-slate-500">
            Per-customer orders subtracted from each category&apos;s Available
            Stock
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {shortCount > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
              {shortCount} over available
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 tabular-nums">
            {totalOrdered.toLocaleString()} pcs ordered
          </span>
        </div>
      </button>

      {expanded && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-220 table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-60" />
              {columns.map((col) => (
                <col key={col.category} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left">
                  Customer
                </th>
                {columns.map((col) => (
                  <th key={col.category} className="px-2 py-2.5 text-center">
                    {col.category}
                  </th>
                ))}
              </tr>
              {/* Totals Available — read-only, per category */}
              <tr className="border-y border-slate-200 bg-slate-100/70 text-center text-xs font-bold tabular-nums text-slate-700">
                <th className="sticky left-0 z-10 bg-slate-100/70 px-4 py-2 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  Totals Available
                </th>
                {columns.map((col) => (
                  <td key={col.category} className="px-2 py-2">
                    {col.availableStock.toLocaleString()}
                  </td>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {PRIMAL_CUSTOMERS.map((customer) => {
                const orders =
                  customerOrders[customer] ?? emptyCustomerCategoryOrders();
                return (
                  <tr
                    key={customer}
                    className="text-center tabular-nums transition-colors hover:bg-slate-50/60"
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-left font-semibold text-slate-800">
                      {customer}
                    </td>
                    {columns.map((col) => (
                      <OrderCell
                        key={col.category}
                        value={orders[col.category]}
                        ariaLabel={`${customer} ${col.category} order`}
                        onChange={(v) => onChange(customer, col.category, v)}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 text-center text-sm font-bold tabular-nums text-slate-800">
                <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  Remaining
                </td>
                {columns.map((col) => (
                  <td
                    key={col.category}
                    className={clsx(
                      "px-2 py-2.5",
                      col.remaining < 0 ? "text-red-600" : "text-emerald-600",
                    )}
                  >
                    {col.remaining.toLocaleString()}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function OrderCell({
  value,
  ariaLabel,
  onChange,
}: {
  value: number;
  ariaLabel: string;
  onChange: (next: number) => void;
}) {
  const blank = useBlankZeroInput(value);
  return (
    <td className="px-1 py-1">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        {...blank}
        aria-label={ariaLabel}
        onChange={(e) => onChange(clampNonNegativeInt(e.target.value))}
        className="h-9 w-16 rounded-lg border border-slate-200 bg-white text-center text-sm font-semibold tabular-nums text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </td>
  );
}
