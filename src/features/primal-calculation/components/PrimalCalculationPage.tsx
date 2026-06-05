"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  globalTotals,
  orderFor,
  regularHogCount,
  sowHogCount,
  sumAvailability,
} from "../calculations";
import {
  pushOverstockToCooler,
  type OverstockPushResult,
} from "../cooler-inventory";
import { specsForCategory } from "../product-specs";
import { PRIMAL_CATEGORIES, type PrimalCategory } from "../types";
import { usePrimalCalculationState } from "../hooks/use-primal-calculation-state";
import {
  PrimalAvailabilityChart,
  PrimalAvailabilityKpis,
} from "./PrimalAvailabilityChart";
import { PrimalCsvImportModal } from "./PrimalCsvImportModal";
import { PrimalCustomerChart } from "./PrimalCustomerChart";
import {
  categorySlug,
  PrimalCategorySection,
  type CategorySkuRow,
} from "./PrimalCategorySection";
import { PrimalTotalsBar } from "./PrimalTotalsBar";

export function PrimalCalculationPage() {
  const {
    date,
    intake,
    intakeStatus,
    orders,
    saveState,
    setDate,
    setOrderField,
    bumpCategoryCases,
    clearCategory,
    saveCategory,
    saveAll,
    applyImportedOrders,
    customerOrders,
    yesterdayOverstock,
    setCustomerOrder,
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

  const totals = useMemo(() => globalTotals(orders), [orders]);
  const intakeTotals = useMemo(() => deriveTotals(intake), [intake]);

  // Availability — derived from intake counts + today's orders + customer
  // orders + yesterday's carried-in O/S.
  const availabilityRows = useMemo(
    () =>
      buildAvailabilityRows(orders, counts, customerOrders, yesterdayOverstock),
    [orders, counts, customerOrders, yesterdayOverstock],
  );
  const availabilityTotals = useMemo(
    () => sumAvailability(availabilityRows),
    [availabilityRows],
  );

  // Calculated Today's O/S per category (pieces) — the figure shown read-only
  // in each SKU section and pushed to the cooler.
  const overstockByCategory = useMemo(() => {
    const map = {} as Record<PrimalCategory, number>;
    for (const row of availabilityRows) map[row.category] = row.todaysOverstock;
    return map;
  }, [availabilityRows]);

  // Customer chart columns — each category's Available Stock minus the
  // summed customer orders against it.
  const customerColumns = useMemo(
    () => buildCustomerAvailability(availabilityRows),
    [availabilityRows],
  );

  const handleToggle = (category: PrimalCategory) =>
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));

  const handleTabClick = (category: PrimalCategory) => {
    setExpanded((prev) => ({ ...prev, [category]: true }));
    // Defer scroll until the section has expanded.
    requestAnimationFrame(() => {
      document
        .getElementById(`primal-cat-${categorySlug(category)}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      const result: OverstockPushResult = await pushOverstockToCooler(
        date,
        overstockByCategory,
      );
      setConfirmPush(false);
      setToast(
        result.lines.length === 0
          ? "No overstock to push."
          : `Pushed ${result.totalPcs} pcs across ${result.lines.length} categories to Cooler Inventory.`,
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
              regular={regularHogCount(counts)}
              sow={sowHogCount(counts)}
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
          <PrimalAvailabilityKpis totals={availabilityTotals} />

          <PrimalCustomerChart
            columns={customerColumns}
            customerOrders={customerOrders}
            onChange={setCustomerOrder}
          />

          <PrimalAvailabilityChart
            rows={availabilityRows}
            totals={availabilityTotals}
            minReserve={DEFAULT_MIN_COOLER_RESERVE}
          />

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2">
            {PRIMAL_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleTabClick(category)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                {category}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                  {specsForCategory(category).length}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setImporting(true)}
              className="ml-auto flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              <Upload size={16} />
              Import SAP Orders
            </button>
          </div>

          {/* Category sections */}
          {PRIMAL_CATEGORIES.map((category) => (
            <PrimalCategorySection
              key={category}
              category={category}
              rows={rowsByCategory[category]}
              totals={categoryTotalsMap[category]}
              calculatedOverstockPcs={overstockByCategory[category]}
              expanded={!!expanded[category]}
              onToggle={() => handleToggle(category)}
              activeSku={activeSku}
              onRowFocus={setActiveSku}
              onChangeField={setOrderField}
              onBumpCases={(delta) => bumpCategoryCases(category, delta)}
              onClear={() => clearCategory(category)}
              onSave={() => void saveCategory(category)}
              saving={
                saveState.kind === "saving" && saveState.scope === category
              }
              justSaved={
                saveState.kind === "saved" && saveState.scope === category
              }
            />
          ))}
        </div>

        <div className="mt-auto">
          <PrimalTotalsBar
            totals={totals}
            calculatedOverstockPcs={availabilityTotals.todaysOverstock}
            onPushOverstock={() => setConfirmPush(true)}
            pushing={pushing}
          />
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
          title="Push Overstock to Cooler Inventory"
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
            This will move the calculated Today&apos;s O/S for{" "}
            <span className="font-semibold tabular-nums">{date}</span> into
            Cooler Inventory.
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800 tabular-nums">
            {availabilityTotals.todaysOverstock.toLocaleString()} pcs
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
  regular,
  sow,
  sideOrders,
  forCutting,
  nextDayHogs,
  updatedAt,
}: {
  status: "loading" | "ready" | "missing" | "error";
  regular: number;
  sow: number;
  sideOrders: number;
  forCutting: number;
  nextDayHogs: number;
  updatedAt?: string;
}) {
  const stats = [
    { label: "Regular", value: regular },
    { label: "Sow", value: sow },
    { label: "Side", value: sideOrders },
    { label: "Cutting", value: forCutting },
    { label: "Next-day", value: nextDayHogs },
  ];

  return (
    <div className="group relative hidden items-center gap-5 lg:flex">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col items-start leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            {s.label}
          </span>
          <span className="mt-1 text-lg font-bold tabular-nums text-white">
            {s.value.toLocaleString()}
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
      return "No Hog Intake record for this date — Expected yield is 0";
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

