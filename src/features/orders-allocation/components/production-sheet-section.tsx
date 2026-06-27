"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Box,
  Check,
  Info,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import {
  computeFinish,
  formatRouteSummary,
  reconcileRoutes,
  type RouteReconciliation,
} from "../calculations";
import { CustomSelect, type SelectOption } from "./custom-select";
import { ProductFilterTabs } from "./product-filter-tabs";
import { UnitSelect } from "./product-select";
import {
  CUT_PHASES,
  cutPhaseLabel,
  DEFAULT_CUT_PHASE,
  defaultProductionMeta,
  PRODUCTION_ROOMS,
  productionRoomLabel,
  productDotClass,
  sortProductKeys,
  unitShort,
  type AllocationProduct,
  type CutPhase,
  type ProductionMeta,
  type ProductionRoom,
  type ProductionRow,
  type RouteAssignment,
  type Unit,
} from "../types";

// Ordered quantity a route split reconciles against, in the line's chosen unit.
function routeTarget(row: ProductionRow, unit: Unit): number {
  return unit === "case" ? row.qtyCases : row.qtyPcs;
}

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

const cellInputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

// Muted placeholder for an empty operational value in a read row.
const emptyCell = <span className="text-slate-300">—</span>;

// Validation chip for a line's route split vs its ordered qty in the line's
// chosen unit: green when fully assigned, amber when some are still unrouted,
// red when over-assigned. The unit tag (PC / C/S) follows the line's routeUnit.
function RouteBalance({
  recon,
  unit,
}: {
  recon: RouteReconciliation;
  unit: Unit;
}) {
  const { status, remaining, assigned, target } = recon;
  const tag = unitShort(unit);
  if (status === "balanced") {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
        <Check size={11} className="shrink-0" />
        {target} {tag}
      </span>
    );
  }
  const over = status === "over";
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
        over ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
      }`}
    >
      <AlertTriangle size={11} className="shrink-0" />
      {over ? `${-remaining} ${tag} over` : `${remaining} ${tag} left`}
      <span className="font-normal opacity-70">
        · {assigned}/{target}
      </span>
    </span>
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
  // Inline row editing — the SKU whose row is open, plus the in-progress draft.
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProductionMeta | null>(null);

  // A row's operational meta, falling back to defaults until the operator edits.
  const metaFor = (sku: string): ProductionMeta =>
    meta[sku] ?? defaultProductionMeta();

  // Rows assigned to the active phase (default phase until a SKU is moved).
  const phaseRows = rows.filter((row) => metaFor(row.sku).phase === activePhase);

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

  const cancelEdit = () => {
    setEditingSku(null);
    setEditDraft(null);
  };

  const switchPhase = (next: CutPhase) => {
    if (next === activePhase) return;
    setActivePhase(next);
    setFilter("all");
    cancelEdit();
  };

  const startEdit = (row: ProductionRow) => {
    setEditingSku(row.sku);
    setEditDraft(metaFor(row.sku));
  };

  const patchDraft = (patch: Partial<ProductionMeta>) =>
    setEditDraft((d) => (d ? { ...d, ...patch } : d));

  // Delivery-route list edits on the in-progress draft (a line can split across
  // several truck routes). Saved with the rest of the draft via saveEdit.
  const addRoute = () =>
    setEditDraft((d) =>
      d ? { ...d, routes: [...d.routes, { route: "", qty: 0 }] } : d,
    );
  const patchRoute = (index: number, patch: Partial<RouteAssignment>) =>
    setEditDraft((d) =>
      d
        ? {
            ...d,
            routes: d.routes.map((r, i) =>
              i === index ? { ...r, ...patch } : r,
            ),
          }
        : d,
    );
  const removeRoute = (index: number) =>
    setEditDraft((d) =>
      d ? { ...d, routes: d.routes.filter((_, i) => i !== index) } : d,
    );

  const saveEdit = () => {
    if (!editingSku || !editDraft) return;
    onSetMeta(editingSku, editDraft);
    cancelEdit();
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
            (row) => metaFor(row.sku).phase === p.value,
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
            <table className="w-full min-w-385 table-fixed text-sm">
              <colgroup>
                <col className="w-12" />
                <col className="w-20" />
                <col />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-44" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-60" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400 [&>th]:border-b [&>th]:border-slate-200">
                  <th className="px-3 pb-2 text-right">#</th>
                  <th className="px-3 pb-2">SKU</th>
                  <th className="px-3 pb-2">Product Name</th>
                  <th className="px-3 pb-2 text-right">Qty C/S</th>
                  <th className="px-3 pb-2 text-right">Qty Pcs</th>
                  <th className="px-3 pb-2">Room</th>
                  <th className="px-3 pb-2">Start</th>
                  <th className="px-3 pb-2">Finish</th>
                  <th className="px-3 pb-2 text-center">Sec / Pc</th>
                  <th className="px-3 pb-2 text-center">Cutters</th>
                  <th className="px-3 pb-2">Delivery Route</th>
                  <th className="px-3 pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const rowMeta = metaFor(row.sku);

                  // Identity cells (SKU / name / qty) are read-only in both modes
                  // — they come from Primal, not the operator.
                  const identityCells = (
                    <>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-slate-700">
                        {row.sku}
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

                  if (editingSku === row.sku && editDraft) {
                    return (
                      <tr
                        key={row.sku}
                        className="[&>td]:border-b [&>td]:border-slate-100"
                      >
                        {identityCells}
                        <td className="px-3 py-2 align-middle">
                          <CustomSelect
                            value={editDraft.room}
                            options={ROOM_OPTIONS}
                            onChange={(v) => patchDraft({ room: v })}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="text"
                            value={editDraft.start}
                            onChange={(e) =>
                              patchDraft({ start: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEdit();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            placeholder="6:00"
                            className={cellInputClass}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {/* FINISH is auto-derived from start + sec/pc * pieces
                              — read-only, updating live as those inputs change. */}
                          <div
                            className="flex h-10 items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 text-sm tabular-nums text-slate-500"
                            aria-label="Finish (auto)"
                          >
                            {computeFinish(
                              editDraft.start,
                              editDraft.secPerPc,
                              row.qtyPcs,
                            ) || <span className="text-slate-300">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={
                              editDraft.secPerPc === 0 ? "" : editDraft.secPerPc
                            }
                            onChange={(e) =>
                              patchDraft({
                                secPerPc: clampNonNegativeInt(e.target.value),
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEdit();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            placeholder="0"
                            aria-label="Seconds per piece"
                            className={`${cellInputClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={editDraft.cutters === 0 ? "" : editDraft.cutters}
                            onChange={(e) =>
                              patchDraft({ cutters: clampNonNegativeInt(e.target.value) })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEdit();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            placeholder="0"
                            aria-label="Cutters"
                            className={`${cellInputClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {/* Delivery route split — one row per truck route, each
                              a route label + count. The split counts in either
                              cases or pieces (routeUnit); the balance reconciles
                              against the matching ordered qty. */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Split by
                              </span>
                              <div className="w-28">
                                <UnitSelect
                                  value={editDraft.routeUnit}
                                  onChange={(v) => patchDraft({ routeUnit: v })}
                                />
                              </div>
                            </div>
                            {editDraft.routes.length > 0 && (
                              <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                <span className="w-16">Route #</span>
                                <span className="w-16 text-center">
                                  {unitShort(editDraft.routeUnit)}
                                </span>
                              </div>
                            )}
                            {editDraft.routes.map((r, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={r.route}
                                  onChange={(e) =>
                                    patchRoute(i, { route: e.target.value })
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
                                    patchRoute(i, {
                                      qty: clampNonNegativeInt(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                  aria-label={`Route ${i + 1} quantity`}
                                  className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2.5 text-center text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeRoute(i)}
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
                              onClick={addRoute}
                              className="flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Plus size={13} />
                              Add route
                            </button>
                            {(routeTarget(row, editDraft.routeUnit) > 0 ||
                              editDraft.routes.length > 0) && (
                              <RouteBalance
                                recon={reconcileRoutes(
                                  editDraft.routes,
                                  routeTarget(row, editDraft.routeUnit),
                                )}
                                unit={editDraft.routeUnit}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center justify-start gap-1.5">
                            <button
                              type="button"
                              onClick={saveEdit}
                              title="Save"
                              aria-label="Save line"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              title="Cancel"
                              aria-label="Cancel edit"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={row.sku}
                      className="[&>td]:border-b [&>td]:border-slate-100"
                    >
                      {identityCells}
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span
                            className={`h-2 w-2 rounded-full ${ROOM_DOT_CLASSES[rowMeta.room]}`}
                          />
                          {productionRoomLabel(rowMeta.room)}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">
                        {rowMeta.start || emptyCell}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">
                        {computeFinish(
                          rowMeta.start,
                          rowMeta.secPerPc,
                          row.qtyPcs,
                        ) || emptyCell}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-slate-600">
                        {rowMeta.secPerPc > 0 ? rowMeta.secPerPc : emptyCell}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-slate-600">
                        {rowMeta.cutters > 0 ? rowMeta.cutters : emptyCell}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {rowMeta.routes.length === 0 ? (
                          emptyCell
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <span>{formatRouteSummary(rowMeta.routes)}</span>
                            <RouteBalance
                              recon={reconcileRoutes(
                                rowMeta.routes,
                                routeTarget(row, rowMeta.routeUnit),
                              )}
                              unit={rowMeta.routeUnit}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            title="Edit"
                            aria-label="Edit line"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
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
