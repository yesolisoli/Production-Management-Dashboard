// Pure derivation for Orders & Allocation (no I/O, no state).
//
// Everything here is recomputed from the raw draft / Primal snapshot on every
// render — none of these values are persisted. Mirrors the Primal Calculation
// convention where the view-model is derived in one place and the components
// just render it.

import { PRODUCT_SPEC_BY_SKU } from "@/features/primal-calculation/product-specs";
import {
  groupForCategory,
  PRIMAL_GROUPS,
  type GroupAvailability,
  type PrimalGroupKey,
} from "@/features/primal-calculation/types";
import type { PrimalDemandSnapshot } from "./primal-demand-source";
import {
  buildRoutePrinting,
  toMinutes,
  type RoutePrintStatus,
} from "./route-printing";
import {
  CUT_PHASES,
  defaultProductionMeta,
  DEFAULT_CUT_PHASE,
  HOG_TYPES,
  routeAssignmentUnit,
  SECONDLINE_CUTTING_OFFSET_MIN,
  START_CHAIN_BUFFER_SEC,
  unitShort,
  type AllocationInstruction,
  type AllocationProduct,
  type HogBreakCalc,
  type HogType,
  type ProductionMeta,
  type ProductionRoom,
  type ProductionRow,
  type RouteAssignment,
  type Unit,
} from "./types";

// Render a line's delivery-route split for the read row, e.g.
// "#9 (5 C/S) + #2 (2 PC)". Numeric route labels get a "#" prefix (so "9" ->
// "#9"); named routes are kept verbatim ("PUW"). Each quantity carries ITS OWN
// unit tag (PC / C/S) so a mixed split reads unambiguously; routes with no
// explicit unit fall back to the line's `fallbackUnit`. Entries with a blank
// route label are skipped; returns "" for no routes (the sheet shows an em-dash).
export function formatRouteSummary(
  routes: RouteAssignment[],
  fallbackUnit: Unit,
): string {
  return routes
    .filter((r) => r.route.trim() !== "")
    .map((r) => {
      const route = r.route.trim();
      const label = /^\d+$/.test(route) ? `#${route}` : route;
      const tag = unitShort(routeAssignmentUnit(r, fallbackUnit));
      return `${label} (${r.qty} ${tag})`;
    })
    .join(" + ");
}

// -------------------------------------------------------------------
// Clock helpers shared by FINISH and the production schedule. All arithmetic is
// done in seconds-of-day (0..86399); parsing accepts the floor's free-text START
// ("6:00" or "6:00:30", 24-hour), and formatting renders the canonical 12-hour
// display with seconds ("06:05:00 AM"). Every result wraps within a 24-hour
// clock.
// -------------------------------------------------------------------

// Parse "H:MM" / "H:MM:SS" (24-hour) to seconds-of-day; null when unparseable.
function parseClockToSeconds(text: string): number | null {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

// Seconds-of-day -> floor's canonical 12-hour display "hh:mm:ss AM/PM".
function formatClockSeconds(totalSec: number): string {
  const t = ((totalSec % (24 * 3600)) + 24 * 3600) % (24 * 3600);
  const h24 = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const meridiem = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h12)}:${pad(m)}:${pad(s)} ${meridiem}`;
}

// Seconds-of-day -> 24-hour "HH:MM" (minute-truncated). Used only to SEED the
// START editor from an auto-derived time: the TimeInput control is minute
// granular, so the buffer's sub-minute part is dropped and the operator's
// override lands on the nearest minute.
function formatClockInput(totalSec: number): string {
  const t = ((totalSec % (24 * 3600)) + 24 * 3600) % (24 * 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}`;
}

// The plant's production day starts in the early morning (hog break ~05:00) and
// never runs through the small hours. For available-time comparisons a clock
// time before this boundary is treated as the TAIL of the shift (past midnight),
// so it sorts AFTER the morning/afternoon rather than before it. This also fixes
// the common entry slip where a midday "12:xx" deadline lands on 12 AM (00:xx):
// left as-is it would read as earlier than an 11 AM finish and wrongly flag the
// line; shifted forward it correctly reads as later in the day.
const SHIFT_DAY_START_SEC = 4 * 3600; // 04:00

function toShiftOrder(secOfDay: number): number {
  return secOfDay < SHIFT_DAY_START_SEC ? secOfDay + 24 * 3600 : secOfDay;
}

// Net cutting seconds for a line: `secPerPc * pieces` spread across the cutters
// working in parallel (`/ cutters`, rounded up). `cutters` defaults to 1, so a
// missing / zero value means one cutter (no speed-up). 0 ⇒ no work time.
function workSeconds(secPerPc: number, pieces: number, cutters = 1): number {
  const cutterCount = Math.max(1, Math.floor(cutters));
  const totalSec = Math.max(0, Math.floor(secPerPc)) * Math.max(0, pieces);
  return Math.ceil(totalSec / cutterCount);
}

// Derive the FINISH clock time from a free-text START ("6:00" or "6:00:30"),
// SEC/PC (net seconds of work per piece), the row's PIECE COUNT and the number
// of CUTTERS working the line. FINISH is never entered or stored — the operator
// sets START, SEC/PC and CUTTERS; the work time is `secPerPc * pieces` spread
// across the cutters, and the end time follows. Returns "" when START is
// unparseable or the total work time is non-positive (the sheet shows an em-dash
// until the inputs are present). e.g. "6:00" + 10s/pc * 30pc (300s) over 1
// cutter -> "06:05:00 AM"; over 3 cutters (100s) -> "06:01:40 AM".
export function computeFinish(
  start: string,
  secPerPc: number,
  pieces: number,
  cutters = 1,
): string {
  const startSec = parseClockToSeconds(start);
  const work = workSeconds(secPerPc, pieces, cutters);
  if (startSec === null || work <= 0) return "";
  return formatClockSeconds(startSec + work);
}

// One production line's derived schedule: its effective START, the 24-hour value
// to seed the START editor from, its FINISH, and whether the START was chained
// from the previous line rather than entered. All "" until derivable.
export type RowSchedule = {
  start: string; // 12-hour "hh:mm:ss AM/PM"
  startInput: string; // 24-hour "HH:MM" to seed the START editor
  finish: string; // 12-hour "hh:mm:ss AM/PM"
  finishSec: number | null; // FINISH as seconds-of-day (null until derivable) —
  // exposed so route readiness can compare it against a print deadline
  autoStart: boolean; // START auto-chained from the previous line in the room
  // Carry Forward / available-time outcome. The FINISH is NEVER shortened to fit
  // the deadline — it always shows the real end time (the cell just turns red
  // when it runs past). `todayPcs` are cut today (drives the FINISH work time);
  // `carryForwardPcs` is what a MANUAL override moves to tomorrow (0 when none —
  // the auto split no longer silently reduces the schedule). `carryAuto` is true
  // when no manual override is set. `exceedsDeadline` is true when today's work
  // ends past the room's deadline. `suggestedCarryPcs` is how many of today's
  // pieces can't finish before the deadline — a hint for the supervisor, applied
  // only if they enter it. `deadline` is the room's deadline for display.
  todayPcs: number;
  carryForwardPcs: number;
  suggestedCarryPcs: number;
  carryAuto: boolean;
  exceedsDeadline: boolean;
  deadline: string; // 12-hour "hh:mm:ss AM/PM", or ""
};

// How many of a line's pieces still fit before the room deadline, given the
// line's START, its net cutting rate and the cutters working it. Mirrors
// workSeconds: available seconds * cutters / secPerPc, floored (a piece only
// counts if it fully completes before the deadline). Returns the ordered count
// when there is no deadline or no rate (nothing to overflow against).
function piecesFittingBeforeDeadline(
  startSec: number,
  deadlineSec: number | null,
  secPerPc: number,
  cutters: number,
  orderedPcs: number,
): number {
  if (deadlineSec === null || secPerPc <= 0) return orderedPcs;
  const availableSec = deadlineSec - startSec;
  if (availableSec <= 0) return 0;
  const cutterCount = Math.max(1, Math.floor(cutters));
  const fit = Math.floor((availableSec * cutterCount) / secPerPc);
  return Math.max(0, Math.min(orderedPcs, fit));
}

// Sequential, PER-ROOM schedule over a phase's rows in display order. A line's
// START is its own entered time when set; otherwise it auto-chains from the
// previous line's FINISH in the SAME room plus that previous line's own BUFFER
// (rooms cut in parallel, so each room chains independently; the buffer belongs
// to the line it follows). FINISH derives from START + work time and becomes the
// next line's baseline. Because it walks the rows in the operator's display
// order, any reorder — or moving a line to another room, or changing a buffer —
// recomputes the whole chain on the next render; nothing here is stored.
//
// `roomDeadlines` is the per-room "cut until" time. It does NOT reshape the
// schedule: the FINISH is always the real end time for the work planned today,
// so changing a START just shifts the FINISH — it never makes it disappear. When
// a line's FINISH runs past its room deadline it is flagged `exceedsDeadline`
// (the cell renders red) and `suggestedCarryPcs` reports how many pieces to move
// to tomorrow. Only a MANUAL override (meta.carryForwardPcs) actually holds
// pieces back and reduces the work.
export function deriveProductionSchedule(
  rows: ProductionRow[],
  metaFor: (row: ProductionRow) => ProductionMeta,
  roomDeadlines: Partial<Record<ProductionRoom, string>> = {},
): Map<string, RowSchedule> {
  // Per room: the last line's FINISH plus the buffer to hold before the next
  // line may start.
  const lastByRoom = new Map<
    ProductionRoom,
    { finishSec: number; bufferSec: number }
  >();
  const schedule = new Map<string, RowSchedule>();
  for (const row of rows) {
    const meta = metaFor(row);
    const bufferSec = Math.max(
      0,
      Math.floor(meta.bufferSec ?? START_CHAIN_BUFFER_SEC),
    );
    const entered = parseClockToSeconds(meta.start);
    let startSec: number | null = null;
    let autoStart = false;
    if (entered !== null) {
      startSec = entered;
    } else {
      const prev = lastByRoom.get(meta.room);
      if (prev !== undefined) {
        startSec = (prev.finishSec + prev.bufferSec) % (24 * 3600);
        autoStart = true;
      }
    }

    const deadlineSec = parseClockToSeconds(roomDeadlines[meta.room] ?? "");
    const orderedPcs = Math.max(0, row.qtyPcs);

    // Carry Forward no longer auto-shrinks the schedule: the FINISH always shows
    // the real end time for the work planned today — even past the deadline (the
    // cell just turns red). Only a MANUAL override actually moves pieces to
    // tomorrow and reduces the work; without one the whole order runs today, so
    // changing the START simply shifts the FINISH by the same amount instead of
    // making it vanish.
    const carryAuto = meta.carryForwardPcs == null;
    const carryForwardPcs = carryAuto
      ? 0
      : Math.max(0, Math.min(orderedPcs, Math.floor(meta.carryForwardPcs ?? 0)));
    const todayPcs = Math.max(0, orderedPcs - carryForwardPcs);

    // FINISH runs on today's pieces. The deadline compare walks the shift
    // timeline (toShiftOrder), so a line that ends past its room's deadline reads
    // as a genuine overflow while a small-hours "12 AM"-style deadline still
    // sorts as late in the day rather than before the morning.
    let finishSec: number | null = null;
    let exceedsDeadline = false;
    if (startSec !== null) {
      const work = workSeconds(meta.secPerPc, todayPcs, meta.cutters);
      if (work > 0) {
        finishSec = (startSec + work) % (24 * 3600);
        if (
          deadlineSec !== null &&
          toShiftOrder(startSec) + work > toShiftOrder(deadlineSec)
        ) {
          exceedsDeadline = true;
        }
      }
    }
    if (finishSec !== null) lastByRoom.set(meta.room, { finishSec, bufferSec });

    // Suggested overflow: how many of today's pieces can't finish before the
    // deadline. A hint shown in the Carry Fwd column (and the override's
    // placeholder) — never applied automatically, so the FINISH stays intact.
    let suggestedCarryPcs = 0;
    if (startSec !== null && deadlineSec !== null && exceedsDeadline) {
      suggestedCarryPcs =
        todayPcs -
        piecesFittingBeforeDeadline(
          toShiftOrder(startSec),
          toShiftOrder(deadlineSec),
          meta.secPerPc,
          meta.cutters,
          todayPcs,
        );
    }

    schedule.set(row.sku, {
      start: startSec !== null ? formatClockSeconds(startSec) : "",
      startInput: startSec !== null ? formatClockInput(startSec) : "",
      finish: finishSec !== null ? formatClockSeconds(finishSec) : "",
      finishSec,
      autoStart,
      todayPcs,
      carryForwardPcs,
      suggestedCarryPcs,
      carryAuto,
      exceedsDeadline,
      deadline: deadlineSec !== null ? formatClockSeconds(deadlineSec) : "",
    });
  }
  return schedule;
}

// Add `minutes` to a free-text "HH:MM" clock time, returning "HH:MM" on a
// 24-hour clock (wrapping past midnight). Returns "" when the start is
// unparseable. The minutes are rounded to the nearest whole minute, matching the
// hog-break sheet's clock-time display. e.g. "05:00" + 198.3 -> "08:18".
function addMinutesToClock(start: string, minutes: number): string {
  const match = start.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return "";
  const total =
    (((hours * 60 + mins + Math.round(minutes)) % (24 * 60)) + 24 * 60) %
    (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// One hog type's line on the calculator. COUNT is either PULLED from Hog Intake
// (sum of the type's `intakeKeys`) or entered by hand (`manual` types); SEC/HEAD
// is always an input; TOTAL MINUTES is their product (count * secPerHead, in
// minutes).
export type HogBreakRow = {
  type: HogType;
  label: string;
  count: number;
  manual: boolean; // true ⇒ COUNT is entered by hand, not from intake
  secPerHead: number;
  totalMinutes: number;
};

// Derived hog-break timing: per-type rows, the totals, and the clock times the
// break ends and the main room starts. Pure — recomputed from the raw calc
// inputs, never stored. END = START + total minutes; MAIN ROOM START = END +
// buffer. The clock times are "" until START parses (the sheet shows an
// em-dash).
export type HogBreakResult = {
  rows: HogBreakRow[];
  totalCount: number;
  workMinutes: number; // break minutes from the rows only (no buffer)
  bufferMin: number; // manual buffer folded into the total
  totalMinutes: number; // workMinutes + bufferMin
  secondlineCutting: string; // SECONDLINE CUTTING — START + offset
  end: string; // HOG BREAK END
  mainRoomStart: string; // MAIN ROOM START
};

// `intakeCounts` is the day's Hog Intake counts (HogCounts, keyed by intake hog
// type). A line's COUNT is the sum of its `intakeKeys` from that record, scaled
// by `intakeMultiplier` (e.g. Sow Shoulder = Sow × 2); lines with no
// `intakeKeys` (manual types) fall back to the operator-entered count.
export function deriveHogBreak(
  calc: HogBreakCalc,
  intakeCounts: Partial<Record<string, number>>,
): HogBreakResult {
  const rows: HogBreakRow[] = HOG_TYPES.map((t) => {
    const manual = (t.intakeKeys as readonly string[]).length === 0;
    const count = manual
      ? Math.max(0, Math.floor(calc.counts[t.value] ?? 0))
      : t.intakeKeys.reduce(
          (sum, key) => sum + Math.max(0, Math.floor(intakeCounts[key] ?? 0)),
          0,
        ) * t.intakeMultiplier;
    const secPerHead = Math.max(0, Math.floor(calc.secPerHead[t.value] ?? 0));
    return {
      type: t.value,
      label: t.label,
      count,
      manual,
      secPerHead,
      totalMinutes: (count * secPerHead) / 60,
    };
  });
  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);
  const workMinutes = rows.reduce((sum, r) => sum + r.totalMinutes, 0);
  const bufferMin = Math.max(0, Math.floor(calc.bufferMin ?? 0));
  const totalMinutes = workMinutes + bufferMin;
  const secondlineCutting = addMinutesToClock(
    calc.start,
    Math.max(0, Math.floor(calc.secondlineOffsetMin ?? SECONDLINE_CUTTING_OFFSET_MIN)),
  );
  const end = addMinutesToClock(calc.start, totalMinutes);
  const mainRoomStart = addMinutesToClock(end, calc.mainRoomBufferMin);
  return {
    rows,
    totalCount,
    workMinutes,
    bufferMin,
    totalMinutes,
    secondlineCutting,
    end,
    mainRoomStart,
  };
}

// Reconcile a line's delivery-route split against its ordered quantity, all in
// PIECES. A single line can mix units per route, so each route's qty is
// normalised to pieces (cases × piecesPerCase) before summing — that's the only
// common scale a mixed split reconciles on. `assigned`/`target`/`remaining` are
// therefore piece counts. Pure derivation — drives the validation badge on the
// sheet, never stored.
export type RouteReconciliation = {
  assigned: number; // total assigned, in pieces
  target: number; // ordered qty, in pieces
  remaining: number; // target - assigned (negative = over-assigned)
  status: "balanced" | "under" | "over";
};

export function reconcileRoutes(
  routes: RouteAssignment[],
  targetPcs: number,
  piecesPerCase: number,
  fallbackUnit: Unit,
): RouteReconciliation {
  const assigned = routes.reduce((sum, r) => {
    const qty = Math.max(0, r.qty);
    const pcs =
      routeAssignmentUnit(r, fallbackUnit) === "case"
        ? qty * piecesPerCase
        : qty;
    return sum + pcs;
  }, 0);
  const remaining = targetPcs - assigned;
  const status =
    remaining === 0 ? "balanced" : remaining > 0 ? "under" : "over";
  return { assigned, target: targetPcs, remaining, status };
}

export type InstructionsSummary = {
  count: number;
};

export function deriveInstructionsSummary(
  instructions: AllocationInstruction[],
): InstructionsSummary {
  return { count: instructions.length };
}

// -------------------------------------------------------------------
// Primal demand → production-sheet rows.
//
// One row per ordered SKU for the date: SKU, catalog name, Primal group, and the
// raw ordered quantities (cases + loose pieces). These are DERIVED — the screen
// overlays the operator's per-SKU operational fields (ProductionMeta) on top.
// SKUs with no catalog spec, or with zero ordered quantity, are skipped.
// -------------------------------------------------------------------
export function buildProductionRows(
  snapshot: PrimalDemandSnapshot,
): ProductionRow[] {
  const rows: ProductionRow[] = [];
  for (const [sku, order] of Object.entries(snapshot.skuOrders)) {
    const spec = PRODUCT_SPEC_BY_SKU[sku];
    if (!spec) continue;
    const qtyCases = Math.max(0, Math.round(order.today_cases));
    const qtyPcs = Math.max(0, Math.round(order.today_pcs));
    if (qtyCases <= 0 && qtyPcs <= 0) continue;
    rows.push({
      sku,
      name: spec.name,
      group: groupForCategory(spec.category).key as PrimalGroupKey,
      qtyCases,
      qtyPcs,
      piecesPerCase: Math.max(1, Math.round(spec.piecesPerCase)),
    });
  }
  // Canonical group order (PRIMAL_GROUPS), then SKU ascending within a group.
  const groupRank = (group: string) => {
    const i = PRIMAL_GROUPS.findIndex((g) => g.key === group);
    return i === -1 ? PRIMAL_GROUPS.length : i;
  };
  return rows.sort(
    (a, b) =>
      groupRank(a.group) - groupRank(b.group) || a.sku.localeCompare(b.sku),
  );
}

// Synthetic SKU prefix for production rows DERIVED from allocation instructions.
// Those lines have no catalog SKU, so the instruction id keys their operational
// overlay; the sheet uses this prefix to keep the SKU cell blank for them.
export const INSTRUCTION_ROW_SKU_PREFIX = "instruction:";

// Convert the morning-brief instructions into production-sheet rows for the
// After Hog Break phase. Each instruction becomes one row: its text is the line
// name, its category the product group, and its qty maps to the matching unit
// column (cases or loose pieces). There is no catalog SKU, so a stable synthetic
// key (the instruction id) carries the per-row operational overlay. Pure
// derivation — recomputed from the draft's instructions, never stored.
export function instructionProductionRows(
  instructions: AllocationInstruction[],
): ProductionRow[] {
  return instructions.map((ins) => {
    const qty = Math.max(0, Math.round(ins.qty));
    return {
      sku: `${INSTRUCTION_ROW_SKU_PREFIX}${ins.id}`,
      name: ins.instruction,
      group: ins.category,
      qtyCases: ins.unit === "case" ? qty : 0,
      qtyPcs: ins.unit === "case" ? 0 : qty,
      piecesPerCase: 1,
      defaultPhase: "after_hog_break",
    };
  });
}

// Apply the operator's manual row ordering (a persisted sequence of row SKUs) to
// the DERIVED production rows. Rows whose SKU appears in `order` sort by their
// position in it; rows absent from the list keep their canonical relative order
// (a stable sort leaves ties — including every unlisted row — in the incoming
// order). Pure derivation — the order list is the only persisted part.
export function orderProductionRows(
  rows: ProductionRow[],
  order: string[],
): ProductionRow[] {
  if (order.length === 0) return rows;
  const rank = new Map(order.map((sku, i) => [sku, i]));
  const rankOf = (sku: string) => rank.get(sku) ?? Number.POSITIVE_INFINITY;
  return [...rows].sort((a, b) => rankOf(a.sku) - rankOf(b.sku));
}

// Per-group ordered count (salesOrders) for the header strip. Every group in the
// availability set is included, in its given order.
export type GroupOrdered = { group: PrimalGroupKey; ordered: number };

export function orderedByGroup(
  availability: GroupAvailability[],
): GroupOrdered[] {
  return availability.map((row) => ({
    group: row.group,
    ordered: row.salesOrders,
  }));
}

// -------------------------------------------------------------------
// Route readiness — the bridge between the production sheet and the route
// printing schedule.
//
// A delivery route can't print its labels until every product shipping on it is
// cut. This derivation joins each route's PRINT DEADLINE (route-printing.ts) with
// the latest PRODUCTION FINISH among the sheet lines assigned to that route, so
// the floor sees — before printing time — whether a route is on track, at risk,
// or already late because its cutting runs past the deadline. Pure derivation
// over the raw draft + Primal rows; nothing here is stored.
// -------------------------------------------------------------------

// A route's production readiness against its print deadline.
//   late          — the latest product finish runs past the print deadline
//   at_risk       — finishes on or before the deadline, but within 30 minutes
//   on_track      — finishes with more than 30 minutes to spare (or no deadline)
//   carry_forward — the route has products, but none has a derivable finish today
//                   (all held to tomorrow, or timing not entered yet)
//   no_items      — no sheet line ships on this route
export type RouteProductionStatus =
  | "late"
  | "at_risk"
  | "on_track"
  | "carry_forward"
  | "no_items";

// Minutes of grace before the deadline under which a route reads as "at risk".
const ROUTE_AT_RISK_WINDOW_MIN = 30;

// Readiness of a SINGLE finish time vs a print deadline — shared by the route
// row (its latest product finish) and each Related Item (its own finish), so both
// read the same scale. No derivable finish ⇒ carry_forward; no deadline ⇒
// on_track; otherwise late / at_risk / on_track by the shift-timeline gap. The
// `no_items` case is a route-only concern and is handled by the caller.
function deriveFinishStatus(
  finishSec: number | null,
  deadlineMin: number | null,
): RouteProductionStatus {
  if (finishSec === null) return "carry_forward";
  if (deadlineMin === null) return "on_track";
  const minutesVs = Math.round(
    (toShiftOrder(finishSec) - toShiftOrder(deadlineMin * 60)) / 60,
  );
  if (minutesVs > 0) return "late";
  if (minutesVs >= -ROUTE_AT_RISK_WINDOW_MIN) return "at_risk";
  return "on_track";
}

// One product shipping on a route — the expandable "Related Items" detail.
export type RouteRelatedItem = {
  sku: string;
  name: string;
  group: AllocationProduct;
  room: ProductionRoom;
  qtyPcs: number; // pieces routed onto this route (route split, converted to pcs)
  finish: string; // the line's FINISH, 12-hour "hh:mm:ss AM/PM" ("" if none)
  finishSec: number | null;
  carryForwardPcs: number; // pieces this line holds to tomorrow
  // This item's OWN readiness vs the route's print deadline (its finish, not the
  // route's latest). Pinpoints which product gates a late/at-risk route. Derived
  // the same way as the route status (deriveFinishStatus); never "no_items".
  status: RouteProductionStatus;
};

// One route's merged readiness row: its print deadline, the products on it, the
// derived production readiness, and the printing actuals (reused from
// buildRoutePrinting) so the board shows both statuses side by side.
export type RouteStatusRow = {
  route: number;
  deadline: string; // print deadline, "h:mm AM/PM"
  items: RouteRelatedItem[];
  productionFinish: string; // latest finish among items, 12-hour ("" if none)
  productionFinishSec: number | null;
  minutesVsDeadline: number | null; // finish − deadline in minutes (null if N/A)
  productionStatus: RouteProductionStatus;
  printedTime: string | null; // actual printed time, "h:mm AM/PM" or null
  printStatus: RoutePrintStatus;
  note: string | null;
};

// Merge the per-phase production schedules into one sku → RowSchedule map. The
// sheet chains START/FINISH per phase (hog break, then after), so we derive each
// phase separately and merge — matching exactly the finishes the sheet renders.
function scheduleBySku(
  orderedRows: ProductionRow[],
  metaFor: (row: ProductionRow) => ProductionMeta,
  roomDeadlines: Partial<Record<ProductionRoom, string>>,
): Map<string, RowSchedule> {
  const merged = new Map<string, RowSchedule>();
  for (const phase of CUT_PHASES) {
    const phaseRows = orderedRows.filter(
      (row) => metaFor(row).phase === phase.value,
    );
    const sched = deriveProductionSchedule(phaseRows, metaFor, roomDeadlines);
    sched.forEach((value, sku) => merged.set(sku, value));
  }
  return merged;
}

// Build the route-readiness board for a planner date. Every route that has a
// print deadline that weekday becomes a row; each collects the sheet lines whose
// delivery-route split targets it (matched by route number), the latest of their
// finishes, and the resulting readiness. Named routes with no numeric deadline
// (e.g. "PUW") simply don't appear — the board is keyed by the deadline table,
// mirroring the printing schedule. Pure — recomputed from the draft each render.
export function deriveRouteStatuses({
  date,
  rows,
  meta,
  order,
  roomDeadlines,
  prints,
  notes,
  deadlines,
}: {
  date: string;
  rows: ProductionRow[];
  meta: Record<string, ProductionMeta>;
  order: string[];
  roomDeadlines: Partial<Record<ProductionRoom, string>>;
  prints: Record<string, string>;
  notes: Record<string, string>;
  deadlines: Record<string, string>;
}): RouteStatusRow[] {
  // Same meta fallback the sheet uses: an unedited row opens in its default phase
  // so its finish lands in the same phase chain the sheet renders.
  const metaFor = (row: ProductionRow): ProductionMeta =>
    meta[row.sku] ?? {
      ...defaultProductionMeta(),
      phase: row.defaultPhase ?? DEFAULT_CUT_PHASE,
    };

  const orderedRows = orderProductionRows(rows, order);
  const schedule = scheduleBySku(orderedRows, metaFor, roomDeadlines);
  const { rows: printRows } = buildRoutePrinting(date, prints, notes, deadlines);

  return printRows.map((printRow) => {
    const routeKey = String(printRow.route);
    const deadlineMin = toMinutes(printRow.deadline);

    // Every sheet line that puts a positive quantity on this route. Each item
    // carries its own readiness vs the route deadline so the detail pinpoints
    // which product gates the route.
    const items: RouteRelatedItem[] = [];
    for (const row of orderedRows) {
      const rowMeta = metaFor(row);
      const assignment = rowMeta.routes.find(
        (r) => r.route.trim() === routeKey && r.qty > 0,
      );
      if (!assignment) continue;
      const qtyPcs =
        routeAssignmentUnit(assignment, rowMeta.routeUnit) === "case"
          ? assignment.qty * row.piecesPerCase
          : assignment.qty;
      const sched = schedule.get(row.sku);
      const finishSec = sched?.finishSec ?? null;
      items.push({
        sku: row.sku,
        name: row.name,
        group: row.group,
        room: rowMeta.room,
        qtyPcs,
        finish: sched?.finish ?? "",
        finishSec,
        carryForwardPcs: sched?.carryForwardPcs ?? 0,
        status: deriveFinishStatus(finishSec, deadlineMin),
      });
    }

    // The route can't print until its LATEST product is cut.
    const finishSecs = items
      .map((it) => it.finishSec)
      .filter((s): s is number => s !== null);
    const productionFinishSec =
      finishSecs.length > 0 ? Math.max(...finishSecs) : null;

    // Compare on the shift timeline so an afternoon finish reads as later than a
    // morning deadline (and a small-hours "12 AM" slip sorts as late in the day).
    let minutesVsDeadline: number | null = null;
    if (productionFinishSec !== null && deadlineMin !== null) {
      const finishShift = toShiftOrder(productionFinishSec);
      const deadlineShift = toShiftOrder(deadlineMin * 60);
      minutesVsDeadline = Math.round((finishShift - deadlineShift) / 60);
    }

    // Route readiness: `no_items` when nothing ships on it, otherwise the same
    // finish-vs-deadline scale as each item, applied to the latest finish.
    const productionStatus: RouteProductionStatus =
      items.length === 0
        ? "no_items"
        : deriveFinishStatus(productionFinishSec, deadlineMin);

    return {
      route: printRow.route,
      deadline: printRow.deadline,
      items,
      productionFinish:
        productionFinishSec !== null
          ? formatClockSeconds(productionFinishSec)
          : "",
      productionFinishSec,
      minutesVsDeadline,
      productionStatus,
      printedTime: printRow.printedTime,
      printStatus: printRow.status,
      note: printRow.note,
    };
  });
}

// Tally of the readiness statuses that drive the sheet's summary strip. Routes
// with no items (or none flagged) are ignored — the strip reports only routes
// that carry work.
export type RouteStatusSummary = {
  late: number;
  atRisk: number;
  onTrack: number;
};

export function summarizeRouteStatuses(
  rows: RouteStatusRow[],
): RouteStatusSummary {
  return rows.reduce<RouteStatusSummary>(
    (acc, row) => {
      if (row.productionStatus === "late") acc.late += 1;
      else if (row.productionStatus === "at_risk") acc.atRisk += 1;
      else if (row.productionStatus === "on_track") acc.onTrack += 1;
      return acc;
    },
    { late: 0, atRisk: 0, onTrack: 0 },
  );
}
