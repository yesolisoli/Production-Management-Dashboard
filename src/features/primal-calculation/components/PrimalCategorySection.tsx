"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Package,
  Save,
} from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import type { OrderTotals, ProductYield } from "../calculations";
import { clampNonNegativeInt } from "../calculations";
import type { OrderField, PrimalCategory } from "../types";

type PrimalCategorySectionProps = {
  category: PrimalCategory;
  rows: ProductYield[];
  totals: OrderTotals;
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

export function PrimalCategorySection({
  category,
  rows,
  totals,
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
}: PrimalCategorySectionProps) {
  const overAllocatedCount = rows.filter((r) => r.overAllocated).length;

  return (
    <section
      id={`primal-cat-${slug(category)}`}
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
            {category}
          </h3>
          <p className="text-xs text-slate-500">{rows.length} Items</p>
        </div>

        {overAllocatedCount > 0 && (
          <span className="ml-1 flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            <AlertTriangle size={12} />
            {overAllocatedCount} over yield
          </span>
        )}

        <div className="ml-auto flex items-center gap-4">
          <HeaderTotal label="Today" cases={totals.today_cases} pcs={totals.today_pcs} />
          <HeaderTotal label="Tomorrow" cases={totals.tmrw_cases} pcs={totals.tmrw_pcs} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-2 py-2.5">Item</th>
                  <th className="px-2 py-2.5">Case Pack</th>
                  <th className="px-2 py-2.5 text-right">Yield (pcs)</th>
                  <ColGroupHead label="Today" tone="text-blue-600" />
                  <ColGroupHead label="Tomorrow" tone="text-emerald-600" />
                  <ColGroupHead label="Overstock (O/S)" tone="text-violet-600" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
            </table>
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
              {saving ? "Saving…" : justSaved ? "Saved" : `Save ${category}`}
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
  row: ProductYield;
  active: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChangeField: (sku: string, field: OrderField, value: number) => void;
}) {
  const { spec, order, expectedPieces, overAllocated } = row;
  return (
    <tr
      onFocus={onFocus}
      onBlur={onBlur}
      className={clsx(
        "transition-colors",
        overAllocated
          ? "bg-red-50/70"
          : active
            ? "bg-blue-50/50"
            : "hover:bg-slate-50/60",
      )}
    >
      <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700">
        {spec.sku}
      </td>
      <td className="px-2 py-2">
        <span className="font-medium text-slate-800">{spec.name}</span>
        {overAllocated && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-red-600">
            <AlertTriangle size={11} />
            Over available yield ({expectedPieces} pcs)
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-xs text-slate-500">{spec.casePack}</td>
      <td
        className={clsx(
          "px-2 py-2 text-right text-xs font-semibold tabular-nums",
          overAllocated ? "text-red-600" : "text-slate-400",
        )}
      >
        {expectedPieces.toLocaleString()}
      </td>

      <NumberCell
        value={order.today_cases}
        invalid={overAllocated}
        onChange={(v) => onChangeField(spec.sku, "today_cases", v)}
        ariaLabel={`${spec.name} today cases`}
        accent="blue"
      />
      <NumberCell
        value={order.today_pcs}
        invalid={overAllocated}
        onChange={(v) => onChangeField(spec.sku, "today_pcs", v)}
        ariaLabel={`${spec.name} today pieces`}
      />
      <NumberCell
        value={order.tmrw_cases}
        invalid={overAllocated}
        onChange={(v) => onChangeField(spec.sku, "tmrw_cases", v)}
        ariaLabel={`${spec.name} tomorrow cases`}
        accent="emerald"
      />
      <NumberCell
        value={order.tmrw_pcs}
        invalid={overAllocated}
        onChange={(v) => onChangeField(spec.sku, "tmrw_pcs", v)}
        ariaLabel={`${spec.name} tomorrow pieces`}
      />
      <NumberCell
        value={order.overstock_cases}
        onChange={(v) => onChangeField(spec.sku, "overstock_cases", v)}
        ariaLabel={`${spec.name} overstock cases`}
        accent="violet"
      />
      <NumberCell
        value={order.overstock_pcs}
        onChange={(v) => onChangeField(spec.sku, "overstock_pcs", v)}
        ariaLabel={`${spec.name} overstock pieces`}
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
  invalid = false,
}: {
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  accent?: keyof typeof ACCENTS;
  invalid?: boolean;
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
          "h-10 w-20 rounded-lg border bg-white text-center text-sm font-semibold tabular-nums text-slate-900 outline-none transition focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          invalid ? "border-red-300 bg-red-50" : "border-slate-200",
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

function slug(category: PrimalCategory): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function categorySlug(category: PrimalCategory): string {
  return slug(category);
}
