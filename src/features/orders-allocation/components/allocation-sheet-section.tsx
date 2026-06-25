"use client";

import { useState } from "react";
import {
  Check,
  ClipboardList,
  Download,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { exportAllocationInstructions } from "../allocation-export";
import {
  DEFAULT_PRODUCT,
  priorityLabel,
  productDotClass,
  productLabel,
  productTextClass,
  sortProductKeys,
  type AllocationInstruction,
  type AllocationProduct,
  type Priority,
} from "../types";
import { PrioritySelect, ProductSelect } from "./product-select";
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

// Rule type → guidance styles. The row stays on a plain background; the type is
// shown by the left accent bar + the colour tag only (no row tint).
//   dont = Red (DO NOT) · do = Yellow (DO THIS) · standard = White.
const RULE_STYLES: Record<Priority, { border: string; badge: string }> = {
  dont: {
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-700",
  },
  do: {
    border: "border-l-amber-400",
    badge: "bg-amber-100 text-amber-800",
  },
  standard: {
    border: "border-l-slate-300",
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
  const [instruction, setInstruction] = useState("");
  const [customer, setCustomer] = useState("");
  const [priority, setPriority] = useState<Priority>("standard");
  const [editingId, setEditingId] = useState<string | null>(null);
  // View filter: narrow the printed sheet to one product / area ("all" = show
  // every group). Presentation only — the underlying rows are untouched.
  const [filter, setFilter] = useState<AllocationProduct | "all">("all");

  // Top form is add-only — editing happens inline on each row (see editingId).
  const resetForm = () => {
    setCategory(DEFAULT_PRODUCT);
    setQty("");
    setInstruction("");
    setCustomer("");
    setPriority("standard");
  };

  const submit = () => {
    if (!instruction.trim()) return; // an instruction line needs text
    onAdd({
      category,
      qty: Number(qty) || 0,
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <ClipboardList size={16} />
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              Floor Instructions / Standing Rules
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
            <Legend dot="bg-red-500" label="Red = DO NOT" />
            <Legend dot="bg-amber-400" label="Yellow = DO THIS / HIGH" />
            <Legend dot="bg-slate-300" label="White = STANDARD" />
            <Legend dot="bg-slate-400" label="Gray = GENERAL NOTE" />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Floor-facing rules for cutting and packaging. These appear on the
          daily allocation sheet.
        </p>
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

        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="ins-priority">
            Rule type
          </label>
          <PrioritySelect
            id="ins-priority"
            value={priority}
            onChange={setPriority}
          />
        </div>

        <div className="lg:col-span-1">
          <label className={labelClass} htmlFor="ins-qty">
            Qty affected
          </label>
          <input
            id="ins-qty"
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="optional"
            className={inputClass}
          />
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

        <div className="lg:col-span-3">
          <label className={labelClass} htmlFor="ins-text">
            Floor instruction
          </label>
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
            className={inputClass}
          />
        </div>

        <div className="flex flex-col lg:col-span-2">
          <span className={`${labelClass} opacity-0`} aria-hidden="true">
            Add
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!instruction.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Empty state — guide the user to add their first instruction. */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center sm:py-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ClipboardList size={20} />
          </span>
          <p className="text-sm font-semibold text-slate-600">
            No floor instructions yet
          </p>
          <p className="max-w-md text-xs text-slate-400">
            Add rules such as DO NOT SAVE PANCREAS, SAVE LEG HOCKS, or BOX
            TONGUES.
          </p>
        </div>
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

          {visibleGroups.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="divide-y divide-slate-200">
                {visibleGroups.map((group) => (
                  <SheetGroup
                    key={group.key}
                    productKey={group.key}
                    title={group.label}
                    count={group.rows.length}
                  >
                    {group.rows.map((row) =>
                      editingId === row.id ? (
                        <InlineRowEditor
                          key={row.id}
                          row={row}
                          onSave={(patch) => {
                            onUpdate(row.id, patch);
                            setEditingId(null);
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <SheetRow
                          key={row.id}
                          row={row}
                          onEdit={() => setEditingId(row.id)}
                          onRemove={() => onRemove(row.id)}
                        />
                      ),
                    )}
                  </SheetGroup>
                ))}
              </div>
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

// One product / area band: a full-width colour-coded header (dot + name +
// count) stacked above its instruction rows. The rule-type accent lives on each
// row, so the group itself carries no left stripe.
function SheetGroup({
  productKey,
  title,
  count,
  children,
}: {
  productKey: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 bg-slate-50/70 px-4 py-2.5">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${productDotClass(productKey)}`}
        />
        <span
          className={`text-sm font-bold uppercase tracking-wide ${productTextClass(productKey)}`}
        >
          {title}
        </span>
        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
          {count}
        </span>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

// One sheet line: a rule-type badge, a fixed QTY slot, an optional customer /
// context pill, then the instruction text — with edit/remove actions that stay
// dim until the row is hovered or focused. A left accent bar keeps the rule
// type (DO THIS / DO NOT / STANDARD) readable at a glance.
function SheetRow({
  row,
  onEdit,
  onRemove,
}: {
  row: AllocationInstruction;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const style = RULE_STYLES[row.priority];
  return (
    <div
      className={`group flex items-center gap-3 border-l-4 ${style.border} py-2.5 pl-3 pr-4 transition hover:bg-slate-50/60`}
    >
      <span
        className={`w-22 shrink-0 rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
      >
        {priorityLabel(row.priority)}
      </span>
      <span className="w-12 shrink-0 text-xs font-bold uppercase tabular-nums text-slate-700">
        {row.qty > 0 ? `${row.qty} pc` : ""}
      </span>
      {row.customer ? (
        <span className="hidden shrink-0 truncate rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:inline-block">
          {row.customer}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold uppercase text-slate-800">
        {row.instruction}
      </span>
      <RowActions onEdit={onEdit} onRemove={onRemove} />
    </div>
  );
}

// Inline editor — replaces a row in place when its edit button is clicked, so
// the operator edits where the row lives instead of jumping to the top form.
// Mirrors the add form's fields; local state seeds from the row and is committed
// on Save. Enter saves, Escape cancels.
function InlineRowEditor({
  row,
  onSave,
  onCancel,
}: {
  row: AllocationInstruction;
  onSave: (patch: Omit<AllocationInstruction, "id">) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<AllocationProduct>(row.category);
  const [qty, setQty] = useState(row.qty ? String(row.qty) : "");
  const [instruction, setInstruction] = useState(row.instruction);
  const [customer, setCustomer] = useState(row.customer);
  const [priority, setPriority] = useState<Priority>(row.priority);

  const save = () => {
    if (!instruction.trim()) return;
    onSave({
      category,
      qty: Number(qty) || 0,
      instruction: instruction.trim(),
      customer: customer.trim(),
      priority,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 border-l-4 border-l-slate-400 bg-slate-50 py-3 pl-3 pr-1 lg:grid-cols-12 lg:items-end">
      <div className="lg:col-span-2">
        <label className={labelClass}>Product / Area</label>
        <ProductSelect value={category} onChange={setCategory} />
      </div>
      <div className="lg:col-span-2">
        <label className={labelClass}>Rule type</label>
        <PrioritySelect value={priority} onChange={setPriority} />
      </div>
      <div className="lg:col-span-1">
        <label className={labelClass}>Qty affected</label>
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="optional"
          className={inputClass}
        />
      </div>
      <div className="lg:col-span-2">
        <label className={labelClass}>Customer / context</label>
        <input
          type="text"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="lg:col-span-3">
        <label className={labelClass}>Floor instruction</label>
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
          autoFocus
          className={inputClass}
        />
      </div>
      <div className="flex items-center justify-end gap-2 lg:col-span-2">
        <button
          type="button"
          onClick={save}
          disabled={!instruction.trim()}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
        >
          <Check size={16} />
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <X size={15} />
          Cancel
        </button>
      </div>
    </div>
  );
}

// Edit/remove buttons — dim by default, full strength on row hover or focus.
function RowActions({
  onEdit,
  onRemove,
}: {
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-40 transition group-hover:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={onEdit}
        title="Edit"
        aria-label="Edit instruction"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        aria-label="Remove instruction"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={14} />
      </button>
    </div>
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
