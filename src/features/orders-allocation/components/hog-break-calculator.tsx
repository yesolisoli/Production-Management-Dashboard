"use client";

import { useState } from "react";
import { Beef, ChevronDown, Clock, Ham, PiggyBank } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import { deriveHogBreak } from "../calculations";
import { type HogBreakCalc, type HogType } from "../types";

// Per-hog-type glyph shown beside each row label.
const HOG_ICONS: Record<HogType, LucideIcon> = {
  regular: Ham,
  sow: PiggyBank,
  sow_shoulder: Beef,
};

// "Hog Break Calculator" — a standalone section above the production sheet. The
// morning kill counts decide how long the hog break runs and therefore when the
// main room can start. Most COUNTs are PULLED from the day's Hog Intake (Regular
// Hog = JP + RWA, Sow = Sow); only the manual types (Sow Shoulder) are typed in.
// The operator may tune SEC/HEAD; TOTAL MINUTES, the break END and the MAIN ROOM
// START are all DERIVED (deriveHogBreak). It is collapsed by default.
// Presentation only — every change is forwarded to the parent's state hook,
// which persists the inputs.
type HogBreakCalculatorProps = {
  calc: HogBreakCalc;
  onChange: (patch: Partial<HogBreakCalc>) => void;
  // The day's Hog Intake counts (keyed by intake hog type) — the source for the
  // non-manual COUNT lines.
  intakeCounts: Partial<Record<string, number>>;
};

const numberInputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-right text-sm tabular-nums text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const emptyCell = <span className="text-slate-300">—</span>;

// One decimal place, or an em-dash when there is no work time yet.
function formatMinutes(minutes: number) {
  return minutes > 0 ? minutes.toFixed(1) : emptyCell;
}

export function HogBreakCalculator({
  calc,
  onChange,
  intakeCounts,
}: HogBreakCalculatorProps) {
  const [open, setOpen] = useState(false);
  const result = deriveHogBreak(calc, intakeCounts);

  const setCount = (type: HogType, raw: string) =>
    onChange({ counts: { ...calc.counts, [type]: clampNonNegativeInt(raw) } });
  const setSecPerHead = (type: HogType, raw: string) =>
    onChange({
      secPerHead: { ...calc.secPerHead, [type]: clampNonNegativeInt(raw) },
    });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Collapsible header — doubles as the toggle. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Clock size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">
            Hog Break Calculator
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Counts come from Hog Intake; tune the rates to time the break.
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 sm:p-5">
          {/* Timing strip — START is entered, END and MAIN ROOM START are derived. */}
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Hog Break Start
              </span>
              <input
                type="text"
                value={calc.start}
                onChange={(e) => onChange({ start: e.target.value })}
                placeholder="05:00"
                aria-label="Hog break start time"
                className="w-full bg-transparent text-base font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
              />
            </label>
            <div className="flex flex-col gap-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Hog Break End
              </span>
              <span className="text-base font-semibold tabular-nums text-slate-700">
                {result.end || emptyCell}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Main Room Start
              </span>
              <span className="text-base font-semibold tabular-nums text-emerald-700">
                {result.mainRoomStart || emptyCell}
              </span>
            </div>
          </div>

          {/* One compact card per hog type, all on a single row. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {result.rows.map((row) => {
              const Icon = HOG_ICONS[row.type];
              return (
                <div
                  key={row.type}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon size={16} className="shrink-0 text-slate-400" />
                    <span className="truncate text-sm font-medium text-slate-800">
                      {row.label}
                    </span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-500">
                      {formatMinutes(row.totalMinutes)}
                      <span className="ml-0.5 text-slate-400">min</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Count
                      </span>
                      {row.manual ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={row.count === 0 ? "" : row.count}
                          onChange={(e) => setCount(row.type, e.target.value)}
                          placeholder="0"
                          aria-label={`${row.label} count`}
                          className={numberInputClass}
                        />
                      ) : (
                        // Pulled from Hog Intake — read-only.
                        <div
                          className="flex h-9 items-center justify-end rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 text-sm tabular-nums text-slate-500"
                          title="From Hog Intake"
                          aria-label={`${row.label} count (from Hog Intake)`}
                        >
                          {row.count > 0 ? row.count : emptyCell}
                        </div>
                      )}
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Sec / Head
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={row.secPerHead === 0 ? "" : row.secPerHead}
                        onChange={(e) => setSecPerHead(row.type, e.target.value)}
                        placeholder="0"
                        aria-label={`${row.label} seconds per head`}
                        className={numberInputClass}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals across all hog types. */}
          <div className="mt-2 flex items-center justify-end gap-4 px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <span>Total</span>
            <span className="flex items-center gap-4 text-base normal-case tracking-normal text-slate-800">
              <span className="tabular-nums">
                {result.totalCount > 0 ? result.totalCount : emptyCell} head
              </span>
              <span className="tabular-nums">
                {formatMinutes(result.totalMinutes)} min
              </span>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
