"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, PackageCheck } from "lucide-react";
import type {
  AvailabilityStatus,
  AvailabilityTotals,
  CategoryAvailability,
} from "../types";

type PrimalAvailabilityChartProps = {
  rows: CategoryAvailability[];
  totals: AvailabilityTotals;
  minReserve: number;
};

// Read-only summary of what's actually available to ship after combining
// today's expected production with existing cooler overstock, compared
// against customer orders. Sits above the order accordions so sales can
// see shortages before drilling into SKUs.
export function PrimalAvailabilityChart({
  rows,
  totals,
  minReserve,
}: PrimalAvailabilityChartProps) {
  const shortCount = rows.filter((r) => r.status === "Short").length;
  const lowReserveCount = rows.filter((r) => r.status === "Low Reserve").length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Availability Chart for Today
          </h2>
          <p className="text-xs text-slate-500">
            Expected production + cooler O/S vs. customer orders · minimum
            reserve{" "}
            <span className="font-semibold tabular-nums">{minReserve} pcs</span>
          </p>
        </div>
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
              All categories OK
            </span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          label="Expected Production"
          value={totals.expectedProduction}
          tone="blue"
        />
        <SummaryCard
          label="Cooler O/S"
          value={totals.coolerOverstock}
          tone="violet"
        />
        <SummaryCard
          label="Available Stock"
          value={totals.availableStock}
          tone="emerald"
        />
        <SummaryCard
          label="Customer Orders"
          value={totals.customerOrders}
          tone="slate"
        />
        <SummaryCard
          label="Adjusted Ship"
          value={totals.adjustedShip}
          tone="blue"
        />
        <SummaryCard
          label="Shortage"
          value={totals.shortage}
          tone={totals.shortage > 0 ? "red" : "emerald"}
        />
      </div>

      {/* Availability table */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Category</th>
              <th className="px-2 py-2.5 text-right">Exp. Production</th>
              <th className="px-2 py-2.5 text-right">Cooler O/S</th>
              <th className="px-2 py-2.5 text-right">Available Stock</th>
              <th className="px-2 py-2.5 text-right">Customer Orders</th>
              <th className="px-2 py-2.5 text-right">Adjusted Ship</th>
              <th className="px-2 py-2.5 text-right">Ending O/S</th>
              <th className="px-2 py-2.5 text-right">Shortage</th>
              <th className="px-4 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <AvailabilityRow key={row.category} row={row} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 text-right text-sm font-bold tabular-nums text-slate-800">
              <td className="px-4 py-2.5 text-left uppercase tracking-wide text-[11px] text-slate-500">
                Total
              </td>
              <td className="px-2 py-2.5">
                {totals.expectedProduction.toLocaleString()}
              </td>
              <td className="px-2 py-2.5">
                {totals.coolerOverstock.toLocaleString()}
              </td>
              <td className="px-2 py-2.5">
                {totals.availableStock.toLocaleString()}
              </td>
              <td className="px-2 py-2.5">
                {totals.customerOrders.toLocaleString()}
              </td>
              <td className="px-2 py-2.5">
                {totals.adjustedShip.toLocaleString()}
              </td>
              <td className="px-2 py-2.5 text-slate-400">—</td>
              <td
                className={clsx(
                  "px-2 py-2.5",
                  totals.shortage > 0 ? "text-red-600" : "text-slate-400",
                )}
              >
                {totals.shortage.toLocaleString()}
              </td>
              <td className="px-4 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function AvailabilityRow({ row }: { row: CategoryAvailability }) {
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
        {row.category}
      </td>
      <td className="px-2 py-2.5 text-slate-600">
        {row.expectedProduction.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 text-violet-600">
        {row.coolerOverstock.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 font-semibold text-slate-800">
        {row.availableStock.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 text-slate-600">
        {row.customerOrders.toLocaleString()}
      </td>
      <td className="px-2 py-2.5 font-semibold text-blue-600">
        {row.adjustedShip.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5",
          lowReserve ? "font-semibold text-amber-600" : "text-slate-600",
        )}
      >
        {row.endingOverstock.toLocaleString()}
      </td>
      <td
        className={clsx(
          "px-2 py-2.5",
          short ? "font-semibold text-red-600" : "text-slate-400",
        )}
      >
        {row.shortage.toLocaleString()}
      </td>
      <td className="px-4 py-2.5 text-center">
        <StatusBadge status={row.status} />
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

const CARD_TONES: Record<string, string> = {
  blue: "border-blue-200 bg-blue-50/60 text-blue-700",
  violet: "border-violet-200 bg-violet-50/60 text-violet-700",
  emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  red: "border-red-200 bg-red-50/70 text-red-700",
};

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof CARD_TONES;
}) {
  return (
    <div className={clsx("rounded-xl border p-3", CARD_TONES[tone])}>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
        <PackageCheck size={11} />
        {label}
      </p>
      <p className="text-2xl font-extrabold tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] font-medium opacity-60">pcs</p>
    </div>
  );
}
