"use client";

import { Boxes, Loader2 } from "lucide-react";
import type { OrderTotals } from "../calculations";

type PrimalTotalsBarProps = {
  totals: OrderTotals;
  onPushOverstock: () => void;
  pushing: boolean;
};

// Sticky footer that always shows global totals across every category,
// plus the Overstock → Cooler Inventory action.
export function PrimalTotalsBar({
  totals,
  onPushOverstock,
  pushing,
}: PrimalTotalsBarProps) {
  const hasOverstock = totals.overstock_cases > 0 || totals.overstock_pcs > 0;

  return (
    <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <TotalBlock
            label="Today Total"
            cases={totals.today_cases}
            pcs={totals.today_pcs}
            tone="blue"
          />
          <TotalBlock
            label="Tomorrow Total"
            cases={totals.tmrw_cases}
            pcs={totals.tmrw_pcs}
            tone="emerald"
          />
          <TotalBlock
            label="O/S Total"
            cases={totals.overstock_cases}
            pcs={totals.overstock_pcs}
            tone="violet"
          />
        </div>

        <button
          type="button"
          onClick={onPushOverstock}
          disabled={pushing || !hasOverstock}
          title={
            hasOverstock
              ? "Push overstock to Cooler Inventory"
              : "No overstock to push"
          }
          className="flex h-12 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pushing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Boxes size={18} />
          )}
          Push Overstock (O/S) → Cooler Inventory
        </button>
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "text-blue-600",
  emerald: "text-emerald-600",
  violet: "text-violet-600",
};

function TotalBlock({
  label,
  cases,
  pcs,
  tone,
}: {
  label: string;
  cases: number;
  pcs: number;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`text-sm font-bold tabular-nums ${TONES[tone]}`}>
        {cases.toLocaleString()} cases
        <span className="mx-1.5 text-slate-300">|</span>
        {pcs.toLocaleString()} pcs
      </p>
    </div>
  );
}
