"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Box,
  Check,
  ChevronDown,
  GripVertical,
  Info,
  Plus,
  X,
} from "lucide-react";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import {
  deriveProductionSchedule,
  formatRouteSummary,
  INSTRUCTION_ROW_SKU_PREFIX,
  orderProductionRows,
  reconcileRoutes,
  type RouteReconciliation,
} from "../calculations";
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
type CellField =
  | "room"
  | "start"
  | "secPerPc"
  | "cutters"
  | "buffer"
  | "routes";

// "Today's Production Sheet" — the SKU-level cut plan. The rows are DERIVED from
// Primal demand (SKU / name / ordered qty); the operator overlays the
// operational columns (room / start / sec-per-pc / cutters / phase / delivery
// routes), which are the only persisted values. FINISH is itself DERIVED (start
// + sec/pc * pieces, via computeFinish) — never entered or stored. Presentation
// only — every change is forwarded to the parent's state hook.
type ProductionSheetSectionProps = {
  rows: ProductionRow[];
  meta: Record<string, ProductionMeta>;
  // The operator's manual row order (sequence of row SKUs). Applied over the
  // derived rows; onReorder persists the next full sequence after a drag.
  order: string[];
  onSetMeta: (sku: string, patch: Partial<ProductionMeta>) => void;
  onReorder: (order: string[]) => void;
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
  order,
  onSetMeta,
  onReorder,
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
  // Drag-to-reorder. `draggingSku` is the row under the cursor's grip;
  // `dragOrder` is the LIVE visible SKU sequence while a drag is in flight — the
  // rows reflow to it in real time so the list rearranges as you move, and the
  // final sequence commits to the persisted draft on drop. Both are pure UI
  // state; nothing persists until onReorder.
  const [draggingSku, setDraggingSku] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  // Live row elements + their last measured positions, so a reorder can be FLIP
  // animated (rows slide from their old spot to the new one) instead of snapping.
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  // Rows in the operator's manual order (falls back to the canonical Primal order
  // for any SKU not yet placed). Everything downstream reads from this.
  const orderedRows = orderProductionRows(rows, order);

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
  const phaseRows = orderedRows.filter(
    (row) => metaFor(row).phase === activePhase,
  );

  // Per-room START/FINISH schedule for the phase, in display order. A line with
  // no entered START auto-chains from the previous line's FINISH in its room
  // (+buffer); the START/FINISH cells read from this. Derived over the FULL
  // phase (all products) so the chain stays continuous under the product filter,
  // and recomputed here so any reorder / room change re-chains automatically.
  const schedule = deriveProductionSchedule(phaseRows, metaFor);

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
  const committedVisibleRows = phaseRows.filter(
    (row) => row.group === activeProduct,
  );
  // While dragging, the on-screen order follows the live `dragOrder`; otherwise
  // it is the committed order. Rows are reordered by SKU so identity is stable.
  const visibleRows =
    dragOrder && draggingSku
      ? (dragOrder
          .map((sku) => committedVisibleRows.find((row) => row.sku === sku))
          .filter(Boolean) as ProductionRow[])
      : committedVisibleRows;

  // FLIP: after every render, measure each visible row. While a drag is
  // reordering them, invert the position change and release it on the next frame
  // so the rows slide into place instead of jumping. Runs before paint so the
  // invert is never visible.
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    rowRefs.current.forEach((el, sku) => next.set(sku, el.getBoundingClientRect()));
    if (draggingSku) {
      next.forEach((rect, sku) => {
        const before = prevRects.current.get(sku);
        if (!before) return;
        const dy = before.top - rect.top;
        if (!dy) return;
        const el = rowRefs.current.get(sku);
        if (!el) return;
        el.style.transition = "none";
        el.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 200ms cubic-bezier(0.2, 0, 0, 1)";
          el.style.transform = "";
        });
      });
    }
    prevRects.current = next;
  });

  const closeCell = useCallback(() => setEditingCell(null), []);

  // Begin a drag: seed the live order with the current visible sequence so
  // subsequent moves reorder within it.
  const startDrag = (sku: string) => {
    setDraggingSku(sku);
    setDragOrder(committedVisibleRows.map((row) => row.sku));
  };

  // Hover over a row mid-drag: slot the dragged row just before or after that
  // row (by which half of it the cursor is over) in the live order, so the list
  // reflows — and FLIP-animates — in real time. Deciding by cursor half (not by
  // the current order) keeps it stable: holding over one row settles instead of
  // oscillating. Returns the previous array unchanged when nothing moved so a
  // steady hover doesn't churn state.
  const dragOverRow = (targetSku: string, after: boolean) => {
    if (!draggingSku || draggingSku === targetSku) return;
    setDragOrder((prev) => {
      if (!prev) return prev;
      const without = prev.filter((sku) => sku !== draggingSku);
      const ti = without.indexOf(targetSku);
      if (ti === -1) return prev;
      without.splice(after ? ti + 1 : ti, 0, draggingSku);
      return without.every((sku, i) => sku === prev[i]) ? prev : without;
    });
  };

  // Commit the drag: fold the live visible order back into the FULL sequence
  // (visible slots follow dragOrder, rows off-screen keep their positions), then
  // persist. Reordering only ever happens within one phase + product on screen,
  // so this never mixes groups. Clears the drag state either way.
  const endDrag = () => {
    if (dragOrder) {
      const visibleSet = new Set(committedVisibleRows.map((row) => row.sku));
      let i = 0;
      const nextOrder = orderedRows.map((row) =>
        visibleSet.has(row.sku) ? dragOrder[i++] : row.sku,
      );
      onReorder(nextOrder);
    }
    setDraggingSku(null);
    setDragOrder(null);
  };

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
          const count = orderedRows.filter(
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
            <table className="w-full min-w-445 table-fixed text-sm">
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
                <col className="w-28" />
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
                  <th className="px-3 text-center">Sec / Pc</th>
                  <th className="px-3 text-center">Cutters</th>
                  <th className="px-3">Finish</th>
                  <th className="px-3 text-center">Buffer</th>
                  <th className="rounded-r-lg px-3">Delivery Route</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const rowMeta = metaFor(row);
                  const sched = schedule.get(row.sku);

                  // Identity cells (SKU / name / qty) are read-only in both modes
                  // — they come from Primal, not the operator.
                  const identityCells = (
                    <>
                      <td className="relative px-3 py-3 text-right tabular-nums text-slate-400">
                        {/* Drag handle — reveals on row hover, overlaid in the
                            left padding so the row number keeps its position. */}
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            startDrag(row.sku);
                            e.dataTransfer.effectAllowed = "move";
                            // Firefox won't start a drag without transfer data.
                            e.dataTransfer.setData("text/plain", row.sku);
                          }}
                          onDragEnd={endDrag}
                          aria-label={`Drag to reorder ${row.name}`}
                          title="Drag to reorder"
                          className="absolute left-0.5 top-1/2 flex h-6 w-4 -translate-y-1/2 cursor-grab items-center justify-center text-slate-300 opacity-0 transition hover:text-slate-500 group-hover:opacity-100 active:cursor-grabbing"
                        >
                          <GripVertical size={14} />
                        </button>
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

                  const isDragging = draggingSku === row.sku;

                  return (
                    <tr
                      key={row.sku}
                      ref={(el) => {
                        if (el) rowRefs.current.set(row.sku, el);
                        else rowRefs.current.delete(row.sku);
                      }}
                      onDragOver={(e) => {
                        if (!draggingSku) return;
                        // Allow the drop and reflow the list to this row's slot,
                        // before or after it by which half the cursor is over.
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        dragOverRow(
                          row.sku,
                          e.clientY > rect.top + rect.height / 2,
                        );
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        endDrag();
                      }}
                      className={`group [&>td]:border-b [&>td]:border-slate-100 ${
                        // The dragged row lifts: shadowed, raised, and slightly
                        // faded so it reads as the moving piece while the rest
                        // reflow underneath it.
                        isDragging
                          ? "relative z-10 bg-white opacity-90 shadow-lg [&>td]:border-transparent"
                          : ""
                      }`}
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
                            // Seed an unentered (auto-chained) line from its
                            // derived start so the operator tweaks that time
                            // rather than a blank; a manual line uses its own.
                            value={rowMeta.start || sched?.startInput || ""}
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
                        ) : sched?.start ? (
                          // Auto-chained starts are muted to set them apart from
                          // the operator's entered (or first-in-room) times.
                          <span
                            className={sched.autoStart ? "text-slate-400" : undefined}
                          >
                            {sched.start}
                          </span>
                        ) : (
                          emptyCell
                        )}
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

                      {/* FINISH — derived from the schedule, never editable. */}
                      <td className="px-3 py-3 tabular-nums text-slate-600">
                        {sched?.finish || emptyCell}
                      </td>

                      {/* BUFFER — seconds held after this line's FINISH before
                          the next line in the same room auto-starts. */}
                      <td
                        ref={editing("buffer") ? activeCellRef : undefined}
                        onClick={() => !editing("buffer") && open("buffer")}
                        className={`${cellClass("buffer")} text-center tabular-nums text-slate-600`}
                      >
                        {editing("buffer") ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            autoFocus
                            value={rowMeta.bufferSec === 0 ? "" : rowMeta.bufferSec}
                            onChange={(e) =>
                              commit({
                                bufferSec: clampNonNegativeInt(e.target.value),
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                closeCell();
                              }
                            }}
                            placeholder="0"
                            aria-label="Buffer seconds"
                            className={`${cellInputClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />
                        ) : (
                          `${rowMeta.bufferSec}s`
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
