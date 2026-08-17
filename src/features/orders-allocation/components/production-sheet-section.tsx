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
  Clock,
  GripVertical,
  Info,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import { EmptyState } from "@/components/shared/empty-state";
import {
  deriveProductionSchedule,
  formatRouteSummary,
  INSTRUCTION_ROW_SKU_PREFIX,
  orderProductionRows,
  reconcileRoutes,
  type RouteProductionStatus,
  type RouteReconciliation,
} from "../calculations";
import { ROUTE_PRODUCTION_STATUS_BADGE } from "../route-status-badge";
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
  routeAssignmentUnit,
  sortProductKeys,
  UNITS,
  unitShort,
  type AllocationProduct,
  type CutPhase,
  type ProductionMeta,
  type ProductionRoom,
  type ProductionRow,
  type RouteAssignment,
  type Unit,
} from "../types";

// Ordered quantity a route split reconciles against, in PIECES. Route qtys can
// mix units per route, so the split always reconciles on the piece scale; qtyPcs
// is the whole order's piece count (qtyCases is the same order in cases).
function routeTargetPcs(row: ProductionRow): number {
  return row.qtyPcs;
}

// The production cells the operator can edit in place (FINISH is derived, the
// identity columns come from Primal).
type CellField =
  | "room"
  | "start"
  | "secPerPc"
  | "cutters"
  | "buffer"
  | "carry"
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
  // Per-room "cut until" deadline (available-time window end). Drives the Carry
  // Forward split and the ⚠ exceeds flag on each line.
  roomDeadlines: Partial<Record<ProductionRoom, string>>;
  // Route readiness derived by the parent (production FINISH vs print deadline).
  // Route number (as a string, matching the split label) → its status, used to
  // badge each line's Delivery Route split.
  routeStatusByNumber: Map<string, RouteProductionStatus>;
  onSetMeta: (sku: string, patch: Partial<ProductionMeta>) => void;
  onReorder: (order: string[]) => void;
  onSetRoomDeadline: (room: ProductionRoom, time: string) => void;
};

// Solid per-room dot colour for the room picker / read cell.
const ROOM_DOT_CLASSES: Record<ProductionRoom, string> = {
  main: "bg-emerald-500",
  second: "bg-sky-500",
  vacuum_pack: "bg-violet-500",
  overflow: "bg-amber-400",
};

// Rooms the available-time bar always offers a "cut until" window for, so the
// supervisor can pre-set each room's deadline before any line is assigned to it.
// Other rooms (e.g. Overflow) only appear once a line actually uses them.
const ALWAYS_SHOWN_DEADLINE_ROOMS: readonly ProductionRoom[] = [
  "main",
  "second",
  "vacuum_pack",
];

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

// Express a piece count as its whole-case + loose-piece breakdown, e.g. 25 pcs
// at 12/case -> "2 C/S + 1". Carry Forward is stored/scheduled in pieces (cut
// work is per-piece), so this is a DISPLAY hint only — it lets the cell read in
// both units like the rest of the sheet. Returns null when there's nothing a
// case view adds: no real case size (piecesPerCase <= 1) or less than one full
// case (the piece figure already tells the whole story).
function caseEquivalent(pcs: number, piecesPerCase: number): string | null {
  if (piecesPerCase <= 1 || pcs <= 0) return null;
  const cases = Math.floor(pcs / piecesPerCase);
  if (cases === 0) return null;
  const loose = pcs % piecesPerCase;
  const caseTag = unitShort("case");
  const pieceTag = unitShort("piece");
  return loose === 0
    ? `${cases} ${caseTag}`
    : `${cases} ${caseTag} + ${loose} ${pieceTag}`;
}

// Carry-forward badge: the pieces held to tomorrow (the stored, scheduled unit)
// with a case-equivalent hint beneath so the cell reads in both units. `applied`
// = a manual carry that's actually held back (solid amber); otherwise it's a
// deadline suggestion not yet applied (dashed red).
function CarryForwardChip({
  pcs,
  piecesPerCase,
  applied,
  title,
}: {
  pcs: number;
  piecesPerCase: number;
  applied: boolean;
  title: string;
}) {
  const caseHint = caseEquivalent(pcs, piecesPerCase);
  const fullTitle = caseHint ? `${title} · ${caseHint}` : title;
  return (
    <span
      title={fullTitle}
      className="inline-flex flex-col items-center gap-0.5"
    >
      <span
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
          applied
            ? "bg-amber-100 text-amber-800"
            : "border border-dashed border-red-300 text-red-500"
        }`}
      >
        {pcs}
        <span className="text-[9px] font-semibold leading-none opacity-70">
          {unitShort("piece")}
        </span>
        <span className="text-[10px] leading-none">→</span>
      </span>
      {caseHint && (
        <span
          className={`text-[9px] font-medium leading-none ${
            applied ? "text-amber-600/80" : "text-red-400/80"
          }`}
        >
          {caseHint}
        </span>
      )}
    </span>
  );
}

// Validation chip for a line's route split vs its ordered qty: green when fully
// assigned, amber when some are still unrouted, red when over-assigned. The
// reconciliation runs in pieces (routes can mix units), so `unit` is "piece";
// the detail also shows the case-equivalent so the chip reads in both units.
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

// Per-route unit toggle, rendered inline beside each route's qty input. With
// only two units (PC / C/S) a click flips straight between them — no menu — so a
// single line can mix cases and pieces across its routes with one tap each.
function RouteUnitPicker({
  value,
  onChange,
}: {
  value: Unit;
  onChange: (value: Unit) => void;
}) {
  const next = UNITS.find((u) => u.value !== value)?.value ?? value;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`Unit: ${unitShort(value)} — tap for ${unitShort(next)}`}
      aria-label={`Route unit ${unitShort(value)}, tap to switch to ${unitShort(next)}`}
      className="flex h-9 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
    >
      {unitShort(value)}
    </button>
  );
}

// Available-time editor: one "cut until" deadline per room used in the phase.
// The window's START is already derived from the hog-break chain; this sets its
// END. A blank field clears the room's deadline (no exceeds check / no auto
// carry-forward). Sits above the table so the supervisor sets the day's windows
// once, then every line reconciles against its room's deadline.
function RoomDeadlineBar({
  rooms,
  deadlines,
  onSetRoomDeadline,
}: {
  rooms: readonly (typeof PRODUCTION_ROOMS)[number][];
  deadlines: Partial<Record<ProductionRoom, string>>;
  onSetRoomDeadline: (room: ProductionRoom, time: string) => void;
}) {
  if (rooms.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Clock size={13} className="shrink-0" />
        Available until
      </span>
      {rooms.map((room) => (
        <label
          key={room.value}
          className="flex items-center gap-1.5 text-sm text-slate-600"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${ROOM_DOT_CLASSES[room.value]}`}
          />
          <span className="text-xs font-medium text-slate-500">
            {room.label}
          </span>
          <TimeInput
            value={deadlines[room.value] ?? ""}
            onChange={(v) => onSetRoomDeadline(room.value, v)}
            ariaLabel={`${room.label} deadline`}
            className="h-9 w-28"
          />
        </label>
      ))}
    </div>
  );
}

// Per-route readiness chips for a line's Delivery Route split (read mode). One
// chip per distinct route the line ships on that has a derived status, so the
// operator sees at a glance which of this line's routes are late / at risk.
function RouteStatusBadges({
  routes,
  statusByNumber,
}: {
  routes: RouteAssignment[];
  statusByNumber: Map<string, RouteProductionStatus>;
}) {
  const labels = Array.from(
    new Set(routes.map((r) => r.route.trim()).filter(Boolean)),
  );
  const badges = labels
    .map((label) => ({ label, status: statusByNumber.get(label) }))
    .filter(
      (b): b is { label: string; status: RouteProductionStatus } =>
        b.status !== undefined,
    );
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map(({ label, status }) => {
        const badge = ROUTE_PRODUCTION_STATUS_BADGE[status];
        const routeLabel = /^\d+$/.test(label) ? `#${label}` : label;
        return (
          <span
            key={label}
            title={`Route ${label} — ${badge.label} (${badge.hint})`}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${badge.chip}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`} />
            {routeLabel}
            <span className="font-medium opacity-80">{badge.short}</span>
          </span>
        );
      })}
    </div>
  );
}

export function ProductionSheetSection({
  rows,
  meta,
  order,
  roomDeadlines,
  routeStatusByNumber,
  onSetMeta,
  onReorder,
  onSetRoomDeadline,
}: ProductionSheetSectionProps) {
  const [filter, setFilter] = useState<AllocationProduct | "all">("all");
  // Which room the sheet is filtered to ("all" = every room, grouped by room).
  // Pure UI state — a line's room lives in its ProductionMeta; this only narrows
  // and orders the derived rows.
  const [roomFilter, setRoomFilter] = useState<ProductionRoom | "all">("all");
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

  // Instruction (After Hog Break) rows carry no catalog SKU. Give each a stable
  // sequential handle — AHB-1, AHB-2… — by its order in the full sheet, so these
  // lines can be referenced and read as clearly synthetic (not a real SKU). Keyed
  // by row SKU; numbering follows the whole sheet, so it survives room/product
  // filtering (a given instruction always shows the same number).
  const instructionSeq = new Map<string, number>();
  for (const row of orderedRows) {
    if (row.sku.startsWith(INSTRUCTION_ROW_SKU_PREFIX)) {
      instructionSeq.set(row.sku, instructionSeq.size + 1);
    }
  }

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
  const schedule = deriveProductionSchedule(phaseRows, metaFor, roomDeadlines);

  // Rooms shown in the available-time (deadline) editor, in canonical order:
  // Main and the Second Cutting Room are always offered so the supervisor can
  // pre-set each window, plus any other room actually used in this phase.
  const deadlineRooms = PRODUCTION_ROOMS.filter(
    (room) =>
      ALWAYS_SHOWN_DEADLINE_ROOMS.includes(room.value) ||
      phaseRows.some((row) => metaFor(row).room === room.value),
  );

  // Lines whose today work still runs past their room deadline — the ⚠ banner
  // counts them so the supervisor sees the overflow at a glance.
  const exceedingCount = phaseRows.filter(
    (row) => schedule.get(row.sku)?.exceedsDeadline,
  ).length;

  // PRIMARY filter — rooms present in this phase (all products), in canonical
  // order. Fall back to "all" when the selected room isn't present (so switching
  // phase can't strand the filter).
  const roomOrder = PRODUCTION_ROOMS.map((r) => r.value).filter((rv) =>
    phaseRows.some((row) => metaFor(row).room === rv),
  );
  const roomTabs = roomOrder.map((rv) => ({
    room: rv,
    count: phaseRows.filter((row) => metaFor(row).room === rv).length,
  }));
  const activeRoom =
    roomFilter !== "all" && roomOrder.includes(roomFilter) ? roomFilter : "all";
  // Rows in the active room ("all" keeps every room, grouped by room below).
  const roomRows =
    activeRoom === "all"
      ? phaseRows
      : phaseRows.filter((row) => metaFor(row).room === activeRoom);

  // SECONDARY filter — products present WITHIN the active room, in canonical
  // order. Nested under the room filter so each room lists its own products.
  const productOrder = sortProductKeys([
    ...new Set(roomRows.map((row) => row.group)),
  ]);
  const productTabs = productOrder.map((key) => ({
    key: key as AllocationProduct,
    count: roomRows.filter((row) => row.group === key).length,
  }));
  // The sheet is viewed one product at a time (no "all" view); fall back to the
  // first product present in the active room.
  const activeProduct =
    filter !== "all" && productOrder.includes(filter)
      ? filter
      : productOrder[0];

  // Final visible rows: active room + active product, kept in the operator's
  // manual order (orderedRows) as-is. The "All rooms" view no longer regroups by
  // room, so a drag can reorder any line relative to any other — the on-screen
  // order matches the persisted order, and the per-room START/FINISH chain
  // (derived from phaseRows in this same order) stays consistent with it.
  const committedVisibleRows = roomRows.filter(
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
    setRoomFilter("all");
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

  // Commit a START edit and re-flow the room: the edited line becomes the anchor,
  // and every LATER line in the SAME room has its own entered START cleared so it
  // auto-chains from this edit (the whole tail moves to match). Lines BEFORE it,
  // and lines in other rooms, keep their times. Walks the phase's chain order
  // (phaseRows) so the cleared lines are exactly the ones that chain off this one.
  const commitStart = (row: ProductionRow, start: string) => {
    commitCell(row, { start });
    const room = metaFor(row).room;
    const idx = phaseRows.findIndex((r) => r.sku === row.sku);
    if (idx === -1) return;
    for (let i = idx + 1; i < phaseRows.length; i++) {
      const next = phaseRows[i];
      if (metaFor(next).room !== room) continue;
      if (!meta[next.sku]?.start) continue; // already auto-chaining
      onSetMeta(next.sku, { start: "" });
    }
  };

  // Close the open cell on a click anywhere outside it, or on Escape. The inline
  // Room / Unit dropdowns render inside the cell, so picking from them counts as
  // inside and doesn't close the editor prematurely.
  useEffect(() => {
    if (!editingCell) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (activeCellRef.current?.contains(target)) return;
      // The Room / Start editors render their dropdowns in a portal on <body>,
      // outside this cell — so a pick would otherwise read as an outside click
      // and close the editor after a single interaction (can't set hour THEN
      // AM/PM). Treat any click inside a portalled editor popover as inside.
      if (
        target instanceof Element &&
        target.closest("[data-editor-popover]")
      )
        return;
      closeCell();
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
        {rows.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            <Info size={14} className="shrink-0" />
            Rows come from the day&apos;s Primal orders. Enter orders in Primal
            Calculation to populate this sheet.
          </p>
        ) : (
          phaseRows.length > 0 && (
            /* Available-time deadlines per room — sets the END of each room's
               cutting window; every line reconciles against its room's value. */
            <RoomDeadlineBar
              rooms={deadlineRooms}
              deadlines={roomDeadlines}
              onSetRoomDeadline={onSetRoomDeadline}
            />
          )
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
        <EmptyState
          icon={Box}
          title={`No SKUs for ${cutPhaseLabel(activePhase)} yet`}
          description={
            rows.length === 0
              ? "Once the day has Primal orders, each ordered SKU appears here as a line."
              : `No lines are scheduled for ${cutPhaseLabel(activePhase)}.`
          }
        />
      )}

      {/* Production sheet table */}
      {phaseRows.length > 0 && (
        <div className="border-t border-slate-100 p-4 sm:p-5">
          {/* Overflow warning — some lines' today work runs past the deadline.
              Their excess should move to Carry Forward (per-line ⚠ + column). */}
          {exceedingCount > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangle size={14} className="shrink-0" />
              {exceedingCount} line{exceedingCount > 1 ? "s" : ""} exceed
              {exceedingCount > 1 ? "" : "s"} available time — move the excess to
              Carry Forward.
            </div>
          )}

          {/* PRIMARY filter — by room. "All rooms" groups the rows by room; a
              room tab narrows to just that room. Shown when the phase spans
              more than one room. */}
          {roomTabs.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setRoomFilter("all")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  activeRoom === "all"
                    ? "border-transparent bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                All rooms ({phaseRows.length})
              </button>
              {roomTabs.map((tab) => {
                const active = activeRoom === tab.room;
                return (
                  <button
                    key={tab.room}
                    type="button"
                    onClick={() => setRoomFilter(tab.room)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-slate-300 bg-slate-100 text-slate-900"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${ROOM_DOT_CLASSES[tab.room]}`}
                    />
                    {productionRoomLabel(tab.room)}
                    <span className="text-[11px] font-bold tabular-nums opacity-60">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* SECONDARY filter — by product, nested under the active room. One
              product at a time; lists only the products in the selected room. */}
          {productTabs.length > 1 && (
            <div className="mb-3 pl-0.5">
              <ProductFilterTabs
                value={activeProduct ?? filter}
                onChange={setFilter}
                total={roomRows.length}
                tabs={productTabs}
                showAll={false}
              />
            </div>
          )}

          {/* Table wrapped in a rounded, bordered container to match the Today's
              Availability table. */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            {/* Fixed column widths so the row keeps the exact same layout in read
                and edit mode — editing a line never shifts a column's position. */}
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-24" />
                <col />
                <col className="w-20" />
                <col className="w-20" />
                <col className="w-40" />
                <col className="w-32" />
                <col className="w-20" />
                <col className="w-24" />
                <col className="w-32" />
                <col className="w-20" />
                <col className="w-28" />
                <col className="w-64" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 [&>th]:border-b [&>th]:border-slate-200 [&>th]:bg-slate-50 [&>th]:py-2.5">
                  <th className="px-2 pl-6">SKU</th>
                  <th className="px-2">Product Name</th>
                  <th className="px-2 text-right">Qty C/S</th>
                  <th className="px-2 text-right">Qty Pcs</th>
                  <th className="px-2">Room</th>
                  <th className="px-2">Start</th>
                  <th className="px-2 text-center">Sec / Pc</th>
                  <th className="px-2 text-center">Cutters</th>
                  <th className="px-2">Finish</th>
                  <th className="px-2 text-center">Buffer</th>
                  <th className="px-2 text-center">Carry Fwd</th>
                  <th className="px-2">Delivery Route</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const rowMeta = metaFor(row);
                  const sched = schedule.get(row.sku);

                  // Identity cells (SKU / name / qty) are read-only in both modes
                  // — they come from Primal, not the operator.
                  const identityCells = (
                    <>
                      <td className="relative px-2 py-3 pl-6 font-normal tabular-nums text-slate-900">
                        {/* Drag handle — reveals on row hover, overlaid in the
                            left padding so the SKU keeps its position. */}
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
                        {row.sku.startsWith(INSTRUCTION_ROW_SKU_PREFIX)
                          ? `AHB-${instructionSeq.get(row.sku)}`
                          : row.sku}
                      </td>
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-2 font-medium text-slate-800">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${productDotClass(
                              row.group,
                            )}`}
                          />
                          {row.name}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums text-slate-900">
                        {row.qtyCases > 0 ? row.qtyCases : emptyCell}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums text-slate-900">
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
                    `px-2 align-middle ${
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
                            onChange={(v) => commitStart(row, v)}
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

                      {/* FINISH — derived from the schedule, never editable. It
                          always shows the real end time; when it runs past the
                          room deadline it just turns red (the work is not cut
                          short — the supervisor moves the excess via Carry Fwd). */}
                      <td
                        className={`px-2 py-3 tabular-nums ${
                          sched?.exceedsDeadline
                            ? "font-semibold text-red-600"
                            : "text-slate-600"
                        }`}
                      >
                        {sched?.finish ? (
                          sched.exceedsDeadline ? (
                            <span
                              title={`Exceeds available time${
                                sched.deadline ? ` (until ${sched.deadline})` : ""
                              }`}
                              className="inline-flex items-center gap-1"
                            >
                              <AlertTriangle size={12} className="shrink-0" />
                              {sched.finish}
                            </span>
                          ) : (
                            sched.finish
                          )
                        ) : (
                          emptyCell
                        )}
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

                      {/* CARRY FORWARD — pieces the supervisor moves to tomorrow.
                          Blank ⇒ nothing carried (the whole order runs today and
                          the FINISH shows red if it's over). When a line exceeds
                          the deadline the cell suggests how many to move (dashed);
                          type a number to actually hold them back. */}
                      <td
                        ref={editing("carry") ? activeCellRef : undefined}
                        onClick={() => !editing("carry") && open("carry")}
                        className={`${cellClass("carry")} text-center tabular-nums text-slate-600`}
                      >
                        {editing("carry") ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              autoFocus
                              value={
                                rowMeta.carryForwardPcs == null
                                  ? ""
                                  : rowMeta.carryForwardPcs
                              }
                              onChange={(e) =>
                                commit({
                                  carryForwardPcs:
                                    e.target.value === ""
                                      ? null
                                      : clampNonNegativeInt(e.target.value),
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  closeCell();
                                }
                              }}
                              placeholder={String(
                                sched?.suggestedCarryPcs ||
                                  sched?.carryForwardPcs ||
                                  0,
                              )}
                              aria-label="Carry forward pieces"
                              className={`${cellInputClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            />
                            {rowMeta.carryForwardPcs != null && (
                              <button
                                type="button"
                                onClick={() => commit({ carryForwardPcs: null })}
                                title="Reset to auto"
                                aria-label="Reset carry forward to auto"
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                          </div>
                        ) : sched && sched.carryForwardPcs > 0 ? (
                          // A manual carry is APPLIED — solid amber, and the
                          // FINISH already reflects the reduced (today) work.
                          <CarryForwardChip
                            pcs={sched.carryForwardPcs}
                            piecesPerCase={row.piecesPerCase}
                            applied
                            title={`${sched.todayPcs} today · ${sched.carryForwardPcs} to tomorrow (manual)`}
                          />
                        ) : sched && sched.suggestedCarryPcs > 0 ? (
                          // Over the deadline with nothing held back yet — suggest
                          // how many to move (dashed = not applied). Click to keep.
                          <CarryForwardChip
                            pcs={sched.suggestedCarryPcs}
                            piecesPerCase={row.piecesPerCase}
                            applied={false}
                            title={`Suggest moving ${sched.suggestedCarryPcs} pcs to tomorrow to finish by the deadline`}
                          />
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
                          // One row per truck route (label + count + its own
                          // unit). A line can mix cases and pieces across routes;
                          // the balance normalises every route to pieces and
                          // reconciles against the ordered pieces. Each edit
                          // commits straight to the line's stored routes.
                          <div className="flex flex-col gap-1.5">
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
                                  placeholder="Rte"
                                  aria-label={`Route ${i + 1} number`}
                                  className="h-9 w-12 rounded-lg border border-slate-200 bg-white px-1.5 text-center text-sm text-slate-900 outline-none transition placeholder:text-xs placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
                                  placeholder="Qty"
                                  aria-label={`Route ${i + 1} quantity`}
                                  className="h-9 w-12 rounded-lg border border-slate-200 bg-white px-1.5 text-center text-sm text-slate-900 outline-none transition placeholder:text-xs placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <div className="flex w-12 justify-center">
                                  <RouteUnitPicker
                                    value={routeAssignmentUnit(
                                      r,
                                      rowMeta.routeUnit,
                                    )}
                                    onChange={(v) =>
                                      commit({
                                        routes: routes.map((x, idx) =>
                                          idx === i ? { ...x, unit: v } : x,
                                        ),
                                      })
                                    }
                                  />
                                </div>
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
                                  // New route inherits the previous route's unit
                                  // (else the line default), so adding several of
                                  // the same unit stays one click each.
                                  routes: [
                                    ...routes,
                                    {
                                      route: "",
                                      qty: 0,
                                      unit: routeAssignmentUnit(
                                        routes[routes.length - 1] ?? {
                                          route: "",
                                          qty: 0,
                                        },
                                        rowMeta.routeUnit,
                                      ),
                                    },
                                  ],
                                })
                              }
                              className="flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Plus size={13} />
                              Add route
                            </button>
                            {(routeTargetPcs(row) > 0 || routes.length > 0) && (
                              <RouteBalance
                                recon={reconcileRoutes(
                                  routes,
                                  routeTargetPcs(row),
                                  row.piecesPerCase,
                                  rowMeta.routeUnit,
                                )}
                                unit="piece"
                                piecesPerCase={row.piecesPerCase}
                              />
                            )}
                          </div>
                        ) : routes.length === 0 ? (
                          emptyCell
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <RouteBalance
                                recon={reconcileRoutes(
                                  routes,
                                  routeTargetPcs(row),
                                  row.piecesPerCase,
                                  rowMeta.routeUnit,
                                )}
                                unit="piece"
                                piecesPerCase={row.piecesPerCase}
                              />
                              <span className="min-w-0 wrap-break-word">
                                {formatRouteSummary(routes, rowMeta.routeUnit)}
                              </span>
                            </div>
                            {/* Per-route readiness (production FINISH vs the
                                route's print deadline) — badged so the operator
                                sees which routes this line puts at risk. */}
                            <RouteStatusBadges
                              routes={routes}
                              statusByNumber={routeStatusByNumber}
                            />
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
