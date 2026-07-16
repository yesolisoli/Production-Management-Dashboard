"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, Plus, Users, X } from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt } from "../calculations";
import {
  PRIMAL_CUSTOMERS,
  emptyCustomerGroupOrders,
  type CustomCustomersForDate,
  type CustomerAvailabilityColumn,
  type CustomerOrdersForDate,
  type PrimalGroupKey,
} from "../types";

type PrimalCustomerChartProps = {
  columns: CustomerAvailabilityColumn[];
  customerOrders: CustomerOrdersForDate;
  customCustomers: CustomCustomersForDate;
  onChange: (customer: string, group: PrimalGroupKey, value: number) => void;
  onAddCustomer: () => void;
  onRenameCustomer: (id: string, name: string) => void;
  onRemoveCustomer: (id: string) => void;
};

// Customer × category order matrix (mirrors the operations spreadsheet).
// Each customer's per-category order is subtracted from that category's
// Available Stock; the footer shows what remains. Collapsed by default —
// it's a reference view that's expanded only when needed.
export function PrimalCustomerChart({
  columns,
  customerOrders,
  customCustomers,
  onChange,
  onAddCustomer,
  onRenameCustomer,
  onRemoveCustomer,
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
          <h2 className="text-base font-semibold text-slate-900">
            Custom Orders
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
        <div className="border-t border-slate-100 p-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-220 table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-60" />
              {columns.map((col) => (
                <col key={col.group} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left">
                  Customer
                </th>
                {columns.map((col) => (
                  <th key={col.group} className="px-2 py-2.5 text-center">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {PRIMAL_CUSTOMERS.map((customer) => {
                const orders =
                  customerOrders[customer.id] ?? emptyCustomerGroupOrders();
                return (
                  <tr
                    key={customer.id}
                    className="text-center tabular-nums transition-colors hover:bg-slate-50/60"
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-left font-semibold text-slate-800">
                      {customer.name}
                    </td>
                    {columns.map((col) => (
                      <OrderCell
                        key={col.group}
                        value={orders[col.group] ?? 0}
                        ariaLabel={`${customer.name} ${col.label} order`}
                        onChange={(v) => onChange(customer.id, col.group, v)}
                      />
                    ))}
                  </tr>
                );
              })}

              {/* Manually added customer rows — editable name, removable. */}
              {customCustomers.map((customer) => {
                const orders =
                  customerOrders[customer.id] ?? emptyCustomerGroupOrders();
                return (
                  <tr
                    key={customer.id}
                    className="text-center tabular-nums transition-colors hover:bg-slate-50/60"
                  >
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left">
                      <input
                        type="text"
                        value={customer.name}
                        placeholder="New customer"
                        aria-label="Customer name"
                        onChange={(e) =>
                          onRenameCustomer(customer.id, e.target.value)
                        }
                        className="h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-left text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:bg-slate-50 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      />
                    </td>
                    {columns.map((col, i) => (
                      <OrderCell
                        key={col.group}
                        value={orders[col.group] ?? 0}
                        ariaLabel={`${customer.name || "New customer"} ${col.label} order`}
                        onChange={(v) => onChange(customer.id, col.group, v)}
                        trailing={
                          i === columns.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => onRemoveCustomer(customer.id)}
                              aria-label="Remove customer"
                              className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                            >
                              <X size={14} />
                            </button>
                          ) : null
                        }
                      />
                    ))}
                  </tr>
                );
              })}

              {/* Add a new customer row. */}
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={onAddCustomer}
                    aria-label="Add customer"
                    className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-50"
                  >
                    <Plus size={14} />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}
    </section>
  );
}

function OrderCell({
  value,
  ariaLabel,
  onChange,
  trailing,
}: {
  value: number;
  ariaLabel: string;
  onChange: (next: number) => void;
  trailing?: ReactNode;
}) {
  const blank = useBlankZeroInput(value);
  return (
    <td className="relative px-1 py-1">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        {...blank}
        aria-label={ariaLabel}
        onChange={(e) => onChange(clampNonNegativeInt(e.target.value))}
        className="h-9 w-16 rounded-lg border border-transparent bg-transparent text-center text-sm font-semibold tabular-nums text-slate-900 outline-none transition hover:bg-slate-50 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {trailing}
    </td>
  );
}
