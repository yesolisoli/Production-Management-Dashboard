"use client";

import { Fragment, useState } from "react";
import { ChevronRight, Info, Printer } from "lucide-react";
import type { RouteProductionStatus, RouteStatusRow } from "../calculations";
import { fromTimeInputValue, type RoutePrintStatus } from "../route-printing";
import {
  ROUTE_PRODUCTION_STATUS_BADGE,
  formatRouteFinishVsDeadline,
} from "../route-status-badge";
import { productDotClass, productionRoomLabel, type ProductionRoom } from "../types";
import { TimeInput } from "./time-input";

// Route Printing Schedule — the day's route status board. Each route joins its
// PRINT DEADLINE with the PRODUCTION FINISH of the sheet lines shipping on it
// (deriveRouteStatuses in calculations.ts), so the floor sees whether a route is
// on track to print — and, expanded, exactly which products gate it. The printed
// time / note remain operator inputs (persisted in the draft); everything else is
// derived. Presentation only.
type RoutePrintingSectionProps = {
  routeStatuses: RouteStatusRow[];
  prints: Record<string, string>; // route number → entered printed time
  notes: Record<string, string>; // route number → entered free-text note
  onSetRoutePrint: (route: string, time: string) => void;
  onSetRouteNote: (route: string, note: string) => void;
  onSetRouteDeadline: (route: string, time: string) => void;
};

// Print-status badge styling (actual printed time vs deadline) — distinct from
// the production readiness badge, so the board shows both side by side.
const PRINT_STATUS_BADGE: Record<
  RoutePrintStatus,
  { label: string; dot: string; chip: string; hint: string }
> = {
  on_time: {
    label: "Printed On Time",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    hint: "printed on or before deadline",
  },
  late: {
    label: "Printed Late",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700",
    hint: "printed after deadline",
  },
  not_printed: {
    label: "Not Printed",
    dot: "bg-slate-300",
    chip: "bg-slate-100 text-slate-500",
    hint: "not printed yet",
  },
};

// Solid per-room dot colour (mirrors the production sheet's room dots).
const ROOM_DOT_CLASSES: Record<ProductionRoom, string> = {
  main: "bg-emerald-500",
  second: "bg-sky-500",
  vacuum_pack: "bg-violet-500",
  overflow: "bg-amber-400",
};

// One item in a status-guide legend.
function LegendItem({
  dot,
  label,
  hint,
}: {
  dot: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="leading-tight">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className="ml-1.5 text-[11px] text-slate-400">{hint}</span>
      </div>
    </div>
  );
}

const emptyCell = <span className="text-slate-300">—</span>;

// Per-item readiness in the Related Items detail. A coloured dot always shows;
// the label is added only for statuses that need attention (late / at risk /
// carry forward) so an on-track item stays a quiet dot — the floor screen only
// calls out the products actually gating the route.
function ItemStatusBadge({ status }: { status: RouteProductionStatus }) {
  const badge = ROUTE_PRODUCTION_STATUS_BADGE[status];
  const showLabel = status !== "on_track";
  return (
    <span
      title={`${badge.label} — ${badge.hint}`}
      className={
        showLabel
          ? `inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${badge.chip}`
          : "inline-flex items-center"
      }
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`} />
      {showLabel && badge.label}
    </span>
  );
}

// "hh:mm:ss AM/PM" → "hh:mm AM/PM" (drop the seconds the sheet carries so the
// board reads like the floor's clock).
function shortClock(finish: string): string {
  return finish.replace(/^(\d{1,2}:\d{2}):\d{2}(\s*[AP]M)$/i, "$1$2");
}

export function RoutePrintingSection({
  routeStatuses,
  prints,
  notes,
  onSetRoutePrint,
  onSetRouteNote,
  onSetRouteDeadline,
}: RoutePrintingSectionProps) {
  // Which routes are expanded to show their Related Items. Pure UI state.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (route: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(route)) next.delete(route);
      else next.add(route);
      return next;
    });

  return (
    <section
      id="route-printing-schedule"
      className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Printer size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Route Printing Schedule
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Each route&apos;s print deadline vs when its products finish
              cutting. Expand a route to see the products gating it.
            </p>
          </div>
        </div>
      </header>

      {routeStatuses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center sm:py-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Printer size={20} />
          </span>
          <p className="text-sm font-semibold text-slate-600">
            No printing schedule for this day
          </p>
          <p className="max-w-md text-xs text-slate-400">
            Route deadlines are set Monday through Friday. Pick a weekday to see
            its schedule.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto p-4 sm:p-5">
          <table className="w-full min-w-248 table-fixed text-sm">
            <colgroup>
              <col className="w-9" />
              <col className="w-20" />
              <col className="w-32" />
              <col className="w-96" />
              <col className="w-44" />
              <col className="w-40" />
              <col className="w-44" />
              <col className="w-44" />
              <col />
            </colgroup>
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 [&>th]:border-b [&>th]:border-slate-200 [&>th]:bg-slate-50 [&>th]:px-3 [&>th]:py-2.5">
                <th className="rounded-l-lg" />
                <th>Route</th>
                <th>Deadline</th>
                <th>Related Products</th>
                <th>Production Finish</th>
                <th>
                  <span className="group relative inline-flex items-center gap-1 border-b border-dotted border-slate-300">
                    Production Status
                    <Info size={11} className="text-slate-400" />
                    <div className="invisible absolute left-0 top-full z-20 mt-2 w-max rounded-xl border border-slate-200 bg-white p-3 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                      <div className="flex flex-col gap-2 normal-case">
                        {(
                          [
                            "late",
                            "at_risk",
                            "on_track",
                            "carry_forward",
                            "no_items",
                          ] as const
                        ).map((s) => (
                          <LegendItem
                            key={s}
                            dot={ROUTE_PRODUCTION_STATUS_BADGE[s].dot}
                            label={ROUTE_PRODUCTION_STATUS_BADGE[s].label}
                            hint={ROUTE_PRODUCTION_STATUS_BADGE[s].hint}
                          />
                        ))}
                      </div>
                    </div>
                  </span>
                </th>
                <th>Time Printed</th>
                <th>
                  <span className="group relative inline-flex items-center gap-1 border-b border-dotted border-slate-300">
                    Print Status
                    <Info size={11} className="text-slate-400" />
                    <div className="invisible absolute left-0 top-full z-20 mt-2 w-max rounded-xl border border-slate-200 bg-white p-3 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                      <div className="flex flex-col gap-2 normal-case">
                        {(["on_time", "late", "not_printed"] as const).map(
                          (s) => (
                            <LegendItem
                              key={s}
                              dot={PRINT_STATUS_BADGE[s].dot}
                              label={PRINT_STATUS_BADGE[s].label}
                              hint={PRINT_STATUS_BADGE[s].hint}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  </span>
                </th>
                <th className="rounded-r-lg">Notes</th>
              </tr>
            </thead>
            <tbody>
              {routeStatuses.map((row) => {
                const prod = ROUTE_PRODUCTION_STATUS_BADGE[row.productionStatus];
                const print = PRINT_STATUS_BADGE[row.printStatus];
                const isOpen = expanded.has(row.route);
                const hasItems = row.items.length > 0;
                // Related products preview — first two lines, then "+N more".
                const preview = row.items.slice(0, 2);
                const moreCount = row.items.length - preview.length;

                return (
                  <Fragment key={row.route}>
                    <tr
                      onClick={() => hasItems && toggle(row.route)}
                      className={`[&>td]:border-b [&>td]:border-slate-100 [&>td]:px-3 [&>td]:py-3 ${
                        hasItems
                          ? "cursor-pointer transition hover:bg-slate-50/60"
                          : ""
                      } ${isOpen ? "bg-slate-50/60" : ""}`}
                    >
                      <td>
                        {hasItems && (
                          <ChevronRight
                            size={15}
                            className={`text-slate-400 transition ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          />
                        )}
                      </td>
                      <td className="font-semibold tabular-nums text-slate-900">
                        {row.route}
                      </td>
                      {/* Stop propagation so editing the deadline doesn't
                          toggle the row's expansion. */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <TimeInput
                          value={row.deadline}
                          onChange={(v) =>
                            onSetRouteDeadline(
                              String(row.route),
                              fromTimeInputValue(v),
                            )
                          }
                          ariaLabel={`Route ${row.route} print deadline`}
                          className="h-9 w-32"
                        />
                      </td>
                      <td className="text-slate-600">
                        {hasItems ? (
                          <div className="flex flex-col gap-0.5">
                            {preview.map((it) => (
                              <span
                                key={it.sku}
                                className="flex items-center gap-1.5 truncate text-xs"
                              >
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${productDotClass(
                                    it.group,
                                  )}`}
                                />
                                <span className="truncate">{it.name}</span>
                                <span className="shrink-0 tabular-nums text-slate-400">
                                  ({it.qtyPcs} PCS)
                                </span>
                              </span>
                            ))}
                            {moreCount > 0 && (
                              <span className="text-[11px] font-medium text-slate-400">
                                +{moreCount} more
                              </span>
                            )}
                          </div>
                        ) : (
                          emptyCell
                        )}
                      </td>
                      <td className="tabular-nums">
                        {row.productionFinish ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-700">
                              {shortClock(row.productionFinish)}
                            </span>
                            {row.minutesVsDeadline !== null && (
                              <span
                                className={`text-[11px] font-medium ${
                                  row.minutesVsDeadline > 0
                                    ? "text-red-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {formatRouteFinishVsDeadline(
                                  row.minutesVsDeadline,
                                )}
                              </span>
                            )}
                          </div>
                        ) : (
                          emptyCell
                        )}
                      </td>
                      <td>
                        <span
                          title={prod.hint}
                          className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${prod.chip}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${prod.dot}`}
                          />
                          {prod.label}
                        </span>
                      </td>
                      {/* Stop propagation so editing the time / note doesn't
                          toggle the row's expansion. */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <TimeInput
                          value={prints[String(row.route)] ?? ""}
                          onChange={(v) =>
                            onSetRoutePrint(
                              String(row.route),
                              fromTimeInputValue(v),
                            )
                          }
                          ariaLabel={`Route ${row.route} time printed`}
                          className="h-9 w-32"
                        />
                      </td>
                      <td>
                        <span
                          title={print.hint}
                          className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${print.chip}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${print.dot}`}
                          />
                          {print.label}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={notes[String(row.route)] ?? ""}
                          onChange={(e) =>
                            onSetRouteNote(String(row.route), e.target.value)
                          }
                          placeholder="Add note…"
                          aria-label={`Route ${row.route} note`}
                          className="h-9 w-full min-w-40 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                        />
                      </td>
                    </tr>

                    {/* Related Items — the products this route ships, revealed on
                        expand. The route can't print until the LATEST of these
                        finishes cutting. */}
                    {isOpen && hasItems && (
                      <tr>
                        <td />
                        <td
                          colSpan={8}
                          className="border-b border-slate-100 px-3 pb-3"
                        >
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
                            <div className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Related Items
                            </div>
                            <table className="w-full table-fixed text-sm">
                              <colgroup>
                                <col className="w-24" />
                                <col className="w-64" />
                                <col className="w-40" />
                                <col className="w-24" />
                                <col className="w-28" />
                                <col />
                              </colgroup>
                              <thead>
                                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 [&>th]:px-3 [&>th]:py-1.5">
                                  <th>SKU</th>
                                  <th>Product</th>
                                  <th>Room</th>
                                  <th className="text-right">Qty Pcs</th>
                                  <th>Finish</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.items.map((it) => (
                                  <tr
                                    key={it.sku}
                                    className="[&>td]:px-3 [&>td]:py-2 [&>td]:align-middle"
                                  >
                                    <td className="font-mono text-xs text-slate-500">
                                      {it.sku}
                                    </td>
                                    <td>
                                      <span className="flex items-center gap-2 font-medium text-slate-700">
                                        <span
                                          className={`h-2 w-2 shrink-0 rounded-full ${productDotClass(
                                            it.group,
                                          )}`}
                                        />
                                        {it.name}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="flex items-center gap-1.5 text-slate-600">
                                        <span
                                          className={`h-2 w-2 shrink-0 rounded-full ${ROOM_DOT_CLASSES[it.room]}`}
                                        />
                                        {productionRoomLabel(it.room)}
                                      </span>
                                    </td>
                                    <td className="text-right tabular-nums text-slate-900">
                                      {it.qtyPcs}
                                    </td>
                                    <td className="tabular-nums text-slate-600">
                                      {it.finish
                                        ? shortClock(it.finish)
                                        : emptyCell}
                                    </td>
                                    <td>
                                      <ItemStatusBadge status={it.status} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
