"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Boxes,
  Calendar,
  CheckCircle2,
  Loader2,
  Upload,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Modal } from "@/components/shared/modal";
import { deriveTotals } from "@/features/hog-intake/calculations";
import {
  buildAvailabilityRows,
  buildCustomerAvailability,
  categoryTotals,
  DEFAULT_MIN_COOLER_RESERVE,
  orderFor,
  primalTotalHogCount,
  sumAvailability,
} from "../calculations";
import {
  pushEndingStockToCooler,
  type EndingStockPushResult,
} from "../cooler-inventory";
import { specsForCategory } from "../product-specs";
import {
  groupForCategory,
  PRIMAL_CATEGORIES,
  PRIMAL_GROUPS,
  type CustomOrderRow,
  type PrimalCategory,
  type PrimalGroupKey,
} from "../types";
import { usePrimalCalculationState } from "../hooks/use-primal-calculation-state";
import { PrimalAvailabilityChart } from "./PrimalAvailabilityChart";
import { PrimalCsvImportModal } from "./PrimalCsvImportModal";
import { PrimalCustomerChart } from "./PrimalCustomerChart";
import {
  PrimalGroupSection,
  type CategorySkuRow,
  type GroupCategoryRows,
} from "./PrimalGroupSection";

export function PrimalCalculationPage() {
  const {
    date,
    intake,
    intakeStatus,
    orders,
    saveState,
    setDate,
    setOrderField,
    saveGroup,
    saveAll,
    clearGroup,
    applyImportedOrders,
    customerOrders,
    customCustomers,
    customRows,
    openingStock,
    setCustomerOrder,
    addCustomCustomer,
    renameCustomCustomer,
    removeCustomCustomer,
    addCustomRow,
    updateCustomRowSpec,
    setCustomRowField,
    removeCustomRow,
  } = usePrimalCalculationState();

  // Butts open by default (matches the reference); others collapsed.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Butts: true,
  });
  const [activeSku, setActiveSku] = useState<string | null>(null);
  const [confirmPush, setConfirmPush] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const counts = intake.hog_counts;

  // Per-category order-entry rows (spec + its editable order). Recomputed
  // only when orders change.
  const rowsByCategory = useMemo(() => {
    const map = {} as Record<PrimalCategory, CategorySkuRow[]>;
    for (const category of PRIMAL_CATEGORIES) {
      map[category] = specsForCategory(category).map((spec) => ({
        spec,
        order: orderFor(orders, spec.sku),
      }));
    }
    return map;
  }, [orders]);

  const categoryTotalsMap = useMemo(() => {
    const map = {} as Record<PrimalCategory, ReturnType<typeof categoryTotals>>;
    for (const category of PRIMAL_CATEGORIES) {
      map[category] = categoryTotals(category, orders);
    }
    return map;
  }, [orders]);

  // Manually added rows, bucketed by the group their category belongs to.
  const customRowsByGroup = useMemo(() => {
    const map = {} as Record<PrimalGroupKey, CustomOrderRow[]>;
    for (const group of PRIMAL_GROUPS) map[group.key] = [];
    for (const row of customRows) {
      const group = groupForCategory(row.spec.category);
      map[group.key as PrimalGroupKey].push(row);
    }
    return map;
  }, [customRows]);

  // Per-group view model: each group's per-category subgroups (rows + per-type
  // totals) plus the combined Today totals shown in the group header. Custom
  // rows pool into the same group totals as the catalog rows.
  const groupData = useMemo(
    () =>
      PRIMAL_GROUPS.map((group) => {
        const categoryRows: GroupCategoryRows[] = group.categories.map(
          (category) => ({
            category,
            rows: rowsByCategory[category],
            totals: categoryTotalsMap[category],
          }),
        );
        const groupCustomRows = customRowsByGroup[group.key];
        const groupTotals = groupCustomRows.reduce(
          (acc, r) => ({
            today_cases: acc.today_cases + r.order.today_cases,
            today_pcs: acc.today_pcs + r.order.today_pcs,
          }),
          categoryRows.reduce(
            (acc, c) => ({
              today_cases: acc.today_cases + c.totals.today_cases,
              today_pcs: acc.today_pcs + c.totals.today_pcs,
            }),
            { today_cases: 0, today_pcs: 0 },
          ),
        );
        return { group, categoryRows, customRows: groupCustomRows, groupTotals };
      }),
    [rowsByCategory, categoryTotalsMap, customRowsByGroup],
  );

  const intakeTotals = useMemo(() => deriveTotals(intake), [intake]);

  // Availability — derived from intake counts + today's orders + customer
  // orders + the opening-stock carry-in.
  const availabilityRows = useMemo(
    () =>
      buildAvailabilityRows(
        orders,
        counts,
        customerOrders,
        openingStock,
        customRows,
      ),
    [orders, counts, customerOrders, openingStock, customRows],
  );
  const availabilityTotals = useMemo(
    () => sumAvailability(availabilityRows),
    [availabilityRows],
  );

  // Calculated Ending Stock per group (pieces) — the figure shown read-only in
  // each group section and pushed to the cooler.
  const endingStockByGroup = useMemo(() => {
    const map = {} as Record<PrimalGroupKey, number>;
    for (const row of availabilityRows) map[row.group] = row.endingStock;
    return map;
  }, [availabilityRows]);

  // Customer chart columns — each category's Available Stock minus the
  // summed customer orders against it.
  const customerColumns = useMemo(
    () => buildCustomerAvailability(availabilityRows),
    [availabilityRows],
  );

  const handleToggle = (groupKey: PrimalGroupKey) =>
    setExpanded((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));

  const handlePush = async () => {
    setPushing(true);
    try {
      const result: EndingStockPushResult = await pushEndingStockToCooler(
        date,
        endingStockByGroup,
      );
      setConfirmPush(false);
      setToast(
        result.lines.length === 0
          ? "No ending stock to push."
          : `Pushed ${result.totalPcs} pcs across ${result.lines.length} groups to Cooler Inventory.`,
      );
    } finally {
      setPushing(false);
    }
  };

  return (
    <>
      <AppHeader
        eyebrow="Operations Module"
        title="Primal Calculation"
        actions={
          <div className="flex items-center gap-4">
            <IntakeHeaderStats
              status={intakeStatus.kind}
              primalTotal={primalTotalHogCount(counts)}
              sow={intake.sow_scheduled}
              sideOrders={intake.side_orders}
              forCutting={intakeTotals.forCutting}
              nextDayHogs={intake.next_day.hog_count}
              updatedAt={intake.updated_at}
            />

            <div className="hidden h-9 w-px bg-white/15 lg:block" />

            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={saveState.kind === "saving"}
              className="flex h-10 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              Save All
            </button>
            <label className="flex items-center gap-2 rounded-xl border border-white/30 px-3 py-2">
              <Calendar size={16} className="text-white/70" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-7 border-0 bg-transparent text-sm font-semibold tabular-nums text-white outline-none scheme-dark"
              />
            </label>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <div className="flex flex-col gap-4 px-5 py-5 lg:px-6">
          <PrimalAvailabilityChart
            rows={availabilityRows}
            totals={availabilityTotals}
            minReserve={DEFAULT_MIN_COOLER_RESERVE}
          />

          <PrimalCustomerChart
            columns={customerColumns}
            customerOrders={customerOrders}
            customCustomers={customCustomers}
            onChange={setCustomerOrder}
            onAddCustomer={addCustomCustomer}
            onRenameCustomer={renameCustomCustomer}
            onRemoveCustomer={removeCustomCustomer}
          />

          {/* Sales Orders section */}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Sales Orders
            </h2>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              <Upload size={16} />
              Import SAP Orders
            </button>
          </div>

          {/* Group sections */}
          {groupData.map(({ group, categoryRows, customRows, groupTotals }) => (
            <PrimalGroupSection
              key={group.key}
              group={group}
              categoryRows={categoryRows}
              customRows={customRows}
              groupTotals={groupTotals}
              calculatedEndingStockPcs={endingStockByGroup[group.key]}
              expanded={!!expanded[group.key]}
              onToggle={() => handleToggle(group.key)}
              activeSku={activeSku}
              onRowFocus={setActiveSku}
              onChangeField={setOrderField}
              onAddRow={() => addCustomRow(group.key)}
              onUpdateRowSpec={updateCustomRowSpec}
              onChangeCustomField={setCustomRowField}
              onRemoveRow={removeCustomRow}
              onSave={() => void saveGroup(group)}
              onClear={() => clearGroup(group)}
              saving={
                saveState.kind === "saving" && saveState.scope === group.key
              }
              justSaved={
                saveState.kind === "saved" && saveState.scope === group.key
              }
            />
          ))}
        </div>
      </div>

      {importing && (
        <PrimalCsvImportModal
          date={date}
          onClose={() => setImporting(false)}
          onApply={(imported) => {
            applyImportedOrders(imported);
            setToast(
              `Imported ${Object.keys(imported).length} products — review and Save to commit.`,
            );
          }}
        />
      )}

      {confirmPush && (
        <Modal
          title="Push Ending Stock to Cooler Inventory"
          onClose={() => !pushing && setConfirmPush(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmPush(false)}
                disabled={pushing}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => void handlePush()}
                disabled={pushing}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
              >
                {pushing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Boxes size={15} />
                )}
                {pushing ? "Pushing…" : "Confirm Push"}
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-600">
            This will move the calculated Ending Stock for{" "}
            <span className="font-semibold tabular-nums">{date}</span> into
            Cooler Inventory.
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800 tabular-nums">
            {availabilityTotals.endingStock.toLocaleString()} pcs
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Cooler Inventory integration is pending — this is a safe preview
            of what will be transferred.
          </p>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-2xl">
            <CheckCircle2 size={16} className="text-emerald-400" />
            {toast}
          </div>
        </div>
      )}
    </>
  );
}

// Compact hog-intake summary rendered inline in the page header. Shows the
// five intake values that drive yield, plus a small load-status indicator.
function IntakeHeaderStats({
  status,
  primalTotal,
  sow,
  sideOrders,
  forCutting,
  nextDayHogs,
  updatedAt,
}: {
  status: "loading" | "ready" | "missing" | "error";
  primalTotal: number;
  sow: number;
  sideOrders: number;
  forCutting: number;
  nextDayHogs: number;
  updatedAt?: string;
}) {
  // Only a saved DB record yields real numbers. For every other state the
  // values would all read 0 — which looks like genuine "zero hogs" data — so
  // we render an em dash instead and surface why with a visible badge.
  const ready = status === "ready";
  const stats = [
    { label: "Primal", value: primalTotal },
    { label: "Sow", value: sow },
    { label: "Side", value: sideOrders },
    { label: "Cutting", value: forCutting },
    { label: "Next-day", value: nextDayHogs },
  ];

  return (
    <div className="group relative hidden items-center gap-5 lg:flex">
      {!ready && <IntakeStatusBadge status={status} />}

      {stats.map((s) => (
        <div key={s.label} className="flex flex-col items-center leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            {s.label}
          </span>
          <span
            className={clsx(
              "mt-1 text-lg font-bold tabular-nums",
              ready ? "text-white" : "text-white/30",
            )}
          >
            {ready ? s.value.toLocaleString() : "—"}
          </span>
        </div>
      ))}

      {/* Custom light tooltip — appears on hover over the stat group. */}
      <div className="pointer-events-none absolute right-0 top-full z-30 mt-3 flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700 opacity-0 shadow-xl ring-1 ring-slate-200 transition-opacity duration-150 group-hover:opacity-100">
        <span className="absolute -top-1 right-6 h-2 w-2 rotate-45 bg-white ring-1 ring-slate-200" />
        <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
        {intakeStatusTooltip(status, updatedAt)}
      </div>
    </div>
  );
}

// At-a-glance pill explaining why the intake stats aren't showing numbers.
// Only rendered for non-ready states (loading / missing / error). "missing"
// is the common case — the operator entered Hog Intake but hasn't Saved it to
// the DB yet, and Primal reads DB-only — so the copy points them to the fix.
function IntakeStatusBadge({
  status,
}: {
  status: "loading" | "missing" | "error";
}) {
  if (status === "loading") {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white/70">
        <Loader2 size={13} className="animate-spin" />
        Loading intake…
      </span>
    );
  }

  const isError = status === "error";
  return (
    <span
      className={clsx(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1",
        isError
          ? "bg-rose-400/15 text-rose-200 ring-rose-300/30"
          : "bg-amber-400/15 text-amber-100 ring-amber-300/30",
      )}
    >
      <AlertTriangle size={13} className="shrink-0" />
      {isError ? "Intake load failed" : "Save Hog Intake to sync"}
    </span>
  );
}

// Hover-tooltip text describing where the intake numbers come from / their
// load state.
function intakeStatusTooltip(
  status: "loading" | "ready" | "missing" | "error",
  updatedAt?: string,
): string {
  switch (status) {
    case "loading":
      return "Loading Hog Intake…";
    case "missing":
      return "No saved Hog Intake for this date — Save it on the Hog Intake screen to sync these figures";
    case "error":
      return "Failed to load Hog Intake";
    default:
      return updatedAt
        ? `From saved Hog Intake · updated ${formatUpdatedAt(updatedAt)}`
        : "From saved Hog Intake";
  }
}

// Compact local timestamp for the "last saved" hint (e.g. "Jun 2, 14:30").
// Falls back to the raw string if it isn't a parseable date.
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

