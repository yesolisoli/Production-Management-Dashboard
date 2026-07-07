"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Clock, Lock } from "lucide-react";
import { clampNonNegativeInt } from "@/features/hog-intake/calculations";
import { deriveHogBreak } from "../calculations";
import { type HogBreakCalc, type HogType } from "../types";

// Per-hog-type accent — a colour dot beside the label. Kept within the palette
// the rest of the planner already uses (blue / amber / violet).
const HOG_STYLES: Record<HogType, { dot: string }> = {
  regular: { dot: "bg-blue-500" },
  sow: { dot: "bg-amber-600" },
  sow_shoulder: { dot: "bg-violet-500" },
};

// Display-only minutes of "main room" shown past its start so the timeline can
// carry a visible Main Room segment (its real run-length isn't modelled here).
const MAIN_ROOM_DISPLAY_MIN = 20;

// Diagonal hatch used for the buffer tail of the timeline (the changeover
// between the break ending and the main room starting).
const HATCH_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgb(148 163 184 / 0.18) 0, rgb(148 163 184 / 0.18) 1px, transparent 1px, transparent 7px)",
} as const;

// "Hog Break Calculator" — a standalone section above the production sheet. The
// morning kill counts decide how long the hog break runs and therefore when the
// main room can start. COUNTs are PULLED from the day's Hog Intake (Regular Hog =
// JP + RWA, Sow = Sow, Sow Shoulder = Sow × 2).
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

// Compact inline offset input shown beneath a derived clock time.
const inlineOffsetInputClass =
  "h-6 w-10 rounded border border-slate-200 bg-white px-1 text-right text-xs tabular-nums text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const emptyCell = <span className="text-slate-300">—</span>;

// One decimal place, or an em-dash when there is no work time yet.
function formatMinutes(minutes: number) {
  return minutes > 0 ? minutes.toFixed(1) : emptyCell;
}

// Minutes-of-day from a free-text "HH:MM" start ("05:00" -> 300); null when
// unparseable. Used to place the live "now" marker relative to the break start.
function parseStartMinutes(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = Number(m[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

// Two-digit 24-hour "HH:MM" for the live marker label.
function formatClockLabel(minutesOfDay: number): string {
  const total = ((Math.floor(minutesOfDay) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// The live clock, in minutes-of-day, refreshed on a light interval. Null until
// the client mounts, so the marker never renders on the server (no hydration
// mismatch). Positions are minute-granular, so a 30s tick is plenty.
function useNowMinutes(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function HogBreakCalculator({
  calc,
  onChange,
  intakeCounts,
}: HogBreakCalculatorProps) {
  const [open, setOpen] = useState(false);
  const result = deriveHogBreak(calc, intakeCounts);

  // Timeline geometry — the strip spans from HOG BREAK START, through the
  // changeover buffer, and a little way into the main room so it has a visible
  // Main Room segment. Everything is a share of that span. Only meaningful once
  // the start parses and there is break work to show.
  const mainRoomBufferMin = Math.max(0, calc.mainRoomBufferMin);
  const timelineSpan =
    result.totalMinutes + mainRoomBufferMin + MAIN_ROOM_DISPLAY_MIN;
  const showTimeline = result.end !== "" && result.totalMinutes > 0;
  const asPct = (min: number) =>
    timelineSpan > 0
      ? Math.min(100, Math.max(0, (min / timelineSpan) * 100))
      : 0;
  const breakPct = asPct(result.totalMinutes); // HOG BREAK END
  const mainRoomPct = asPct(result.totalMinutes + mainRoomBufferMin); // MAIN ROOM START
  const secondlinePct = asPct(calc.secondlineOffsetMin);

  // Live "you are here" marker — only meaningful while the current time falls
  // inside the break window (start → main room start); otherwise it is hidden.
  const nowMinutes = useNowMinutes();
  const startMinutes = parseStartMinutes(calc.start);
  const nowOffset =
    nowMinutes !== null && startMinutes !== null
      ? nowMinutes - startMinutes
      : null;
  const showNow =
    showTimeline &&
    nowOffset !== null &&
    nowOffset >= 0 &&
    nowOffset <= timelineSpan;
  const nowPct = nowOffset !== null ? asPct(nowOffset) : 0;

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
          {/* Timing strip — START is entered, the rest are derived. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <label className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Hog Break Start
              </span>
              <input
                type="text"
                value={calc.start}
                onChange={(e) => onChange({ start: e.target.value })}
                placeholder="05:00"
                aria-label="Hog break start time"
                className="w-full bg-transparent text-2xl font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
              />
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Lock size={11} className="shrink-0" />
                from hog intake
              </span>
            </label>
            <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Secondline Cutting
              </span>
              <span className="text-2xl font-semibold tabular-nums text-slate-800">
                {result.secondlineCutting || emptyCell}
              </span>
              <label className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>Start +</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={
                    calc.secondlineOffsetMin === 0
                      ? ""
                      : calc.secondlineOffsetMin
                  }
                  onChange={(e) =>
                    onChange({
                      secondlineOffsetMin: clampNonNegativeInt(e.target.value),
                    })
                  }
                  placeholder="0"
                  aria-label="Minutes after hog break start that secondline cutting begins"
                  className={inlineOffsetInputClass}
                />
                <span>min</span>
              </label>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Hog Break End
              </span>
              <span className="text-2xl font-semibold tabular-nums text-slate-800">
                {result.end || emptyCell}
              </span>
              <span className="text-[11px] text-slate-400">
                {result.totalMinutes > 0 ? (
                  <>
                    <span className="tabular-nums text-slate-500">
                      {result.totalMinutes.toFixed(1)}
                    </span>{" "}
                    min processing + buffer
                  </>
                ) : (
                  "processing + buffer"
                )}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                Main Room Start
              </span>
              <span className="text-2xl font-semibold tabular-nums text-emerald-700">
                {result.mainRoomStart || emptyCell}
              </span>
              <label className="flex items-center gap-1 text-[11px] text-emerald-600/80">
                <span>End +</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={
                    calc.mainRoomBufferMin === 0 ? "" : calc.mainRoomBufferMin
                  }
                  onChange={(e) =>
                    onChange({
                      mainRoomBufferMin: clampNonNegativeInt(e.target.value),
                    })
                  }
                  placeholder="0"
                  aria-label="Minutes between hog break end and main room start"
                  className={`${inlineOffsetInputClass} border-emerald-200 bg-white text-emerald-700 focus:border-emerald-400 focus:ring-emerald-100`}
                />
                <span>min</span>
              </label>
            </div>
          </div>

          {/* One compact card per hog type, all on a single row. */}
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {result.rows.map((row) => {
              const style = HOG_STYLES[row.type];
              return (
                <div
                  key={row.type}
                  className="rounded-xl border border-slate-200 bg-white p-3.5"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                    />
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {row.label}
                    </span>
                    <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                      {formatMinutes(row.totalMinutes)}
                      <span className="ml-0.5 text-xs font-normal text-slate-400">
                        min
                      </span>
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

          {/* Break timeline — a proportional strip from START to MAIN ROOM
              START. Times sit ABOVE the bar; the bar keeps a calm palette (light
              slate hog break, hatched buffer tail) with a single emerald accent
              for the main room start and the live "now" marker. */}
          {showTimeline && (
            <div className="mt-5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Break Timeline
              </span>
              {/* Clock times, positioned above their tick on the bar. */}
              <div className="relative mt-2 h-4 text-[11px] font-semibold tabular-nums">
                <span className="absolute left-0 text-slate-600">
                  {calc.start}
                </span>
                {secondlinePct > 8 && secondlinePct < breakPct - 4 && (
                  <span
                    className="absolute -translate-x-1/2 text-slate-600"
                    style={{ left: `${secondlinePct}%` }}
                  >
                    {result.secondlineCutting}
                  </span>
                )}
                <span
                  className="absolute text-slate-600"
                  style={{ left: `${breakPct}%`, transform: "translateX(-100%)" }}
                >
                  {result.end}
                </span>
                <span
                  className="absolute text-emerald-600"
                  style={{ left: `${mainRoomPct}%` }}
                >
                  {result.mainRoomStart}
                </span>
              </div>
              {/* The bar. */}
              <div className="relative mt-1 flex h-8 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                {/* Hog break — start → secondline cutting. */}
                <div
                  className="flex min-w-0 items-center bg-slate-500 px-2 text-xs font-medium text-white"
                  style={{ width: `${secondlinePct}%` }}
                >
                  <span className="truncate">Hog break</span>
                </div>
                {/* Secondline cutting — secondline → hog break end. */}
                <div
                  className="flex min-w-0 items-center bg-slate-400 px-2 text-xs font-medium text-white"
                  style={{ width: `${Math.max(0, breakPct - secondlinePct)}%` }}
                >
                  <span className="truncate">Secondline cutting</span>
                </div>
                {/* Buffer — end → main room start (changeover). */}
                <div
                  className="flex min-w-0 items-center justify-center px-1 text-xs font-medium text-slate-400"
                  style={{ ...HATCH_STYLE, width: `${mainRoomPct - breakPct}%` }}
                >
                  <span className="truncate">Buffer</span>
                </div>
                {/* Main room — from its start onward (display-only length). */}
                <div className="flex min-w-0 flex-1 items-center bg-emerald-600/90 px-2 text-xs font-medium text-white">
                  <span className="truncate">Main room</span>
                </div>
                {/* Live "now" marker — a line with the current time. */}
                {showNow && (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-10"
                    style={{ left: `${nowPct}%` }}
                  >
                    <span className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-slate-900" />
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-white/60 ${
                        nowPct > 50 ? "right-1.5" : "left-1.5"
                      }`}
                    >
                      {nowMinutes !== null ? formatClockLabel(nowMinutes) : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Totals across all hog types — a manual buffer (left) is folded
              into the TOTAL minutes alongside the break work time. */}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-6 border-t border-slate-100 px-1 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <label className="flex items-center gap-3">
              <span>Buffer</span>
              <span className="flex items-center gap-1 text-base normal-case tracking-normal text-slate-800">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={calc.bufferMin === 0 ? "" : calc.bufferMin}
                  onChange={(e) =>
                    onChange({ bufferMin: clampNonNegativeInt(e.target.value) })
                  }
                  placeholder="0"
                  aria-label="Buffer minutes added to the total"
                  className={numberInputClass.replace("w-full", "w-20")}
                />
                <span>min</span>
              </span>
            </label>
            <span className="flex items-center gap-4">
              <span>Total</span>
              <span className="flex items-center gap-4 text-base normal-case tracking-normal text-slate-800">
                <span className="tabular-nums">
                  {result.totalCount > 0 ? result.totalCount : emptyCell} head
                </span>
                <span className="tabular-nums">
                  {formatMinutes(result.totalMinutes)} min
                </span>
              </span>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
