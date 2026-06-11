"use client";

import clsx from "clsx";
import {
  Check,
  ChevronDown,
  Eraser,
  Loader2,
  Minus,
  Package,
  Plus,
  Save,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import type { OrderTotals } from "../calculations";
import { clampNonNegativeInt } from "../calculations";
import type {
  AvailabilityStatus,
  CustomOrderRow,
  OrderField,
  PrimalCategory,
  PrimalGroup,
  ProductOrder,
  ProductSpec,
} from "../types";

// One order-entry row: a product spec paired with its editable order. No
// per-SKU yield — order inputs only.
export type CategorySkuRow = {
  spec: ProductSpec;
  order: ProductOrder;
};

// A group renders one section. Each of its categories is a labeled subgroup so
// the types stay distinguishable, while the quantity (Ending Stock) is shared.
export type GroupCategoryRows = {
  category: PrimalCategory;
  rows: CategorySkuRow[];
  totals: OrderTotals;
};

type PrimalGroupSectionProps = {
  group: PrimalGroup;
  categoryRows: GroupCategoryRows[];
  // Manually added (ad-hoc) rows for this group — editable spec + order.
  customRows: CustomOrderRow[];
  // Combined Today totals across every category in the group.
  groupTotals: OrderTotals;
  // Calculated Ending Stock for this group, in pieces (Available Stock −
  // Customer Orders from the Availability Chart). Read-only / derived.
  calculatedEndingStockPcs: number;
  // Availability status for this group, derived from the same Ending Stock.
  // Drives the header figure's color (OK / Low Reserve / Short).
  endingStockStatus: AvailabilityStatus;
  expanded: boolean;
  onToggle: () => void;
  activeSku: string | null;
  onRowFocus: (sku: string | null) => void;
  onChangeField: (sku: string, field: OrderField, value: number) => void;
  // Add a blank manual row to this group.
  onAddRow: () => void;
  // Edit a manual row's spec fields (SKU / name / case pack / pieces-per-case).
  onUpdateRowSpec: (id: string, patch: Partial<ProductSpec>) => void;
  // Edit a manual row's order field (cases / pieces).
  onChangeCustomField: (id: string, field: OrderField, value: number) => void;
  // Remove a manual row.
  onRemoveRow: (id: string) => void;
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
  justSaved: boolean;
  // Custom availability groups auto-persist their rows, so they hide the
  // Save/Clear footer (catalog sections show it). Defaults to shown.
  showSaveClear?: boolean;
};

export function PrimalGroupSection({
  group,
  categoryRows,
  customRows,
  groupTotals,
  calculatedEndingStockPcs,
  endingStockStatus,
  expanded,
  onToggle,
  activeSku,
  onRowFocus,
  onChangeField,
  onAddRow,
  onUpdateRowSpec,
  onChangeCustomField,
  onRemoveRow,
  onSave,
  onClear,
  saving,
  justSaved,
  showSaveClear = true,
}: PrimalGroupSectionProps) {
  // Only label per-type subgroups when the group pools more than one type
  // (e.g. Ribs); single-type groups don't need the redundant header.
  const showTypeHeaders = group.categories.length > 1;
  const itemCount =
    categoryRows.reduce((sum, c) => sum + c.rows.length, 0) + customRows.length;

  return (
    <section
      id={`primal-group-${groupSlug(group.key)}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header — click to expand/collapse */}
      <button
        type="button"
        onClick={onToggle}
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
          <Package size={16} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-wide text-slate-900">
            {group.label}
          </h3>
          <p className="text-xs text-slate-500">{itemCount} Items</p>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <HeaderTotal
            label="Today"
            cases={groupTotals.today_cases}
            pcs={groupTotals.today_pcs}
          />
          <HeaderEndingStock
            pcs={calculatedEndingStockPcs}
            status={endingStockStatus}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 table-fixed border-collapse text-sm">
              {/* Fixed column widths so the layout never shifts when a custom
                  row (whose cells hold wider <input> fields) is added. Item is
                  left flexible to absorb the remaining width; Case Pack / Cases
                  / Pieces share one width, and the remove button gets its own
                  trailing column (empty on non-custom rows). */}
              <colgroup>
                <col className="w-28" />
                <col />
                <col className="w-44" />
                <col className="w-44" />
                <col className="w-44" />
                <col className="w-16" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-2 py-2.5">Item</th>
                  <th className="px-2 py-2.5 text-center">Case Pack</th>
                  <ColGroupHead label="Today" tone="text-blue-600" />
                  <th className="px-1.5 py-2.5" aria-hidden />
                </tr>
              </thead>
              {categoryRows.map(({ category, rows, totals }) => (
                <tbody
                  key={category}
                  className="divide-y divide-slate-100 border-t border-slate-100"
                >
                  {showTypeHeaders && (
                    <tr className="bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <td className="px-4 py-1.5" colSpan={3}>
                        {category}
                        <span className="ml-2 font-normal normal-case text-slate-400">
                          {rows.length} items
                        </span>
                      </td>
                      <td className="px-1.5 py-1.5 text-center tabular-nums text-blue-600">
                        {totals.today_cases}
                      </td>
                      <td className="px-1.5 py-1.5 text-center tabular-nums text-slate-400">
                        {totals.today_pcs}
                      </td>
                      <td aria-hidden />
                    </tr>
                  )}
                  {rows.map((row) => (
                    <ProductRow
                      key={row.spec.sku}
                      row={row}
                      active={activeSku === row.spec.sku}
                      onFocus={() => onRowFocus(row.spec.sku)}
                      onBlur={() => onRowFocus(null)}
                      onChangeField={onChangeField}
                    />
                  ))}
                </tbody>
              ))}

              {/* Manually added rows + the add-row control. These flow inline
                  with the imported rows (no separate section) so a filled-in
                  line reads like any other product row. */}
              <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                {customRows.map((row) => (
                  <CustomProductRow
                    key={row.id}
                    row={row}
                    onUpdateSpec={onUpdateRowSpec}
                    onChangeField={onChangeCustomField}
                    onRemove={onRemoveRow}
                  />
                ))}
                <tr>
                  <td colSpan={6} className="px-4 py-2.5">
                    <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={onAddRow}
                      aria-label="Add item"
                      className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-1.5 text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    >
                      <Plus size={14} />
                    </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Save / Clear — hidden for auto-persisting custom sections. */}
          {showSaveClear && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
              <button
                type="button"
                onClick={onClear}
                disabled={saving}
                className="flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
              >
                <Eraser size={14} />
                Clear
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : justSaved ? (
                  <Check size={14} />
                ) : (
                  <Save size={14} />
                )}
                {saving ? "Saving…" : justSaved ? "Saved" : `Save ${group.label}`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ------------------------------- Row --------------------------------
function ProductRow({
  row,
  active,
  onFocus,
  onBlur,
  onChangeField,
}: {
  row: CategorySkuRow;
  active: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChangeField: (sku: string, field: OrderField, value: number) => void;
}) {
  const { spec, order } = row;
  return (
    <tr
      onFocus={onFocus}
      onBlur={onBlur}
      className={clsx(
        "transition-colors",
        active ? "bg-blue-50/50" : "hover:bg-slate-50/60",
      )}
    >
      <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700">
        {spec.sku}
      </td>
      <td className="px-2 py-2">
        <span className="font-medium text-slate-800">{spec.name}</span>
      </td>
      <td className="px-2 py-2 text-center text-xs text-slate-500">
        {casePackLabel(spec.casePack)}
      </td>

      <NumberCell
        value={order.today_cases}
        onChange={(v) => onChangeField(spec.sku, "today_cases", v)}
        ariaLabel={`${spec.name} today cases`}
        accent="blue"
      />
      <NumberCell
        value={order.today_pcs}
        onChange={(v) => onChangeField(spec.sku, "today_pcs", v)}
        ariaLabel={`${spec.name} today pieces`}
      />
      {/* Trailing column reserved for the custom rows' remove button. */}
      <td aria-hidden />
    </tr>
  );
}

const ACCENTS: Record<string, string> = {
  blue: "focus:border-blue-400 focus:ring-blue-100",
  emerald: "focus:border-emerald-400 focus:ring-emerald-100",
  violet: "focus:border-violet-400 focus:ring-violet-100",
  none: "focus:border-slate-400 focus:ring-slate-100",
};

// The −/input/+ stepper, without a table cell wrapper, so it can be composed
// both as a standalone NumberCell and alongside other controls (e.g. the
// custom row's delete button).
function StepInput({
  value,
  onChange,
  ariaLabel,
  accent = "none",
}: {
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  accent?: keyof typeof ACCENTS;
}) {
  const blank = useBlankZeroInput(value);
  return (
    <div className="flex items-center justify-center gap-1.5">
      <StepButton
        ariaLabel={`Decrease ${ariaLabel}`}
        onClick={() => onChange(clampNonNegativeInt(value - 1))}
        disabled={value <= 0}
      >
        <Minus size={14} />
      </StepButton>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        {...blank}
        aria-label={ariaLabel}
        onChange={(e) => onChange(clampNonNegativeInt(e.target.value))}
        className={clsx(
          "h-10 w-20 rounded-lg border border-transparent bg-white text-center text-sm font-semibold tabular-nums text-slate-900 outline-none transition focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          ACCENTS[accent],
        )}
      />
      <StepButton
        ariaLabel={`Increase ${ariaLabel}`}
        onClick={() => onChange(clampNonNegativeInt(value + 1))}
      >
        <Plus size={14} />
      </StepButton>
    </div>
  );
}

function NumberCell(props: {
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <td className="px-1.5 py-2">
      <StepInput {...props} />
    </td>
  );
}

// ---------------------------- Custom row ----------------------------
// A manually added line: SKU, name and case pack are free-text, plus the
// cases/pieces order, and it can be deleted. Case pack is a plain label here
// (no pieces-per-case divisor); pieces are entered directly.
function CustomProductRow({
  row,
  onUpdateSpec,
  onChangeField,
  onRemove,
}: {
  row: CustomOrderRow;
  onUpdateSpec: (id: string, patch: Partial<ProductSpec>) => void;
  onChangeField: (id: string, field: OrderField, value: number) => void;
  onRemove: (id: string) => void;
}) {
  const { id, spec, order } = row;
  const label = spec.name || spec.sku || "new item";
  return (
    <tr className="transition-colors hover:bg-slate-50/60">
      <td className="px-4 py-2">
        <input
          value={spec.sku}
          onChange={(e) => onUpdateSpec(id, { sku: e.target.value })}
          placeholder="SKU"
          aria-label="Custom item SKU"
          className="-ml-2 h-9 w-full rounded-lg border border-transparent bg-transparent px-2 font-mono text-xs font-semibold text-slate-700 outline-none transition hover:bg-slate-50 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={spec.name}
          onChange={(e) => onUpdateSpec(id, { name: e.target.value })}
          placeholder="Item name"
          aria-label="Custom item name"
          className="-ml-2 h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium text-slate-800 outline-none transition hover:bg-slate-50 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={spec.casePack}
          onChange={(e) => onUpdateSpec(id, { casePack: e.target.value })}
          placeholder="Case pack"
          aria-label="Custom item case pack"
          className="h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-center text-xs text-slate-600 outline-none transition hover:bg-slate-50 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
        />
      </td>

      <NumberCell
        value={order.today_cases}
        onChange={(v) => onChangeField(id, "today_cases", v)}
        ariaLabel={`${label} today cases`}
        accent="blue"
      />
      <NumberCell
        value={order.today_pcs}
        onChange={(v) => onChangeField(id, "today_pcs", v)}
        ariaLabel={`${label} today pieces`}
      />
      {/* Remove button in its own trailing column so the Pieces stepper stays
          identical to the catalog rows. */}
      <td className="px-1.5 py-2">
        <div className="flex justify-center">
          <StepButton
            ariaLabel={`Remove ${label}`}
            onClick={() => onRemove(id)}
            className="hover:border-red-200 hover:bg-red-50 hover:text-red-500"
          >
            <X size={14} />
          </StepButton>
        </div>
      </td>
    </tr>
  );
}

function StepButton({
  ariaLabel,
  onClick,
  disabled,
  className,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

// --------------------------- Small parts ----------------------------
function ColGroupHead({ label, tone }: { label: string; tone: string }) {
  return (
    <>
      <th className={clsx("px-1.5 py-2.5 text-center", tone)}>
        {label}
        <span className="block text-[9px] font-normal text-slate-400">Cases</span>
      </th>
      <th className="px-1.5 py-2.5 text-center text-slate-400">
        <span className="block">&nbsp;</span>
        <span className="block text-[9px] font-normal text-slate-400">Pieces</span>
      </th>
    </>
  );
}

function HeaderTotal({
  label,
  cases,
  pcs,
}: {
  label: string;
  cases: number;
  pcs: number;
}) {
  return (
    <div className="hidden text-right sm:block">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-xs font-bold tabular-nums text-slate-700">
        {cases} cases · {pcs} pcs
      </p>
    </div>
  );
}

// Calculated Ending Stock summary in the section header — pieces only, since
// it is group-level (mixed case packs make "cases" undefined here).
// Header figure colored by availability status, matching the Availability
// Chart's status palette: OK → emerald, Low Reserve → amber, Short → red.
const ENDING_STOCK_STATUS_COLORS: Record<AvailabilityStatus, string> = {
  OK: "text-emerald-600",
  "Low Reserve": "text-amber-600",
  Short: "text-red-600",
};

function HeaderEndingStock({
  pcs,
  status,
}: {
  pcs: number;
  status: AvailabilityStatus;
}) {
  return (
    <div className="hidden text-right sm:block">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Ending Stock
      </p>
      <p
        className={clsx(
          "text-xs font-bold tabular-nums",
          ENDING_STOCK_STATUS_COLORS[status],
        )}
      >
        {pcs.toLocaleString()} pcs
      </p>
    </div>
  );
}

// Case Pack specs read like "6 (20-22 KG)" / "240 (TOTE)". Show just the pack
// count, dropping the parenthetical weight/unit annotation.
function casePackLabel(casePack: string): string {
  return casePack.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function groupSlug(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
