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
  HOG_TYPES,
  SECONDLINE_CUTTING_OFFSET_MIN,
  START_CHAIN_BUFFER_SEC,
  unitShort,
  type AllocationInstruction,
  type HogBreakCalc,
  type HogType,
  type ProductionMeta,
  type ProductionRoom,
  type ProductionRow,
  type RouteAssignment,
  type Unit,
} from "./types";

// Render a line's delivery-route split for the read row, e.g.
// "#9 (5 C/S) + #2 (2 C/S)". Numeric route labels get a "#" prefix (so "9" ->
// "#9"); named routes are kept verbatim ("PUW"). The quantity carries the line's
// route unit tag (PC / C/S) so the split reads unambiguously. Entries with a
// blank route label are skipped; returns "" for no routes (the sheet shows an
// em-dash).
export function formatRouteSummary(
  routes: RouteAssignment[],
  unit: Unit,
): string {
  const tag = unitShort(unit);
  return routes
    .map((r) => ({ route: r.route.trim(), qty: r.qty }))
    .filter((r) => r.route !== "")
    .map((r) => {
      const label = /^\d+$/.test(r.route) ? `#${r.route}` : r.route;
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
  autoStart: boolean; // START auto-chained from the previous line in the room
};

// Sequential, PER-ROOM schedule over a phase's rows in display order. A line's
// START is its own entered time when set; otherwise it auto-chains from the
// previous line's FINISH in the SAME room plus that previous line's own BUFFER
// (rooms cut in parallel, so each room chains independently; the buffer belongs
// to the line it follows). FINISH derives from START + work time and becomes the
// next line's baseline. Because it walks the rows in the operator's display
// order, any reorder — or moving a line to another room, or changing a buffer —
// recomputes the whole chain on the next render; nothing here is stored.
export function deriveProductionSchedule(
  rows: ProductionRow[],
  metaFor: (row: ProductionRow) => ProductionMeta,
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
    let finishSec: number | null = null;
    if (startSec !== null) {
      const work = workSeconds(meta.secPerPc, row.qtyPcs, meta.cutters);
      if (work > 0) finishSec = (startSec + work) % (24 * 3600);
    }
    if (finishSec !== null) lastByRoom.set(meta.room, { finishSec, bufferSec });
    schedule.set(row.sku, {
      start: startSec !== null ? formatClockSeconds(startSec) : "",
      startInput: startSec !== null ? formatClockInput(startSec) : "",
      finish: finishSec !== null ? formatClockSeconds(finishSec) : "",
      autoStart,
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

// Reconcile a line's delivery-route split against its ordered quantity in the
// line's chosen unit (cases or pieces). `assigned` is the sum of route
// quantities; `remaining` is the target minus that (negative ⇒ more assigned
// than ordered). Pure derivation — drives the validation badge on the sheet,
// never stored.
export type RouteReconciliation = {
  assigned: number;
  target: number;
  remaining: number; // target - assigned (negative = over-assigned)
  status: "balanced" | "under" | "over";
};

export function reconcileRoutes(
  routes: RouteAssignment[],
  target: number,
): RouteReconciliation {
  const assigned = routes.reduce((sum, r) => sum + Math.max(0, r.qty), 0);
  const remaining = target - assigned;
  const status =
    remaining === 0 ? "balanced" : remaining > 0 ? "under" : "over";
  return { assigned, target, remaining, status };
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
