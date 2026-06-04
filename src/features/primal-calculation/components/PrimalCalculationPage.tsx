"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
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
import { PrimalAvailabilityChart } from "./PrimalAvailabilityChart";
import { PrimalCsvImportModal } from "./PrimalCsvImportModal";
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

  // Availability — derived from intake counts + orders + cooler O/S.
  const availabilityRows = useMemo(
    () => buildAvailabilityRows(orders, counts),
    [orders, counts],
  );
  const availabilityTotals = useMemo(
    () => sumAvailability(availabilityRows),
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
        orders,
      );
      setConfirmPush(false);
      setToast(
        result.lines.length === 0
          ? "No overstock to push."
          : `Pushed ${result.totalCases} cases (${result.totalPcs} pcs) across ${result.lines.length} products to Cooler Inventory.`,
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
          <div className="flex items-center gap-2">
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
          <IntakeBanner
            status={intakeStatus.kind}
            errorMessage={
              intakeStatus.kind === "error" ? intakeStatus.message : undefined
            }
            regular={regularHogCount(counts)}
            sow={sowHogCount(counts)}
            sideOrders={intake.side_orders}
            forCutting={intakeTotals.forCutting}
            nextDayHogs={intake.next_day.hog_count}
            updatedAt={intake.updated_at}
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
              Import CSV
            </button>
          </div>

          {/* Category sections */}
          {PRIMAL_CATEGORIES.map((category) => (
            <PrimalCategorySection
              key={category}
              category={category}
              rows={rowsByCategory[category]}
              totals={categoryTotalsMap[category]}
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
            This will move all overstock (O/S) quantities for{" "}
            <span className="font-semibold tabular-nums">{date}</span> into
            Cooler Inventory.
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800 tabular-nums">
            {totals.overstock_cases} cases · {totals.overstock_pcs} pcs
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

// Read-only banner summarizing the hog intake values that drive yield.
function IntakeBanner({
  status,
  errorMessage,
  regular,
  sow,
  sideOrders,
  forCutting,
  nextDayHogs,
  updatedAt,
}: {
  status: "loading" | "ready" | "missing" | "error";
  errorMessage?: string;
  regular: number;
  sow: number;
  sideOrders: number;
  forCutting: number;
  nextDayHogs: number;
  updatedAt?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Hog Intake → Expected Yield
          </h2>
          <p className="text-xs text-slate-500">
            Regular Hogs = JP + RWA + BK · Sow Hogs shown for intake reference
          </p>
        </div>
        {status === "ready" && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-500" />
            From saved Hog Intake
            {updatedAt && ` · updated ${formatUpdatedAt(updatedAt)}`}
          </span>
        )}
        {status === "loading" && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 size={13} className="animate-spin" />
            Loading intake…
          </span>
        )}
        {status === "missing" && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <AlertCircle size={13} />
            No Hog Intake record for this date — Expected Production is 0
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle size={13} />
            {errorMessage ?? "Failed to load intake"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <IntakeStat label="Regular Hogs" value={regular} tone="emerald" />
        <IntakeStat label="Sow Hogs" value={sow} tone="violet" />
        <IntakeStat label="Side Orders" value={sideOrders} tone="amber" />
        <IntakeStat label="For Cutting" value={forCutting} tone="blue" />
        <IntakeStat label="Next-Day Hogs" value={nextDayHogs} tone="slate" />
      </div>
    </section>
  );
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

const STAT_TONES: Record<string, string> = {
  emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
  violet: "border-violet-200 bg-violet-50/60 text-violet-700",
  amber: "border-amber-200 bg-amber-50/60 text-amber-700",
  blue: "border-blue-200 bg-blue-50/60 text-blue-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

function IntakeStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div className={`rounded-xl border p-3 ${STAT_TONES[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="text-2xl font-extrabold tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
