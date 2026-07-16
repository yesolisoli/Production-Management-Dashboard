"use client";

import { useState } from "react";
import { AlertTriangle, Boxes, ChevronDown } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { GroupAllocationAvailability } from "../calculations";
import type { PrimalDemandStatus } from "../hooks/use-primal-demand";
import { productDotClass, productTextClass } from "../types";

// "Availability" — the Primal Ending Stock for each production group, reduced by
// today's allocation instructions. Presentation only: every value is DERIVED
// (deriveGroupAvailability) from the read-only Primal demand snapshot + the
// draft instructions, so it updates the instant an allocation is added, edited,
// or removed. Nothing here is stored.
type AvailabilitySectionProps = {
  status: PrimalDemandStatus;
  rows: GroupAllocationAvailability[];
};

const fmt = (n: number) => n.toLocaleString();

export function AvailabilitySection({ status, rows }: AvailabilitySectionProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5"
      >
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${
            collapsed ? "-rotate-90" : "rotate-0"
          }`}
        />
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Boxes size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">
            Availability
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Ending Stock from Primal Calculation, reduced by today&apos;s
            allocation quantities. Starting Availability stays sourced from
            Primal.
          </p>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-100">
      {status === "loading" && (
        <div className="p-4 text-sm text-slate-400 sm:p-5">
          Loading availability…
        </div>
      )}

      {status === "error" && (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn’t load availability"
          description="Primal demand failed to load for this date. Try again or reselect the date."
        />
      )}

      {status === "missing" && (
        <EmptyState
          icon={Boxes}
          title="Primal Calculation not completed"
          description="No Ending Stock is available for this date yet. Complete Primal Calculation to see Availability here."
        />
      )}

      {status === "ready" && rows.length === 0 && (
        <EmptyState
          icon={Boxes}
          title="No Ending Stock"
          description="Primal Calculation returned no production groups for this date."
        />
      )}

      {status === "ready" && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-5">
          {rows.map((row) => (
            <AvailabilityCard key={row.group} row={row} />
          ))}
        </div>
      )}
        </div>
      )}
    </section>
  );
}

function AvailabilityCard({ row }: { row: GroupAllocationAvailability }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${productDotClass(row.group)}`}
        />
        <span
          className={`truncate text-xs font-bold uppercase tracking-wide ${productTextClass(row.group)}`}
        >
          {row.label}
        </span>
      </div>

      <dl className="flex flex-col gap-1 text-sm tabular-nums">
        <Line label="Starting" value={`${fmt(row.startingAvailability)} pcs`} />
        <Line label="Allocated" value={`${fmt(row.allocatedPcs)} pcs`} />
        <div className="mt-0.5 flex items-baseline justify-between border-t border-slate-200 pt-1.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Remaining
          </dt>
          <dd
            className={`text-base font-bold ${
              row.over ? "text-red-600" : "text-slate-900"
            }`}
          >
            {fmt(row.remaining)} pcs
          </dd>
        </div>
      </dl>

      {row.over && (
        <span className="inline-flex items-center gap-1 self-start rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
          <AlertTriangle size={11} />
          Over by {fmt(Math.abs(row.remaining))} pcs
        </span>
      )}

      {row.pendingCaseRows > 0 && (
        <p className="text-[11px] leading-tight text-amber-700">
          +{fmt(row.pendingCaseQty)} in {row.pendingCaseRows} case row
          {row.pendingCaseRows > 1 ? "s" : ""} — enter in pieces to count against
          availability.
        </p>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}
