"use client";

import clsx from "clsx";
import { Check, ChevronDown, Loader2, Package, Save } from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import type { OrderTotals } from "../calculations";
import { clampNonNegativeInt } from "../calculations";
import type {
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
// the types stay distinguishable, while the quantity (Calc O/S) is shared.
export type GroupCategoryRows = {
  category: PrimalCategory;
  rows: CategorySkuRow[];
  totals: OrderTotals;
};

type PrimalGroupSectionProps = {
  group: PrimalGroup;
  categoryRows: GroupCategoryRows[];
  // Combined Today totals across every category in the group.
  groupTotals: OrderTotals;
  // Calculated Today's O/S for this group, in pieces (Available Stock −
  // Customer Orders from the Availability Chart). Read-only / derived.
  calculatedOverstockPcs: number;
  expanded: boolean;
  onToggle: () => void;
  activeSku: string | null;
  onRowFocus: (sku: string | null) => void;
  onChangeField: (sku: string, field: OrderField, value: number) => void;
  onBumpCases: (delta: number) => void;
  onClear: () => void;
  onSave: () => void;
  saving: boolean;
  justSaved: boolean;
};

export function PrimalGroupSection({
  group,
  categoryRows,
  groupTotals,
  calculatedOverstockPcs,
  expanded,
  onToggle,
  activeSku,
  onRowFocus,
  onChangeField,
  onBumpCases,
  onClear,
  onSave,
  saving,
  justSaved,
}: PrimalGroupSectionProps) {
  // Only label per-type subgroups when the group pools more than one type
  // (e.g. Ribs); single-type groups don't need the redundant header.
  const showTypeHeaders = group.categories.length > 1;
  const itemCount = categoryRows.reduce((sum, c) => sum + c.rows.length, 0);

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
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
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
          <HeaderOverstock pcs={calculatedOverstockPcs} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-2 py-2.5">Item</th>
                  <th className="px-2 py-2.5">Case Pack</th>
                  <ColGroupHead label="Today" tone="text-blue-600" />
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
            </table>
          </div>

          {/* Group totals — today's manual inputs, then the derived
              Calculated O/S (pieces; group-level, read-only). */}
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-4 py-3 sm:grid-cols-3">
            <TotalStat
              label="Today total cases"
              value={groupTotals.today_cases}
              tone="blue"
            />
            <TotalStat
              label="Today total pcs"
              value={groupTotals.today_pcs}
              tone="blue"
            />
            <TotalStat
              label="Calculated O/S pcs"
              value={calculatedOverstockPcs}
              tone="violet"
            />
          </div>

          {/* Bulk actions + save */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Bulk Today
              </span>
              <BulkButton onClick={() => onBumpCases(10)}>+10 Cases</BulkButton>
              <BulkButton onClick={() => onBumpCases(50)}>+50 Cases</BulkButton>
              <BulkButton onClick={() => onBumpCases(100)}>+100 Cases</BulkButton>
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-200/60"
              >
                Clear
              </button>
            </div>

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
      <td className="px-2 py-2 text-xs text-slate-500">{spec.casePack}</td>

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
    </tr>
  );
}

const ACCENTS: Record<string, string> = {
  blue: "focus:border-blue-400 focus:ring-blue-100",
  emerald: "focus:border-emerald-400 focus:ring-emerald-100",
  violet: "focus:border-violet-400 focus:ring-violet-100",
  none: "focus:border-slate-400 focus:ring-slate-100",
};

function NumberCell({
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
    <td className="px-1.5 py-2">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        {...blank}
        aria-label={ariaLabel}
        onChange={(e) => onChange(clampNonNegativeInt(e.target.value))}
        className={clsx(
          "h-10 w-20 rounded-lg border border-slate-200 bg-white text-center text-sm font-semibold tabular-nums text-slate-900 outline-none transition focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          ACCENTS[accent],
        )}
      />
    </td>
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

const TOTAL_TONES: Record<string, string> = {
  blue: "text-blue-600",
  violet: "text-violet-600",
};

function TotalStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof TOTAL_TONES;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={clsx(
          "text-2xl font-extrabold tabular-nums",
          TOTAL_TONES[tone],
        )}
      >
        {value}
      </p>
    </div>
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

// Calculated Today's O/S summary in the section header — pieces only, since
// O/S is group-level (mixed case packs make "cases" undefined here).
function HeaderOverstock({ pcs }: { pcs: number }) {
  return (
    <div className="hidden text-right sm:block">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Calc O/S
      </p>
      <p
        className={clsx(
          "text-xs font-bold tabular-nums",
          pcs < 0 ? "text-red-600" : "text-violet-600",
        )}
      >
        {pcs.toLocaleString()} pcs
      </p>
    </div>
  );
}

function BulkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
    >
      {children}
    </button>
  );
}

function groupSlug(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function primalGroupSlug(key: string): string {
  return groupSlug(key);
}
