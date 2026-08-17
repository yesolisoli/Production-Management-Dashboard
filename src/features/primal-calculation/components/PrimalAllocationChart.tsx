"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { PRIMAL_GROUPS } from "../types";
import type { GroupAvailability, PrimalAllocation, PrimalGroupKey } from "../types";

type PrimalAllocationChartProps = {
  // Reservations entered for the viewed date.
  allocations: PrimalAllocation[];
  // Catalog availability rows — supply each group's label and the stock left to
  // reserve against (Available Stock already nets out these allocations, so the
  // gross pool is added back per group for the "of N" hint).
  rows: GroupAvailability[];
  onAdd: () => void;
  onUpdate: (
    id: string,
    patch: Partial<Omit<PrimalAllocation, "id">>,
  ) => void;
  onRemove: (id: string) => void;
};

// Operator space to reserve production-group stock for a target date. Each
// allocation is carved out of that group's Available Stock (and therefore its
// Ending Stock carry-over) in the Availability Chart above. Group-level only —
// allocations draw from the same whole-hog pool the chart tracks.
export function PrimalAllocationChart({
  allocations,
  rows,
  onAdd,
  onUpdate,
  onRemove,
}: PrimalAllocationChartProps) {
  const [open, setOpen] = useState(true);

  // Per-group gross pool (Available Stock + this group's allocations back in) so
  // the row can show "N of GROSS" and flag over-allocation without re-deriving.
  const grossByGroup = {} as Record<PrimalGroupKey, number>;
  for (const row of rows) grossByGroup[row.group] = row.availableStock + row.allocated;

  const totalAllocated = allocations.reduce((sum, a) => sum + a.qtyPcs, 0);

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
            <Boxes size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Allocations
            </h2>
            <p className="text-xs text-slate-500">
              Reserve group stock for a target date — deducted from Available
              Stock above
            </p>
          </div>
        </button>
        {totalAllocated > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600 tabular-nums">
            {totalAllocated.toLocaleString()} pcs reserved
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-175 border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-40 px-4 py-2.5">Primal</th>
                <th className="w-32 px-2 py-2.5 text-right">Quantity (pcs)</th>
                <th className="w-40 px-2 py-2.5">Target Date</th>
                <th className="px-2 py-2.5">Note</th>
                <th className="w-12 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocations.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-4 text-center text-xs text-slate-400"
                  >
                    No allocations yet — add one to reserve stock for a date.
                  </td>
                </tr>
              )}
              {allocations.map((alloc) => (
                <AllocationRow
                  key={alloc.id}
                  alloc={alloc}
                  gross={grossByGroup[alloc.group] ?? 0}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                />
              ))}
              <tr>
                <td colSpan={5} className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={onAdd}
                    aria-label="Add allocation"
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

function AllocationRow({
  alloc,
  gross,
  onUpdate,
  onRemove,
}: {
  alloc: PrimalAllocation;
  gross: number;
  onUpdate: (id: string, patch: Partial<Omit<PrimalAllocation, "id">>) => void;
  onRemove: (id: string) => void;
}) {
  const over = alloc.qtyPcs > gross;
  return (
    <tr className="transition-colors hover:bg-slate-50/60">
      <td className="px-4 py-2">
        <select
          value={alloc.group}
          aria-label="Primal group"
          onChange={(e) =>
            onUpdate(alloc.id, { group: e.target.value as PrimalGroupKey })
          }
          className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none transition hover:bg-slate-50 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        >
          {PRIMAL_GROUPS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2 text-right">
        <input
          type="number"
          min={0}
          value={alloc.qtyPcs === 0 ? "" : alloc.qtyPcs}
          placeholder="0"
          aria-label="Quantity in pieces"
          onChange={(e) =>
            onUpdate(alloc.id, { qtyPcs: Number(e.target.value) })
          }
          className={clsx(
            "h-9 w-full rounded-lg border bg-white px-2 text-right text-sm font-semibold tabular-nums outline-none transition focus:ring-2",
            over
              ? "border-red-300 text-red-600 focus:border-red-400 focus:ring-red-100"
              : "border-slate-200 text-slate-800 focus:border-amber-400 focus:ring-amber-100",
          )}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={alloc.targetDate}
          aria-label="Target date"
          onChange={(e) => onUpdate(alloc.id, { targetDate: e.target.value })}
          className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm tabular-nums text-slate-800 outline-none transition hover:bg-slate-50 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={alloc.label}
          placeholder="Destination / note"
          aria-label="Note"
          onChange={(e) => onUpdate(alloc.id, { label: e.target.value })}
          className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:bg-slate-50 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
      </td>
      <td className="px-2 py-2 text-center">
        <button
          type="button"
          onClick={() => onRemove(alloc.id)}
          aria-label="Remove allocation"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-red-50 hover:text-red-500"
        >
          <X size={15} />
        </button>
      </td>
    </tr>
  );
}
