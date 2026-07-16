"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Download,
  Mail,
  Plus,
  X,
} from "lucide-react";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import { EmptyState } from "@/components/shared/empty-state";
import {
  emailAllocationInstructions,
  exportAllocationInstructions,
} from "../allocation-export";
import {
  DEFAULT_PRODUCT,
  DEFAULT_UNIT,
  priorityLabel,
  productDotClass,
  productLabel,
  productTextClass,
  sortProductKeys,
  unitShort,
  type AllocationInstruction,
  type AllocationProduct,
  type Priority,
  type Unit,
} from "../types";
import { PrioritySelect, ProductSelect, UnitSelect } from "./product-select";
import { ProductFilterTabs } from "./product-filter-tabs";

// "Allocation Sheet — Morning Brief" — daily instruction lines with a priority
// colour code. Presentation only; edits flow up to the state hook.
type AllocationSheetSectionProps = {
  rows: AllocationInstruction[];
  date: string;
  onAdd: (instruction: Omit<AllocationInstruction, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<AllocationInstruction, "id">>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

// Compact input for in-cell editing (smaller than the add form's inputClass).
// min-w-0 keeps it from forcing its table-fixed column wider than the colgroup.
const cellInputClass =
  "h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

// Muted placeholder for an empty value in a read cell.
const emptyCell = <span className="text-slate-300">—</span>;

// The cells an operator can edit in place by clicking them. (Product is
// read-only — it comes from Primal — so it isn't an editable cell.)
type CellField = "type" | "qty" | "context" | "customer";

// Rule type → guidance styles. The row stays on a plain background; the type is
// shown by the left accent bar (its own table column) + the colour tag only (no
// row tint).
//   dont = Red (DO NOT) · do = Yellow (DO THIS) · standard = White.
const RULE_STYLES: Record<Priority, { bar: string; badge: string }> = {
  dont: {
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-700",
  },
  do: {
    bar: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800",
  },
  standard: {
    bar: "bg-slate-300",
    badge: "bg-slate-100 text-slate-600",
  },
};

// Within a group, red DO NOT rows come first, then yellow, then white.
const PRIORITY_RANK: Record<Priority, number> = {
  dont: 0,
  do: 1,
  standard: 2,
};

// Derive the printable sheet from raw rows (no extra state). Product groups
// cover every category that actually has rows (Primal groups first, then extra
// / custom areas — including the "General Note" area), in canonical order.
function buildSheet(rows: AllocationInstruction[]) {
  const byPriority = (a: AllocationInstruction, b: AllocationInstruction) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

  const categories = sortProductKeys([...new Set(rows.map((r) => r.category))]);
  const productGroups = categories.map((key) => ({
    key,
    label: productLabel(key),
    rows: rows.filter((r) => r.category === key).sort(byPriority),
  }));

  return { productGroups };
}

export function AllocationSheetSection({
  rows,
  date,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
}: AllocationSheetSectionProps) {
  const [category, setCategory] = useState<AllocationProduct>(DEFAULT_PRODUCT);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit>(DEFAULT_UNIT);
  const [instruction, setInstruction] = useState("");
  const [customer, setCustomer] = useState("");
  const [priority, setPriority] = useState<Priority>("standard");
  // Inline per-cell editing — which cell (row id + field) is open. Each editable
  // cell commits straight to the row via onUpdate, so there is no row draft to
  // reconcile. A product edit keys on the group's first row and applies to all.
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: CellField;
  } | null>(null);
  // The open cell — used to detect clicks outside it (close on outside click).
  const activeCellRef = useRef<HTMLTableCellElement>(null);
  // View filter: narrow the printed sheet to one product / area ("all" = show
  // every group). Presentation only — the underlying rows are untouched.
  const [filter, setFilter] = useState<AllocationProduct | "all">("all");

  const closeCell = useCallback(() => setEditingCell(null), []);

  // Close the open cell on a click anywhere outside it, or on Escape. The inline
  // selects render inside the cell, so picking from them counts as inside and
  // doesn't close the editor prematurely.
  useEffect(() => {
    if (!editingCell) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!activeCellRef.current?.contains(e.target as Node)) closeCell();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCell();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [editingCell, closeCell]);

  // Top form is add-only — editing happens inline per cell (see editingCell).
  const resetForm = () => {
    setCategory(DEFAULT_PRODUCT);
    setQty("");
    setUnit(DEFAULT_UNIT);
    setInstruction("");
    setCustomer("");
    setPriority("standard");
  };

  const submit = () => {
    if (!instruction.trim()) return; // an instruction line needs text
    onAdd({
      category,
      qty: Number(qty) || 0,
      unit,
      instruction: instruction.trim(),
      customer: customer.trim(),
      priority,
    });
    resetForm();
  };

  const { productGroups } = buildSheet(rows);

  // Product / area options that actually have rows, so the filter never offers
  // an empty group.
  const filterableGroups = productGroups.map((g) => ({
    key: g.key as AllocationProduct,
    count: g.rows.length,
  }));
  const filterActive = filter !== "all";
  const visibleGroups = filterActive
    ? productGroups.filter((g) => g.key === filter)
    : productGroups;
  // Flatten the product groups into a single ordered list (product, then rule
  // type within each product) — the sheet is a flat table; product shows per row.
  const flatRows = visibleGroups.flatMap((g) => g.rows);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <ClipboardList size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                Floor Instructions / Standing Rules
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Floor-facing rules for cutting and packaging. These appear on
                the daily allocation sheet.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
            <Legend dot="bg-red-500" label="Red = DO NOT" />
            <Legend dot="bg-amber-400" label="Yellow = DO THIS / HIGH" />
            <Legend dot="bg-slate-300" label="White = STANDARD" />
            <Legend dot="bg-slate-400" label="Gray = GENERAL NOTE" />
          </div>
        </div>
      </header>

      {/* Add / edit form */}
      <div className="grid grid-cols-1 gap-4 border-y border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:grid-cols-12">
        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="ins-category">
            Product / Area
          </label>
          <ProductSelect
            id="ins-category"
            value={category}
            onChange={setCategory}
          />
        </div>

        <div className="lg:col-span-1">
          <label className={labelClass} htmlFor="ins-priority">
            Rule type
          </label>
          <PrioritySelect
            id="ins-priority"
            value={priority}
            onChange={setPriority}
          />
        </div>

        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="ins-qty">
            Qty affected
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id="ins-qty"
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="optional"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <div className="flex w-24 shrink-0 items-center">
              <UnitSelect value={unit} onChange={setUnit} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="ins-customer">
            Customer / context
          </label>
          <input
            id="ins-customer"
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="e.g. SYSCO VIC MON"
            className={inputClass}
          />
        </div>

        <div className="lg:col-span-5">
          <label className={labelClass} htmlFor="ins-text">
            Floor instruction
          </label>
          <div className="flex items-center gap-3">
            <input
              id="ins-text"
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="e.g. B'LESS SHORT — BOX THE REST"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!instruction.trim()}
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Empty state — guide the user to add their first instruction. */}
      {rows.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No floor instructions yet"
          description="Add rules such as DO NOT SAVE PANCREAS, SAVE LEG HOCKS, or BOX TONGUES."
        />
      )}

      {/* Daily allocation sheet — product-grouped, printable instruction lines. */}
      {rows.length > 0 && (
        <div className="border-t border-slate-100 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Daily Allocation Sheet Instructions
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void exportAllocationInstructions(rows, date);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Download size={14} />
                Export to Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  void emailAllocationInstructions(rows, date);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
              >
                <Mail size={14} />
                Send by Email
              </button>
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-semibold text-red-500 transition hover:text-red-600"
              >
                Clear all
              </button>
            </div>
          </div>

          {/* Product / area tabs — narrow the printed sheet to one group. */}
          <div className="mb-4">
            <ProductFilterTabs
              value={filter}
              onChange={setFilter}
              total={rows.length}
              tabs={filterableGroups}
              withDots
            />
          </div>

          {flatRows.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {/* Real table so same-product rows can merge their Product cell
                  (rowSpan). Fixed widths keep header and rows aligned. */}
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-40" />
                  <col className="w-1" />
                  <col className="w-40" />
                  <col className="w-28" />
                  <col />
                  <col className="w-40" />
                  <col className="w-12" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 [&>th]:border-b [&>th]:border-slate-200 [&>th]:px-3 [&>th]:py-2.5">
                    <th>Product</th>
                    <th aria-hidden="true" />
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Context</th>
                    <th className="hidden sm:table-cell">Customer</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.flatMap((group) =>
                    group.rows.map((row, i) => {
                      const style = RULE_STYLES[row.priority];
                      // Is this row's given cell the one currently open?
                      const editing = (field: CellField) =>
                        editingCell?.id === row.id &&
                        editingCell.field === field;
                      const open = (field: CellField) =>
                        setEditingCell({ id: row.id, field });
                      const commit = (
                        patch: Partial<Omit<AllocationInstruction, "id">>,
                      ) => onUpdate(row.id, patch);
                      // Read cell shows a hover hint + click target; the active
                      // cell drops the hint and carries the outside-click ref.
                      const cellClass = (field: CellField) =>
                        `px-3 align-middle ${
                          editing(field)
                            ? "py-1.5"
                            : "py-2.5 cursor-pointer transition hover:bg-slate-100/70"
                        }`;

                      return (
                        <tr
                          key={row.id}
                          className="group transition hover:bg-slate-50/60 [&>td]:border-b [&>td]:border-slate-100"
                        >
                          {/* PRODUCT — merged per group, read-only. The product
                              comes from Primal, so it isn't edited inline here. */}
                          {i === 0 && (
                            <td
                              rowSpan={group.rows.length}
                              className="align-top px-3 py-2.5"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${productDotClass(group.key)}`}
                                />
                                <span
                                  className={`truncate text-xs font-bold uppercase tracking-wide ${productTextClass(group.key)}`}
                                >
                                  {group.label}
                                </span>
                              </span>
                            </td>
                          )}

                          {/* Rule-type accent bar (its own column). */}
                          <td className={`p-0 ${style.bar}`} />

                          {/* TYPE */}
                          <td
                            ref={editing("type") ? activeCellRef : undefined}
                            onClick={() => !editing("type") && open("type")}
                            className={`px-3 py-2.5 align-middle ${
                              editing("type")
                                ? ""
                                : "cursor-pointer transition hover:bg-slate-100/70"
                            }`}
                          >
                            {editing("type") ? (
                              <PrioritySelect
                                value={row.priority}
                                defaultOpen
                                flush
                                onChange={(v) => commit({ priority: v })}
                                onClose={closeCell}
                              />
                            ) : (
                              <span
                                className={`block rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
                              >
                                {priorityLabel(row.priority)}
                              </span>
                            )}
                          </td>

                          {/* QTY (number + compact unit toggle) */}
                          <td
                            ref={editing("qty") ? activeCellRef : undefined}
                            onClick={() => !editing("qty") && open("qty")}
                            className={`${cellClass("qty")} text-sm tabular-nums text-slate-900`}
                          >
                            {editing("qty") ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  autoFocus
                                  value={row.qty === 0 ? "" : row.qty}
                                  onChange={(e) =>
                                    commit({
                                      qty: clampNonNegativeInt(e.target.value),
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      closeCell();
                                    }
                                  }}
                                  placeholder="0"
                                  aria-label="Quantity"
                                  className={`${cellInputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                                />
                                <UnitToggle
                                  value={row.unit}
                                  onChange={(u) => commit({ unit: u })}
                                />
                              </div>
                            ) : row.qty > 0 ? (
                              `${row.qty} ${unitShort(row.unit)}`
                            ) : (
                              emptyCell
                            )}
                          </td>

                          {/* CONTEXT (instruction) */}
                          <td
                            ref={editing("context") ? activeCellRef : undefined}
                            onClick={() =>
                              !editing("context") && open("context")
                            }
                            className={`${cellClass("context")} text-sm text-slate-900 ${
                              editing("context") ? "" : "truncate"
                            }`}
                          >
                            {editing("context") ? (
                              <input
                                type="text"
                                autoFocus
                                value={row.instruction}
                                onChange={(e) =>
                                  commit({ instruction: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    closeCell();
                                  }
                                }}
                                aria-label="Floor instruction"
                                className={cellInputClass}
                              />
                            ) : (
                              row.instruction
                            )}
                          </td>

                          {/* CUSTOMER (plain text) */}
                          <td
                            ref={editing("customer") ? activeCellRef : undefined}
                            onClick={() =>
                              !editing("customer") && open("customer")
                            }
                            className={`hidden sm:table-cell ${cellClass("customer")} text-sm text-slate-900 ${
                              editing("customer") ? "" : "truncate"
                            }`}
                          >
                            {editing("customer") ? (
                              <input
                                type="text"
                                autoFocus
                                value={row.customer}
                                onChange={(e) =>
                                  commit({ customer: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    closeCell();
                                  }
                                }}
                                placeholder="e.g. SYSCO VIC MON"
                                aria-label="Customer / context"
                                className={cellInputClass}
                              />
                            ) : row.customer ? (
                              row.customer
                            ) : (
                              emptyCell
                            )}
                          </td>

                          {/* REMOVE — hover-revealed, after Customer. */}
                          <td className="px-2 py-2.5 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => onRemove(row.id)}
                              title="Remove"
                              aria-label="Remove instruction"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            filterActive && (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                No floor instructions for this product.
              </p>
            )
          )}
        </div>
      )}
    </section>
  );
}

// Compact unit switch for the in-cell Qty editor — there are only two units
// (PC / C/S), so a single toggle button is enough and fits the narrow column.
function UnitToggle({
  value,
  onChange,
}: {
  value: Unit;
  onChange: (value: Unit) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === "piece" ? "case" : "piece")}
      title="Toggle unit"
      aria-label={`Unit: ${unitShort(value)} (click to change)`}
      className="flex h-9 shrink-0 items-center rounded-lg border border-slate-200 px-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
    >
      {unitShort(value)}
    </button>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
