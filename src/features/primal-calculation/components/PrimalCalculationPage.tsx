"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Loader2,
  Save,
  Upload,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import {
  DEFAULT_MIN_COOLER_RESERVE,
  primalTotalHogCount,
} from "../calculations";
import { usePrimalCalculationState } from "../hooks/use-primal-calculation-state";
import { derivePrimalViewModel } from "../view-model";
import { PrimalAvailabilityChart } from "./PrimalAvailabilityChart";
import { PrimalCsvImportModal } from "./PrimalCsvImportModal";
import { PrimalCustomerChart } from "./PrimalCustomerChart";
import { PrimalGroupSection } from "./PrimalGroupSection";

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
    customGroups,
    customRows,
    openingStock,
    setCustomerOrder,
    addCustomCustomer,
    renameCustomCustomer,
    removeCustomCustomer,
    addCustomGroup,
    renameCustomGroup,
    removeCustomGroup,
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
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // All derived data is assembled by the pure view model; this component only
  // memoizes the single call and renders the result. See ../view-model.ts.
  const {
    counts,
    intakeTotals,
    groupData,
    availabilityRows,
    customGroupRows,
    customGroupData,
    customerColumns,
  } = useMemo(
    () =>
      derivePrimalViewModel({
        intake,
        orders,
        customerOrders,
        customGroups,
        customRows,
        openingStock,
      }),
    [intake, orders, customerOrders, customGroups, customRows, openingStock],
  );

  const handleToggle = (groupKey: string) =>
    setExpanded((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));

  return (
    <>
      <AppHeader
        eyebrow="Operations Module"
        title="Primal Calculation"
        actions={
          <div className="flex items-center gap-2 sm:gap-4">
            <IntakeHeaderStats
              status={intakeStatus.kind}
              primalTotal={primalTotalHogCount(counts)}
              sow={intake.todays_cutting}
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
              title="Save All"
              className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-white/30 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60 sm:w-auto sm:px-4"
            >
              <Save size={16} />
              <span className="hidden sm:inline">Save All</span>
            </button>
            <label className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 sm:h-auto sm:w-auto sm:justify-start sm:gap-2 sm:px-3 sm:py-2">
              <Calendar size={16} className="shrink-0 text-white/70" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0 sm:static sm:h-7 sm:w-auto sm:min-w-0 sm:cursor-auto sm:border-0 sm:bg-transparent sm:text-sm sm:font-semibold sm:tabular-nums sm:text-white sm:opacity-100 sm:outline-none sm:scheme-dark"
              />
            </label>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <div className="flex flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
          <PrimalAvailabilityChart
            rows={availabilityRows}
            customRows={customGroupRows}
            minReserve={DEFAULT_MIN_COOLER_RESERVE}
            onAddGroup={addCustomGroup}
            onRenameGroup={renameCustomGroup}
            onRemoveGroup={removeCustomGroup}
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
          {groupData.map(({ group, categoryRows, customRows, groupTotals, endingStock, status }) => (
            <PrimalGroupSection
              key={group.key}
              group={group}
              categoryRows={categoryRows}
              customRows={customRows}
              groupTotals={groupTotals}
              calculatedEndingStockPcs={endingStock}
              endingStockStatus={status}
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
              // Rows auto-persist as a per-date draft on every edit, so the
              // per-group Save/Clear footer is redundant — hidden to match the
              // custom availability sections below.
              showSaveClear={false}
            />
          ))}

          {/* Custom availability groups — each gets its own ad-hoc Sales Orders
              section. Rows auto-persist, so Save/Clear is hidden. */}
          {customGroupData.map(({ group, rows, groupTotals, endingStock, status }) => (
            <PrimalGroupSection
              key={group.key}
              group={group}
              categoryRows={[]}
              customRows={rows}
              groupTotals={groupTotals}
              calculatedEndingStockPcs={endingStock}
              endingStockStatus={status}
              expanded={!!expanded[group.key]}
              onToggle={() => handleToggle(group.key)}
              activeSku={activeSku}
              onRowFocus={setActiveSku}
              onChangeField={setOrderField}
              onAddRow={() => addCustomRow(group.key)}
              onUpdateRowSpec={updateCustomRowSpec}
              onChangeCustomField={setCustomRowField}
              onRemoveRow={removeCustomRow}
              onSave={() => {}}
              onClear={() => {}}
              saving={false}
              justSaved={false}
              showSaveClear={false}
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

