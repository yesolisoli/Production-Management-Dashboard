"use client";

import { useState } from "react";
import { Check, ClipboardList, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  ALLOCATION_PRODUCTS,
  DEFAULT_PRODUCT,
  productLabel,
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
  onAdd: (instruction: Omit<AllocationInstruction, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<AllocationInstruction, "id">>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

// Rule type → guidance-card styles. Each instruction reads as floor guidance,
// colour-coded by rule type:
//   dont = Red (DO NOT) · do = Yellow (DO THIS) · standard = White · note = Gray.
const RULE_STYLES: Record<
  Priority,
  { border: string; tint: string; badge: string; colorWord: string }
> = {
  dont: {
    border: "border-l-red-500",
    tint: "bg-red-50",
    badge: "bg-red-100 text-red-700",
    colorWord: "RED",
  },
  do: {
    border: "border-l-amber-400",
    tint: "bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
    colorWord: "YELLOW",
  },
  standard: {
    border: "border-l-slate-300",
    tint: "bg-white",
    badge: "bg-slate-100 text-slate-600",
    colorWord: "WHITE",
  },
  note: {
    border: "border-l-slate-400",
    tint: "bg-slate-50",
    badge: "bg-slate-200 text-slate-700",
    colorWord: "GRAY",
  },
};

// Within a group, red DO NOT rows come first, then yellow, white, then gray.
const PRIORITY_RANK: Record<Priority, number> = {
  dont: 0,
  do: 1,
  standard: 2,
  note: 3,
};

// Derive the printable sheet from raw rows (no extra state). Product groups
// follow the Primal group order; GENERAL NOTE lines collapse into one
// "Daily Allocation Sheet Instructions" → Daily Standing Rules block.
function buildSheet(rows: AllocationInstruction[]) {
  const byPriority = (a: AllocationInstruction, b: AllocationInstruction) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

  const productGroups = ALLOCATION_PRODUCTS.map((group) => ({
    key: group.key,
    label: productLabel(group.key),
    rows: rows
      .filter((r) => r.category === group.key && r.priority !== "note")
      .sort(byPriority),
  })).filter((g) => g.rows.length > 0);

  const standingRules = rows
    .filter((r) => r.priority === "note")
    .sort(byPriority);

  return { productGroups, standingRules };
}

export function AllocationSheetSection({
  rows,
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

  const resetForm = () => {
    setCategory(DEFAULT_PRODUCT);
    setQty("");
    setInstruction("");
    setCustomer("");
    setPriority("standard");
    setEditingId(null);
  };

  const submit = () => {
    if (!instruction.trim()) return; // an instruction line needs text
    const payload = {
      category,
      qty: Number(qty) || 0,
      instruction: instruction.trim(),
      customer: customer.trim(),
      priority,
    };
    if (editingId) onUpdate(editingId, payload);
    else onAdd(payload);
    resetForm();
  };

  const startEdit = (row: AllocationInstruction) => {
    setCategory(row.category);
    setQty(row.qty ? String(row.qty) : "");
    setInstruction(row.instruction);
    setCustomer(row.customer);
    setPriority(row.priority);
    setEditingId(row.id);
  };

  const { productGroups, standingRules } = buildSheet(rows);

  // Product / area options that actually have rows, so the filter never offers
  // an empty group. Standing rules live under "all" only.
  const filterableGroups = productGroups.map((g) => ({
    key: g.key as AllocationProduct,
    count: g.rows.length,
  }));
  const filterActive = filter !== "all";
  const visibleGroups = filterActive
    ? productGroups.filter((g) => g.key === filter)
    : productGroups;
  const visibleStandingRules = filterActive ? [] : standingRules;

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
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold text-red-500 transition hover:text-red-600"
            >
              Clear all
            </button>
          </div>

          {/* Product / area tabs — narrow the printed sheet to one group. */}
          <div className="mb-4">
            <ProductFilterTabs
              value={filter}
              onChange={setFilter}
              total={rows.length}
              tabs={filterableGroups}
            />
          </div>

          <div className="flex flex-col gap-5">
            {visibleGroups.map((group) => (
              <SheetGroup key={group.key} title={group.label}>
                {group.rows.map((row) => (
                  <SheetRow
                    key={row.id}
                    row={row}
                    onEdit={() => startEdit(row)}
                    onRemove={() => onRemove(row.id)}
                  />
                ))}
              </SheetGroup>
            ))}

            {visibleStandingRules.length > 0 && (
              <SheetGroup title="Daily Standing Rules">
                {visibleStandingRules.map((row) => (
                  <StandingRuleRow
                    key={row.id}
                    row={row}
                    onEdit={() => startEdit(row)}
                    onRemove={() => onRemove(row.id)}
                  />
                ))}
              </SheetGroup>
            )}

            {filterActive && visibleGroups.length === 0 && (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                No floor instructions for this product.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// One product / area block: an uppercase header, a divider, then its rows.
function SheetGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900">
        {title}
      </h4>
      <div className="mt-1 border-t border-slate-300" />
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

// A compact, printable sheet line: QTY · INSTRUCTION · CUSTOMER · color tag.
// Qty/customer support the instruction rather than dominating it. Edit/remove
// stay available but visually secondary (dim until row hover/focus).
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
      className={`group flex items-baseline gap-3 border-l-2 ${style.border} ${style.tint} py-1.5 pl-3 pr-1`}
    >
      <span className="w-16 shrink-0 text-xs font-bold uppercase tabular-nums text-slate-700">
        {row.qty > 0 ? `${row.qty} pc` : ""}
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold uppercase text-slate-800">
        {row.instruction}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-xs uppercase text-slate-500 sm:block">
        {row.customer || "—"}
      </span>
      <RowTrailing
        colorWord={style.colorWord}
        badge={style.badge}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    </div>
  );
}

// Standing-rule line mirrors the reference: [COLOR] then the rule text.
function StandingRuleRow({
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
      className={`group flex items-baseline gap-3 border-l-2 ${style.border} ${style.tint} py-1.5 pl-3 pr-1`}
    >
      <span
        className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold uppercase ${style.badge}`}
      >
        {style.colorWord}
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold uppercase text-slate-800">
        {row.instruction}
      </span>
      <RowActions onEdit={onEdit} onRemove={onRemove} />
    </div>
  );
}

// Right side of a product row: color tag + secondary edit/remove actions.
function RowTrailing({
  colorWord,
  badge,
  onEdit,
  onRemove,
}: {
  colorWord: string;
  badge: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={`hidden w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold uppercase sm:inline-block ${badge}`}
      >
        {colorWord}
      </span>
      <RowActions onEdit={onEdit} onRemove={onRemove} />
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
