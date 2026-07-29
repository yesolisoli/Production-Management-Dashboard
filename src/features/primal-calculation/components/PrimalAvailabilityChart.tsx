"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import type {
  AvailabilityStatus,
  GroupAvailability,
} from "../types";

type PrimalAvailabilityChartProps = {
  rows: GroupAvailability[];
  // Operator-added availability groups — editable label, removable. Their
  // `group` field carries the row's stable id (see buildCustomGroupAvailability).
  customRows: GroupAvailability[];
  minReserve: number;
  onAddGroup: () => void;
  onRenameGroup: (id: string, label: string) => void;
  onRemoveGroup: (id: string) => void;
};

// Read-only summary of what's actually available to ship after subtracting
// customer orders from today's expected production plus the opening stock
// carried in. Available Stock here is the NET figure (gross − orders), so it
// matches the Customer Availability chart's "Remaining" row directly.
export function PrimalAvailabilityChart({
  rows,
  customRows,
  minReserve,
  onAddGroup,
  onRenameGroup,
  onRemoveGroup,
}: PrimalAvailabilityChartProps) {
  // Expanded by default — this is the primary view at the top of the page.
  const [open, setOpen] = useState(true);
  // Status badges reflect every row shown, catalog and custom alike.
  const allRows = [...rows, ...customRows];
  const shortCount = allRows.filter((r) => r.status === "Short").length;
  const lowReserveCount = allRows.filter(
    (r) => r.status === "Low Reserve",
  ).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-left"
        >
          {open ? (
            <ChevronDown size={18} className="text-slate-400" />
          ) : (
            <ChevronRight size={18} className="text-slate-400" />
          )}
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <BarChart3 size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Today&apos;s Availability
            </h2>
            <p className="text-xs text-slate-500">
              Available inventory after production, custom orders, and orders
              <span className="font-semibold tabular-nums">
                {minReserve} pcs
              </span>
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {shortCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
              <AlertTriangle size={12} />
              {shortCount} short
            </span>
          )}
          {lowReserveCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
              <AlertTriangle size={12} />
              {lowReserveCount} low reserve
            </span>
          )}
          {shortCount === 0 && lowReserveCount === 0 && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
              <CheckCircle2 size={12} />
              All primals OK
            </span>
          )}
        </div>
      </div>

      {/* Availability table — only when expanded */}
      {open && (
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-225 border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-28 px-4 py-2.5">Primal</th>
              <th className="w-32 px-2 py-2.5 text-right">Expected Production</th>
              <th className="w-32 px-2 py-2.5 text-right">Opening Stock</th>
              <th className="w-32 px-2 py-2.5 text-right">Allocated</th>
              <th className="w-32 px-2 py-2.5 text-right">Remaining Products</th>
              <th className="w-32 px-2 py-2.5 text-right">Custom Orders</th>
              <th className="w-32 px-2 py-2.5 text-right">Available Stock</th>
              <th className="w-32 px-2 py-2.5 text-right">Sales Orders</th>
              <th className="w-32 px-2 py-2.5 text-right">Shortage</th>
              <th className="w-32 px-2 py-2.5 text-right">Ending Stock</th>
              <th className="w-32 px-4 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <AvailabilityRow key={row.group} row={row} />
            ))}
            {customRows.map((row) => (
              <CustomAvailabilityRow
                key={row.group}
                row={row}
                onRename={onRenameGroup}
                onRemove={onRemoveGroup}
              />
            ))}
            {/* Add a new custom availability group. */}
            <tr>
              <td colSpan={11} className="px-2 py-1.5">
                <button
                  type="button"
                  onClick={onAddGroup}
                  aria-label="Add availability group"
                  className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-50"
                >
                  <Plus size={14} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}

function AvailabilityRow({ row }: { row: GroupAvailability }) {
  const short = row.status === "Short";
  const lowReserve = row.status === "Low Reserve";
  return (
    <tr
      className={clsx(
        "text-right tabular-nums transition-colors",
        short
          ? "bg-red-50/70"
          : lowReserve
            ? "bg-amber-50/60"
            : "hover:bg-slate-50/60",
      )}
    >
      <td className="px-4 py-2.5 text-left font-semibold text-slate-800">
        {row.label}
      </td>
      <td className="px-2 py-2.5 text-slate-600">
        {row.expectedProduction.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 text-violet-600">
        {row.openingStock.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5",
          row.allocated > 0 ? "font-semibold text-amber-600" : "text-slate-400",
        )}
      >
        {row.allocated.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5",
          row.remainingProducts > 0
            ? "font-semibold text-sky-600"
            : "text-slate-400",
        )}
      >
        {row.remainingProducts.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 text-slate-600">
        {row.specialCustomerOrders.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5 font-semibold",
          row.availableStock < 0 ? "text-red-600" : "text-slate-800",
        )}
      >
        {row.availableStock.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 text-slate-600">
        {row.salesOrders.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5",
          short ? "font-semibold text-red-600" : "text-slate-400",
        )}
      >
        {row.shortage.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5 font-semibold",
          row.endingStock < 0 ? "text-red-600" : "text-emerald-600",
        )}
      >
        {row.endingStock.toLocaleString()}
      </td>
      <td className="px-4 py-2.5 text-center">
        <StatusBadge status={row.status} />
      </td>
    </tr>
  );
}

// Operator-added group row: same columns as AvailabilityRow, but the Primal
// cell is an editable label and the row is removable. A custom group has no
// opening stock carried over, but — keyed by its id — it now carries Custom
// Orders and Sales Orders, which subtract from its Expected Production
// just like a catalog group.
function CustomAvailabilityRow({
  row,
  onRename,
  onRemove,
}: {
  row: GroupAvailability;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}) {
  const id = row.group;
  return (
    <tr className="text-right tabular-nums transition-colors hover:bg-slate-50/60">
      <td className="px-2 py-1.5 text-left">
        <input
          type="text"
          value={row.label}
          placeholder="New group"
          aria-label="Group name"
          onChange={(e) => onRename(id, e.target.value)}
          className="h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-left text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:bg-slate-50 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </td>
      <td className="px-2 py-2.5 text-slate-600">
        {row.expectedProduction.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 text-violet-600">
        {row.openingStock.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5",
          row.allocated > 0 ? "font-semibold text-amber-600" : "text-slate-400",
        )}
      >
        {row.allocated.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5",
          row.remainingProducts > 0
            ? "font-semibold text-sky-600"
            : "text-slate-400",
        )}
      >
        {row.remainingProducts.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 text-slate-600">
        {row.specialCustomerOrders.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5 font-semibold",
          row.availableStock < 0 ? "text-red-600" : "text-slate-800",
        )}
      >
        {row.availableStock.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 text-slate-600">
        {row.salesOrders.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5",
          row.shortage > 0 ? "font-semibold text-red-600" : "text-slate-400",
        )}
      >
        {row.shortage.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5 font-semibold",
          row.endingStock < 0 ? "text-red-600" : "text-emerald-600",
        )}
      >
        {row.endingStock.toLocaleString()}
      </td>
      <td className="relative px-4 py-2.5 text-center">
        <StatusBadge status={row.status} />
        <button
          type="button"
          onClick={() => onRemove(id)}
          aria-label="Remove group"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-300 transition hover:bg-red-50 hover:text-red-500"
        >
          <X size={14} />
        </button>
      </td>
    </tr>
  );
}

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  OK: "bg-emerald-50 text-emerald-700",
  Short: "bg-red-50 text-red-700",
  "Low Reserve": "bg-amber-50 text-amber-700",
};

function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const Icon = status === "OK" ? CheckCircle2 : AlertTriangle;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        STATUS_STYLES[status],
      )}
    >
      <Icon size={12} />
      {status}
    </span>
  );
}
