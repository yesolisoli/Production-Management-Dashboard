"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Layers,
  type LucideIcon,
} from "lucide-react";
import type {
  AvailabilityStatus,
  AvailabilityTotals,
  GroupAvailability,
} from "../types";

// Top-of-page KPI strip — the four headline figures from the availability
// footer totals. Standalone so the page can show them above everything while
// the detailed chart stays collapsed.
export function PrimalAvailabilityKpis({
  totals,
}: {
  totals: AvailabilityTotals;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label="Available"
        value={totals.availableStock}
        negative={totals.availableStock < 0}
        tone="emerald"
        icon={Boxes}
      />
      <KpiCard
        label="Orders"
        value={totals.customerOrders}
        tone="blue"
        icon={ClipboardList}
      />
      <KpiCard
        label="Shortage"
        value={totals.shortage}
        negative={totals.shortage > 0}
        tone="rose"
        icon={AlertTriangle}
      />
      <KpiCard
        label="Today's O/S"
        value={totals.todaysOverstock}
        negative={totals.todaysOverstock < 0}
        tone="violet"
        icon={Layers}
      />
    </div>
  );
}

type PrimalAvailabilityChartProps = {
  rows: GroupAvailability[];
  totals: AvailabilityTotals;
  minReserve: number;
};

// Read-only summary of what's actually available to ship after subtracting
// customer orders from today's expected production plus existing cooler
// overstock. Available Stock here is the NET figure (gross − orders), so it
// matches the Customer Availability chart's "Remaining" row directly.
export function PrimalAvailabilityChart({
  rows,
  totals,
  minReserve,
}: PrimalAvailabilityChartProps) {
  // Collapsed by default — the headline figures live in the top KPI strip;
  // this detailed table is opened on demand.
  const [open, setOpen] = useState(false);
  const shortCount = rows.filter((r) => r.status === "Short").length;
  const lowReserveCount = rows.filter((r) => r.status === "Low Reserve").length;

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
            <h2 className="text-sm font-semibold text-slate-900">
              Availability Chart for Today
            </h2>
            <p className="text-xs text-slate-500">
              Exp. production + yesterday O/S − customer reservations = Available
              Stock; − customer orders = Today&apos;s O/S · minimum reserve{" "}
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
              All groups OK
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
              <th className="px-4 py-2.5">Group</th>
              <th className="px-2 py-2.5 text-right">Exp. Production</th>
              <th className="px-2 py-2.5 text-right">Yesterday O/S</th>
              <th className="px-2 py-2.5 text-right">Customer Reservations</th>
              <th className="px-2 py-2.5 text-right">Available Stock</th>
              <th className="px-2 py-2.5 text-right">Customer Orders</th>
              <th className="px-2 py-2.5 text-right">Shortage</th>
              <th className="px-2 py-2.5 text-right">Today&apos;s O/S</th>
              <th className="px-4 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <AvailabilityRow key={row.group} row={row} />
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
                {totals.yesterdayOverstock.toLocaleString()}
              </td>
              <td className="px-2 py-2.5">
                {totals.specialCustomerOrders.toLocaleString()}
              </td>
              <td
                className={clsx(
                  "px-2 py-2.5",
                  totals.availableStock < 0 ? "text-red-600" : "text-slate-800",
                )}
              >
                {totals.availableStock.toLocaleString()}
              </td>
              <td className="px-2 py-2.5">
                {totals.customerOrders.toLocaleString()}
              </td>
              <td
                className={clsx(
                  "px-2 py-2.5",
                  totals.shortage > 0 ? "text-red-600" : "text-slate-400",
                )}
              >
                {totals.shortage.toLocaleString()}
              </td>
              <td
                className={clsx(
                  "px-2 py-2.5",
                  totals.todaysOverstock < 0 ? "text-red-600" : "text-slate-800",
                )}
              >
                {totals.todaysOverstock.toLocaleString()}
              </td>
              <td className="px-4 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>
      )}
    </section>
  );
}

const KPI_TONES = {
  emerald: { chipBg: "bg-emerald-50", chipFg: "text-emerald-500" },
  blue: { chipBg: "bg-blue-50", chipFg: "text-blue-500" },
  rose: { chipBg: "bg-rose-50", chipFg: "text-rose-500" },
  violet: { chipBg: "bg-violet-50", chipFg: "text-violet-500" },
} as const;

function KpiCard({
  label,
  value,
  negative = false,
  tone = "blue",
  icon: Icon,
}: {
  label: string;
  value: number;
  negative?: boolean;
  tone?: keyof typeof KPI_TONES;
  icon: LucideIcon;
}) {
  const chip = KPI_TONES[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span
          className={clsx(
            "flex h-6 w-6 items-center justify-center rounded-md",
            chip.chipBg,
          )}
        >
          <Icon size={13} className={chip.chipFg} strokeWidth={2} />
        </span>
      </div>
      <p
        className={clsx(
          "mt-1 text-xl font-bold tabular-nums",
          negative ? "text-red-600" : "text-slate-900",
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
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
        {row.yesterdayOverstock.toLocaleString()}
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
        {row.customerOrders.toLocaleString()}
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
          row.todaysOverstock < 0 ? "text-red-600" : "text-emerald-600",
        )}
      >
        {row.todaysOverstock.toLocaleString()}
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
