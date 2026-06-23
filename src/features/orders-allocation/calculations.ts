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
  type AllocationInstruction,
  type HogBreakCalc,
  type HogType,
  type ProductionRow,
  type RouteAssignment,
} from "./types";

// Render a line's delivery-route split for the read row, e.g. "#9 (5) + #2 (2)".
// Numeric route labels get a "#" prefix (so "9" -> "#9"); named routes are kept
// verbatim ("PUW"). Entries with a blank route label are skipped; returns "" for
// no routes (the sheet shows an em-dash).
export function formatRouteSummary(routes: RouteAssignment[]): string {
  return routes
    .map((r) => ({ route: r.route.trim(), qty: r.qty }))
    .filter((r) => r.route !== "")
    .map((r) => {
      const label = /^\d+$/.test(r.route) ? `#${r.route}` : r.route;
      return `${label} (${r.qty})`;
    })
    .join(" + ");
}

// Derive the FINISH clock time from a free-text START ("6:00" or "6:00:30"),
// SEC/PC (net seconds of work per piece) and the row's PIECE COUNT. FINISH is
// never entered or stored — the operator sets START and SEC/PC, the work time
// is secPerPc * pieces, and the end time follows. Returns "" when START is
// unparseable or the total work time is non-positive (the sheet shows an
// em-dash until both inputs are present). Wraps within a 24-hour clock and
// renders as "H:MM:SS" (no leading-zero hour), e.g. "6:00" + 10s/pc * 30pc
// (300s) -> "6:05:00".
export function computeFinish(
  start: string,
  secPerPc: number,
  pieces: number,
): string {
  const workSec = Math.max(0, Math.floor(secPerPc)) * Math.max(0, pieces);
  const match = start.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match || workSec <= 0) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return "";
  const total = (hours * 3600 + minutes * 60 + seconds + workSec) % (24 * 3600);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
  totalMinutes: number;
  end: string; // HOG BREAK END
  mainRoomStart: string; // MAIN ROOM START
};

// `intakeCounts` is the day's Hog Intake counts (HogCounts, keyed by intake hog
// type). A line's COUNT is the sum of its `intakeKeys` from that record; lines
// with no `intakeKeys` (manual types) fall back to the operator-entered count.
export function deriveHogBreak(
  calc: HogBreakCalc,
  intakeCounts: Partial<Record<string, number>>,
): HogBreakResult {
  const rows: HogBreakRow[] = HOG_TYPES.map((t) => {
    const manual = t.intakeKeys.length === 0;
    const count = manual
      ? Math.max(0, Math.floor(calc.counts[t.value] ?? 0))
      : t.intakeKeys.reduce(
          (sum, key) => sum + Math.max(0, Math.floor(intakeCounts[key] ?? 0)),
          0,
        );
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
  const totalMinutes = rows.reduce((sum, r) => sum + r.totalMinutes, 0);
  const end = addMinutesToClock(calc.start, totalMinutes);
  const mainRoomStart = addMinutesToClock(end, calc.mainRoomBufferMin);
  return { rows, totalCount, totalMinutes, end, mainRoomStart };
}

// Reconcile a line's delivery-route split against its ordered piece count
// (Qty Pcs). `assigned` is the sum of route quantities; `remaining` is the
// target minus that (negative ⇒ more assigned than ordered). Pure derivation —
// drives the validation badge on the sheet, never stored.
export type RouteReconciliation = {
  assigned: number;
  target: number;
  remaining: number; // target - assigned (negative = over-assigned)
  status: "balanced" | "under" | "over";
};

export function reconcileRoutes(
  routes: RouteAssignment[],
  targetPcs: number,
): RouteReconciliation {
  const assigned = routes.reduce((sum, r) => sum + Math.max(0, r.qty), 0);
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
