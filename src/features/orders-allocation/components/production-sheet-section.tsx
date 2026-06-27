"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Box,
  Check,
  ChevronDown,
  Info,
  Plus,
  X,
} from "lucide-react";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import {
  computeFinish,
  formatRouteSummary,
  INSTRUCTION_ROW_SKU_PREFIX,
  reconcileRoutes,
  type RouteReconciliation,
} from "../calculations";
import { fromTimeInputValue } from "../route-printing";
import { CustomSelect, type SelectOption } from "./custom-select";
import { ProductFilterTabs } from "./product-filter-tabs";
import { TimeInput } from "./time-input";
import {
  CUT_PHASES,
  cutPhaseLabel,
  DEFAULT_CUT_PHASE,
  defaultProductionMeta,
  PRODUCTION_ROOMS,
  productionRoomLabel,
  productDotClass,
  sortProductKeys,
  UNITS,
  unitShort,
  type AllocationProduct,
  type CutPhase,
  type ProductionMeta,
  type ProductionRoom,
  type ProductionRow,
  type Unit,
} from "../types";

// Ordered quantity a route split reconciles against, in the line's chosen unit.
function routeTarget(row: ProductionRow, unit: Unit): number {
  return unit === "case" ? row.qtyCases : row.qtyPcs;
}

// The production cells the operator can edit in place (FINISH is derived, the
// identity columns come from Primal).
type CellField = "room" | "start" | "secPerPc" | "cutters" | "routes";

// "Today's Production Sheet" — the SKU-level cut plan. The rows are DERIVED from
// Primal demand (SKU / name / ordered qty); the operator overlays the
// operational columns (room / start / sec-per-pc / cutters / phase / delivery
// routes), which are the only persisted values. FINISH is itself DERIVED (start
// + sec/pc * pieces, via computeFinish) — never entered or stored. Presentation
// only — every change is forwarded to the parent's state hook.
type ProductionSheetSectionProps = {
  rows: ProductionRow[];
  meta: Record<string, ProductionMeta>;
  onSetMeta: (sku: string, patch: Partial<ProductionMeta>) => void;
};

// Solid per-room dot colour for the room picker / read cell.
const ROOM_DOT_CLASSES: Record<ProductionRoom, string> = {
  main: "bg-emerald-500",
  second: "bg-sky-500",
  overflow: "bg-amber-400",
};

// Room options for the inline picker — dots from the single map above.
const ROOM_OPTIONS: readonly SelectOption<ProductionRoom>[] =
  PRODUCTION_ROOMS.map((room) => ({
    value: room.value,
    label: room.label,
    dotClass: ROOM_DOT_CLASSES[room.value],
  }));

// min-w-0 keeps the input from forcing its table-fixed column wider than the
// colgroup size (so the row keeps the same column widths in read and edit mode).
const cellInputClass =
  "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

// Muted placeholder for an empty operational value in a read row.
const emptyCell = <span className="text-slate-300">—</span>;

// Validation chip for a line's route split vs its ordered qty in the line's
// chosen unit: green when fully assigned, amber when some are still unrouted,
// red when over-assigned. The unit tag (PC / C/S) follows the line's routeUnit.
function RouteBalance({
  recon,
  unit,
  piecesPerCase,
}: {
  recon: RouteReconciliation;
  unit: Unit;
  piecesPerCase: number;
}) {
  const { status, remaining, assigned, target } = recon;
  const tag = unitShort(unit);
  // Express a route-unit quantity in the other unit so the detail shows both
  // cases and pieces. Cases scale up cleanly; pieces -> cases can be fractional.
  const otherUnit: Unit = unit === "case" ? "piece" : "case";
  const otherTag = unitShort(otherUnit);
  const toOther = (qty: number) =>
    unit === "case" ? qty * piecesPerCase : qty / piecesPerCase;
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);

  const balanced = status === "balanced";
  const over = status === "over";
  const left = over ? -remaining : remaining;

  // Compact status icon — the full reconciliation reads out in a hover tooltip
  // (the original colour-coded chip) so the route cell stays icon-light.
  // Balanced = green check; otherwise an amber (short) / red (over) triangle.
  const bg = balanced
    ? "bg-emerald-50"
    : over
      ? "bg-red-50"
      : "bg-amber-50";
  const text = balanced
    ? "text-emerald-700"
    : over
      ? "text-red-600"
      : "text-amber-700";
  const Icon = balanced ? Check : AlertTriangle;
  const detail = balanced
    ? `${target} ${tag} · ${fmt(toOther(target))} ${otherTag}`
    : `${left} ${tag} · ${fmt(toOther(left))} ${otherTag} ${
        over ? "over" : "left"
      } · ${assigned}/${target}`;

  return (
    <span
      className="group/balance relative inline-flex shrink-0"
      aria-label={detail}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${bg} ${text}`}
      >
        <Icon size={12} className="shrink-0" />
      </span>
      {/* Reconciliation speech bubble — a white bubble (with padding around the
          chip) that drops straight below the icon, centred on it, with an upward
          tail pointing back at the icon. The colour-coded chip sits inside. */}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-lg transition group-hover/balance:visible group-hover/balance:opacity-100"
      >
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-slate-200 bg-white" />
        <span
          className={`inline-flex w-max items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${bg} ${text}`}
        >
          <Icon size={12} className="shrink-0" />
          {balanced ? (
            `${target} ${tag} · ${fmt(toOther(target))} ${otherTag}`
          ) : (
            <>
              {`${left} ${tag} · ${fmt(toOther(left))} ${otherTag} ${
                over ? "over" : "left"
              }`}
              <span className="font-normal opacity-70">
                · {assigned}/{target}
              </span>
            </>
          )}
        </span>
      </span>
    </span>
  );
}

// The route-split unit picker, rendered inline as the split editor's quantity
// column header ("C/S" / "PC"). Clicking it opens a compact menu to switch the
// line's routeUnit — no separate "Split by" control above the routes.
function RouteUnitHeader({
  value,
  onChange,
}: {
  value: Unit;
  onChange: (value: Unit) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click anywhere outside this menu (the parent cell stays open).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change split unit"
        className="flex items-center gap-0.5 rounded text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700"
      >
        {unitShort(value)}
        <ChevronDown
          size={11}
          className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-1/2 z-30 mt-1 w-24 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {UNITS.map((u) => {
            const active = u.value === value;
            return (
              <li key={u.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(u.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold normal-case tracking-normal transition ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {u.short}
                  {active && <Check size={12} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ProductionSheetSection({
  rows,
  meta,
  onSetMeta,
}: ProductionSheetSectionProps) {
  const [filter, setFilter] = useState<AllocationProduct | "all">("all");
  // Which hog-break phase's sheet is being viewed. Pure UI state — a SKU's phase
  // lives in its ProductionMeta; this just filters the derived rows by it.
  const [activePhase, setActivePhase] = useState<CutPhase>(DEFAULT_CUT_PHASE);
  // Inline per-cell editing — which cell (SKU + field) is open. Each editable
  // cell commits straight to its ProductionMeta field via onSetMeta, so there is
  // no separate row draft to reconcile.
  const [editingCell, setEditingCell] = useState<{
    sku: string;
    field: CellField;
  } | null>(null);
  // The open cell — used to detect clicks outside it (close on outside click).
  const activeCellRef = useRef<HTMLTableCellElement>(null);

  // A row's operational meta, falling back to defaults until the operator edits.
  // The fallback honours the row's defaultPhase (instruction-derived rows open in
  // After Hog Break), so an unedited row sits in — and a first edit saves into —
  // the right phase.
  const metaFor = (row: ProductionRow): ProductionMeta =>
    meta[row.sku] ?? {
      ...defaultProductionMeta(),
      phase: row.defaultPhase ?? DEFAULT_CUT_PHASE,
    };

  // Rows assigned to the active phase (default phase until a SKU is moved).
  const phaseRows = rows.filter((row) => metaFor(row).phase === activePhase);

  // Products present in this phase, in canonical order — drives the filter tabs.
  const productOrder = sortProductKeys([
    ...new Set(phaseRows.map((row) => row.group)),
  ]);
  const productTabs = productOrder.map((key) => ({
    key: key as AllocationProduct,
    count: phaseRows.filter((row) => row.group === key).length,
  }));

  // The sheet is viewed one product at a time (no "all" view); fall back to the
  // first product when the filter isn't a product present in this phase.
  const activeProduct =
    filter !== "all" && productOrder.includes(filter)
      ? filter
      : productOrder[0];
  const visibleRows = phaseRows.filter((row) => row.group === activeProduct);

  const closeCell = useCallback(() => setEditingCell(null), []);

  const switchPhase = (next: CutPhase) => {
    if (next === activePhase) return;
    setActivePhase(next);
    setFilter("all");
    closeCell();
  };

  // Commit a single cell's edit straight to the SKU's stored meta. On the first
  // edit of a still-default row, carry its derived phase along so live-committing
  // one field doesn't pull the row out of its current phase tab.
  const commitCell = (row: ProductionRow, patch: Partial<ProductionMeta>) =>
    onSetMeta(
      row.sku,
      meta[row.sku] ? patch : { phase: metaFor(row).phase, ...patch },
    );

  // Close the open cell on a click anywhere outside it, or on Escape. The inline
  // Room / Unit dropdowns render inside the cell, so picking from them counts as
  // inside and doesn't close the editor prematurely.
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Box size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Today&apos;s Production Sheet
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              SKU demand from Primal. Set the room, timing and cutters for each
              line.
            </p>
          </div>
        </div>
        {rows.length === 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            <Info size={14} className="shrink-0" />
            Rows come from the day&apos;s Primal orders. Enter orders in Primal
            Calculation to populate this sheet.
          </p>
        )}
      </header>

      {/* Phase tabs — each hog-break phase shows the SKUs assigned to it. */}
      <div className="flex gap-1 border-b border-slate-200 px-4 pt-3 sm:px-5">
        {CUT_PHASES.map((p) => {
          const active = activePhase === p.value;
          const count = rows.filter(
            (row) => metaFor(row).phase === p.value,
          ).length;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => switchPhase(p.value)}
              className={`-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {p.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty state — no SKUs in this phase. */}
      {phaseRows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center sm:py-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Box size={20} />
          </span>
          <p className="text-sm font-semibold text-slate-600">
            No SKUs for {cutPhaseLabel(activePhase)} yet
          </p>
          <p className="max-w-md text-xs text-slate-400">
            {rows.length === 0
              ? "Once the day has Primal orders, each ordered SKU appears here as a line."
              : `No lines are scheduled for ${cutPhaseLabel(activePhase)}.`}
          </p>
        </div>
      )}

      {/* Production sheet table */}
      {phaseRows.length > 0 && (
        <div className="border-t border-slate-100 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Production sheet ({phaseRows.length})
            </h3>
          </div>

          {/* Filter by product — view the sheet one product at a time. */}
          {productTabs.length > 1 && (
            <div className="mb-3">
              <ProductFilterTabs
                value={activeProduct ?? filter}
                onChange={setFilter}
                total={phaseRows.length}
                tabs={productTabs}
                showAll={false}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            {/* Fixed column widths so the row keeps the exact same layout in read
                and edit mode — editing a line never shifts a column's position. */}
            <table className="w-full min-w-417 table-fixed text-sm">
              <colgroup>
                <col className="w-12" />
                <col className="w-20" />
                <col />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-48" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-64" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 [&>th]:border-b [&>th]:border-slate-200 [&>th]:bg-slate-50 [&>th]:py-2.5">
                  <th className="rounded-l-lg px-3 text-right">#</th>
                  <th className="px-3">SKU</th>
                  <th className="px-3">Product Name</th>
                  <th className="px-3 text-right">Qty C/S</th>
                  <th className="px-3 text-right">Qty Pcs</th>
                  <th className="px-3">Room</th>
                  <th className="px-3">Start</th>
                  <th className="px-3">Finish</th>
                  <th className="px-3 text-center">Sec / Pc</th>
                  <th className="px-3 text-center">Cutters</th>
                  <th className="rounded-r-lg px-3">Delivery Route</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const rowMeta = metaFor(row);

                  // Identity cells (SKU / name / qty) are read-only in both modes
                  // — they come from Primal, not the operator.
                  const identityCells = (
                    <>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-slate-700">
                        {row.sku.startsWith(INSTRUCTION_ROW_SKU_PREFIX)
                          ? emptyCell
                          : row.sku}
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2 font-medium text-slate-800">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${productDotClass(
                              row.group,
                            )}`}
                          />
                          {row.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                        {row.qtyCases > 0 ? row.qtyCases : emptyCell}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                        {row.qtyPcs > 0 ? row.qtyPcs : emptyCell}
                      </td>
                    </>
                  );

                  // Is this row's given cell the one currently open for editing?
                  const editing = (field: CellField) =>
                    editingCell?.sku === row.sku && editingCell.field === field;
                  // Open a cell, and commit a patch straight to this row's meta.
                  const open = (field: CellField) =>
                    setEditingCell({ sku: row.sku, field });
                  const commit = (patch: Partial<ProductionMeta>) =>
                    commitCell(row, patch);
                  const routes = rowMeta.routes;
                  // Read cell shows a hover hint and click target; the active cell
                  // drops the hint and carries the outside-click ref instead.
                  const cellClass = (field: CellField) =>
                    `px-3 align-middle ${
                      editing(field)
                        ? "py-2"
                        : "py-3 cursor-pointer transition hover:bg-slate-50/60"
                    }`;

                  return (
                    <tr
                      key={row.sku}
                      className="[&>td]:border-b [&>td]:border-slate-100"
                    >
                      {identityCells}

                      {/* ROOM — click opens the room picker inline. */}
                      <td
                        ref={editing("room") ? activeCellRef : undefined}
                        onClick={() => !editing("room") && open("room")}
                        className={cellClass("room")}
                      >
                        {editing("room") ? (
                          <CustomSelect
                            value={rowMeta.room}
                            options={ROOM_OPTIONS}
                            defaultOpen
                            onChange={(v) => commit({ room: v })}
                            onClose={closeCell}
                          />
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <span
                              className={`h-2 w-2 rounded-full ${ROOM_DOT_CLASSES[rowMeta.room]}`}
                            />
                            {productionRoomLabel(rowMeta.room)}
                          </span>
                        )}
                      </td>

                      {/* START — click to type the time / open the clock picker.
                          Stays a 24-hour "HH:MM" value so computeFinish parses it;
                          FINISH (next cell) derives from it live. */}
                      <td
                        ref={editing("start") ? activeCellRef : undefined}
                        onClick={() => !editing("start") && open("start")}
                        className={`${cellClass("start")} tabular-nums text-slate-600`}
                      >
                        {editing("start") ? (
                          <TimeInput
                            value={rowMeta.start}
                            autoFocus
                            onChange={(v) => commit({ start: v })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                closeCell();
                              }
                            }}
                            ariaLabel="Start time"
                            className="h-10 w-full"
                          />
                        ) : (
                          fromTimeInputValue(rowMeta.start) || emptyCell
                        )}
                      </td>

                      {/* FINISH — derived, never editable. */}
                      <td className="px-3 py-3 tabular-nums text-slate-600">
                        {computeFinish(
                          rowMeta.start,
                          rowMeta.secPerPc,
                          row.qtyPcs,
                          rowMeta.cutters,
                        ) || emptyCell}
                      </td>

                      {/* SEC / PC */}
                      <td
                        ref={editing("secPerPc") ? activeCellRef : undefined}
                        onClick={() => !editing("secPerPc") && open("secPerPc")}
                        className={`${cellClass("secPerPc")} text-center tabular-nums text-slate-600`}
                      >
                        {editing("secPerPc") ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            autoFocus
                            value={rowMeta.secPerPc === 0 ? "" : rowMeta.secPerPc}
                            onChange={(e) =>
                              commit({
                                secPerPc: clampNonNegativeInt(e.target.value),
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                closeCell();
                              }
                            }}
                            placeholder="0"
                            aria-label="Seconds per piece"
                            className={`${cellInputClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />
                        ) : rowMeta.secPerPc > 0 ? (
                          rowMeta.secPerPc
                        ) : (
                          emptyCell
                        )}
                      </td>

                      {/* CUTTERS */}
                      <td
                        ref={editing("cutters") ? activeCellRef : undefined}
                        onClick={() => !editing("cutters") && open("cutters")}
                        className={`${cellClass("cutters")} text-center tabular-nums text-slate-600`}
                      >
                        {editing("cutters") ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            autoFocus
                            value={rowMeta.cutters === 0 ? "" : rowMeta.cutters}
                            onChange={(e) =>
                              commit({
                                cutters: clampNonNegativeInt(e.target.value),
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                closeCell();
                              }
                            }}
                            placeholder="0"
                            aria-label="Cutters"
                            className={`${cellInputClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />
                        ) : rowMeta.cutters > 0 ? (
                          rowMeta.cutters
                        ) : (
                          emptyCell
                        )}
                      </td>

                      {/* DELIVERY ROUTE — click opens the split editor inline. */}
                      <td
                        ref={editing("routes") ? activeCellRef : undefined}
                        onClick={() => !editing("routes") && open("routes")}
                        className={`${cellClass("routes")} text-slate-600`}
                      >
                        {editing("routes") ? (
                          // One row per truck route (label + count). The split
                          // counts in cases or pieces (routeUnit); the balance
                          // reconciles against the matching ordered qty. Each edit
                          // commits straight to the line's stored routes.
                          <div className="flex flex-col gap-1.5">
                            {routes.length > 0 && (
                              <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                <span className="w-16">Route #</span>
                                <div className="flex w-16 justify-center">
                                  <RouteUnitHeader
                                    value={rowMeta.routeUnit}
                                    onChange={(v) => commit({ routeUnit: v })}
                                  />
                                </div>
                              </div>
                            )}
                            {routes.map((r, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={r.route}
                                  onChange={(e) =>
                                    commit({
                                      routes: routes.map((x, idx) =>
                                        idx === i
                                          ? { ...x, route: e.target.value }
                                          : x,
                                      ),
                                    })
                                  }
                                  placeholder="9"
                                  aria-label={`Route ${i + 1} number`}
                                  className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                />
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  value={r.qty === 0 ? "" : r.qty}
                                  onChange={(e) =>
                                    commit({
                                      routes: routes.map((x, idx) =>
                                        idx === i
                                          ? {
                                              ...x,
                                              qty: clampNonNegativeInt(
                                                e.target.value,
                                              ),
                                            }
                                          : x,
                                      ),
                                    })
                                  }
                                  placeholder="0"
                                  aria-label={`Route ${i + 1} quantity`}
                                  className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2.5 text-center text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    commit({
                                      routes: routes.filter((_, idx) => idx !== i),
                                    })
                                  }
                                  title="Remove route"
                                  aria-label={`Remove route ${i + 1}`}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                commit({
                                  routes: [...routes, { route: "", qty: 0 }],
                                })
                              }
                              className="flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Plus size={13} />
                              Add route
                            </button>
                            {(routeTarget(row, rowMeta.routeUnit) > 0 ||
                              routes.length > 0) && (
                              <RouteBalance
                                recon={reconcileRoutes(
                                  routes,
                                  routeTarget(row, rowMeta.routeUnit),
                                )}
                                unit={rowMeta.routeUnit}
                                piecesPerCase={row.piecesPerCase}
                              />
                            )}
                          </div>
                        ) : routes.length === 0 ? (
                          emptyCell
                        ) : (
                          <div className="flex items-center gap-2">
                            <RouteBalance
                              recon={reconcileRoutes(
                                routes,
                                routeTarget(row, rowMeta.routeUnit),
                              )}
                              unit={rowMeta.routeUnit}
                              piecesPerCase={row.piecesPerCase}
                            />
                            <span className="min-w-0 truncate">
                              {formatRouteSummary(routes, rowMeta.routeUnit)}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
