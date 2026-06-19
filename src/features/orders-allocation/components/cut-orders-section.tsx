"use client";

import { useState } from "react";
import { Box, Check, Info, Pencil, Plus, Trash2, X } from "lucide-react";
import { NumberStepper } from "@/components/shared/number-stepper";
import { ProductSelect } from "./product-select";
import { ProductFilterTabs } from "./product-filter-tabs";
import {
  cutSeconds,
  deriveCutOrdersTotals,
  formatMinutes,
  type CutOrdersTotals,
} from "../calculations";
import {
  ALLOCATION_PRODUCTS,
  CUT_LOCATIONS,
  DEFAULT_PRODUCT,
  locationLabel,
  PIECE_QUICK_ADDS,
  productBadgeClass,
  productLabel,
  SECONDS_PER_PIECE,
  type AllocationProduct,
  type CutLocation,
  type CutOrder,
} from "../types";

// "Today's Cut Orders" — a form to add/edit a cut order plus the running list.
// Presentation only: every change is forwarded to the parent's state hook.
type CutOrdersSectionProps = {
  rows: CutOrder[];
  totals: CutOrdersTotals;
  onAdd: (order: Omit<CutOrder, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<CutOrder, "id">>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

export function CutOrdersSection({
  rows,
  totals,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
}: CutOrdersSectionProps) {
  const [product, setProduct] = useState<AllocationProduct>(DEFAULT_PRODUCT);
  const [pieces, setPieces] = useState(100);
  const [location, setLocation] = useState<CutLocation>("main");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AllocationProduct | "all">("all");

  // Products actually present in the plan, in canonical order, with row counts.
  // Drives the filter tabs — only show a tab for products that exist.
  const productTabs = ALLOCATION_PRODUCTS.map((group) => ({
    key: group.key as AllocationProduct,
    count: rows.filter((row) => row.product === group.key).length,
  })).filter((tab) => tab.count > 0);

  // Keep each row's original plan number stable, then narrow to the active tab.
  const visibleRows = rows
    .map((row, index) => ({ row, number: index + 1 }))
    .filter(({ row }) => filter === "all" || row.product === filter);

  // Summary reflects the active filter; reuse the prop totals when unfiltered.
  const visibleTotals =
    filter === "all"
      ? totals
      : deriveCutOrdersTotals(visibleRows.map(({ row }) => row));

  const resetForm = () => {
    setProduct(DEFAULT_PRODUCT);
    setPieces(100);
    setLocation("main");
    setNote("");
    setEditingId(null);
  };

  const submit = () => {
    const payload = { product, pieces, location, note: note.trim() };
    if (editingId) onUpdate(editingId, payload);
    else onAdd(payload);
    resetForm();
  };

  const startEdit = (row: CutOrder) => {
    setProduct(row.product);
    setPieces(row.pieces);
    setLocation(row.location);
    setNote(row.note);
    setEditingId(row.id);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Box size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Today&apos;s Cut Plan
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Review demand from Primal, then assign quantities to Main Line or
              Overflow Room.
            </p>
          </div>
        </div>
        {rows.length === 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            <Info size={14} className="shrink-0" />
            Cut plan rows will be suggested from Primal orders. Add or adjust
            rows as needed.
          </p>
        )}
      </header>

      {/* Add / edit form */}
      <div className="flex flex-col gap-4 border-y border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-8">
        <div className="lg:min-w-35 lg:flex-1">
          <label className={labelClass} htmlFor="cut-product">
            Product
          </label>
          <ProductSelect
            id="cut-product"
            value={product}
            onChange={setProduct}
          />
        </div>

        <div className="lg:shrink-0">
          <label className={labelClass}>Pieces</label>
          <div className="flex items-center gap-2">
            <div className="w-32">
              <NumberStepper
                value={pieces}
                onChange={setPieces}
                ariaLabel="Pieces"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PIECE_QUICK_ADDS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setPieces((p) => p + amount)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  +{amount}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Est. cut time: {formatMinutes(cutSeconds(pieces))} ({pieces} pcs ×{" "}
            {SECONDS_PER_PIECE}s)
          </p>
        </div>

        <div className="lg:min-w-35 lg:flex-1">
          <label className={labelClass}>Location</label>
          <div className="flex flex-col gap-1.5">
            {CUT_LOCATIONS.map((loc) => {
              const active = location === loc.value;
              return (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() => setLocation(loc.value)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      active ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  {loc.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:min-w-35 lg:flex-[2]">
          <label className={labelClass} htmlFor="cut-note">
            Note (optional)
          </label>
          <input
            id="cut-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. B'less boxed vac - SYSCO customer"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col lg:shrink-0">
          <span className={`${labelClass} opacity-0`} aria-hidden="true">
            Add
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={submit}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? "Update" : "Add"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <X size={15} />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty state — guide the user to add their first cut order. */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center sm:py-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Box size={20} />
          </span>
          <p className="text-sm font-semibold text-slate-600">
            No cut orders yet
          </p>
          <p className="max-w-md text-xs text-slate-400">
            Pick a product, set the pieces and location above, then press Add to
            build today&apos;s cut plan.
          </p>
        </div>
      )}

      {/* List of added cut orders */}
      {rows.length > 0 && (
        <div className="border-t border-slate-100 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Cut plan ({visibleRows.length})
            </h3>
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold text-red-500 transition hover:text-red-600"
            >
              Clear All
            </button>
          </div>

          {/* Filter by product — view the plan one product at a time. */}
          {productTabs.length > 1 && (
            <div className="mb-3">
              <ProductFilterTabs
                value={filter}
                onChange={setFilter}
                total={rows.length}
                tabs={productTabs}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-170 border-separate border-spacing-y-1.5 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-3 pb-1">#</th>
                  <th className="px-3 pb-1">Product</th>
                  <th className="px-3 pb-1">Pieces</th>
                  <th className="px-3 pb-1">Location</th>
                  <th className="px-3 pb-1">Note</th>
                  <th className="px-3 pb-1">Est. Time</th>
                  <th className="px-3 pb-1 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ row, number }) => (
                  <tr key={row.id} className="bg-slate-50/60">
                    <td className="rounded-l-xl px-3 py-3 font-semibold text-blue-600">
                      {number}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold uppercase ${productBadgeClass(
                          row.product
                        )}`}
                      >
                        {productLabel(row.product)}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-slate-900">
                      {row.pieces} pcs
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            row.location === "main"
                              ? "bg-emerald-500"
                              : "bg-amber-400"
                          }`}
                        />
                        {locationLabel(row.location)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {row.note || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">
                      {formatMinutes(cutSeconds(row.pieces))}
                    </td>
                    <td className="rounded-r-xl px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          title="Edit"
                          aria-label="Edit cut order"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(row.id)}
                          title="Remove"
                          aria-label="Remove cut order"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            <Box size={16} className="shrink-0" />
            {visibleTotals.count} orders · Total {visibleTotals.totalPieces} pcs
            · Est. Total Time {formatMinutes(visibleTotals.totalSeconds)}
          </div>
        </div>
      )}
    </section>
  );
}
