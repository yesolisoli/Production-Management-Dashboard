"use client";

import { useEffect, useRef, useState } from "react";
import { LineChart } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { todayString } from "@/lib/date";
import { formatDateLabel } from "../format";
import type { OverviewStatus } from "../hooks/use-operations-overview";
import type { RecentActivityDay } from "../hooks/use-recent-hog-activity";

// Series colors: CVD-validated pair (blue/emerald), matching the app's blue
// accent for intake and the Hog Intake module's emerald accent for cutting.
const HOGS_IN_COLOR = "#2563eb";
const FOR_CUTTING_COLOR = "#059669";

// One short deterministic sentence, in priority order:
// 1. cutting below intake on the trailing 2+ recorded days,
// 2. the latest day's intake noticeably (±10%) off the recent average,
// 3. otherwise a plain "looks normal".
function buildTakeaway(days: RecentActivityDay[], selectedDate: string): string {
  let run = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].forCutting < days[i].totalHogs) run += 1;
    else break;
  }
  if (run >= 2) {
    return run === days.length
      ? `More hogs came in than were cut on all ${run} recorded days.`
      : `More hogs came in than were cut on the last ${run} recorded days.`;
  }

  const last = days[days.length - 1];
  const prior = days.slice(0, -1);
  if (prior.length >= 2) {
    const average =
      prior.reduce((sum, day) => sum + day.totalHogs, 0) / prior.length;
    if (average > 0) {
      const isToday =
        last.date === selectedDate && selectedDate === todayString();
      const subject = isToday
        ? "Today's intake is"
        : `Intake on ${formatDateLabel(last.date)} was`;
      if (last.totalHogs >= average * 1.1) {
        return `${subject} higher than usual.`;
      }
      if (last.totalHogs <= average * 0.9) {
        return `${subject} lower than usual.`;
      }
    }
  }

  return "Intake and cutting look normal compared with recent days.";
}

// Clean y-axis bounds: pad the data range, snap to a 1/2/5×10ⁿ step, and
// always include ~4 ticks. Not zero-based — the gap between the two lines is
// the story, and hog counts live far from zero.
function niceScale(values: number[]): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 4);
  const rawStep = span / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ??
    10 * magnitude;
  const min = Math.max(0, Math.floor((lo - step / 2) / step) * step);
  const max = Math.ceil((hi + step / 2) / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  return { min, max, ticks };
}

const H = 232;
const MARGIN = { top: 24, right: 56, bottom: 34, left: 48 };

// Rendered at real pixel size (not a scaled viewBox) so axis and date labels
// stay readable at every screen width instead of shrinking with the chart.
function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function ActivityChart({ days }: { days: RecentActivityDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [containerRef, measuredWidth] = useContainerWidth();

  const W = Math.max(measuredWidth || 640, 240);
  const INNER_W = W - MARGIN.left - MARGIN.right;
  const INNER_H = H - MARGIN.top - MARGIN.bottom;

  const scale = niceScale(
    days.flatMap((day) => [day.totalHogs, day.forCutting]),
  );
  const x = (index: number) =>
    MARGIN.left + (days.length === 1 ? INNER_W / 2 : (index / (days.length - 1)) * INNER_W);
  const y = (value: number) =>
    MARGIN.top + (1 - (value - scale.min) / (scale.max - scale.min)) * INNER_H;

  // On narrow screens there isn't room for every date label — skip evenly,
  // anchored so the most recent date is always labeled.
  const pointSpacing = days.length > 1 ? INNER_W / (days.length - 1) : INNER_W;
  const labelStep = Math.max(1, Math.ceil(64 / pointSpacing));
  const showDateLabel = (index: number) =>
    (days.length - 1 - index) % labelStep === 0;

  const linePath = (pick: (day: RecentActivityDay) => number) =>
    days
      .map((day, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(pick(day))}`)
      .join(" ");

  // End-of-line value labels; nudged apart when the two lines converge.
  const lastIndex = days.length - 1;
  const last = days[lastIndex];
  let hogsLabelY = y(last.totalHogs);
  let cutLabelY = y(last.forCutting);
  const labelGap = cutLabelY - hogsLabelY;
  if (Math.abs(labelGap) < 18) {
    const push = (18 - Math.abs(labelGap)) / 2;
    if (labelGap >= 0) {
      hogsLabelY -= push;
      cutLabelY += push;
    } else {
      hogsLabelY += push;
      cutLabelY -= push;
    }
  }

  const hovered = hover === null ? null : days[hover];
  const tooltipWidth = 116;
  const tooltipX =
    hover === null
      ? 0
      : Math.min(Math.max(x(hover) - tooltipWidth / 2, MARGIN.left), W - MARGIN.right - tooltipWidth);

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="Line chart of hogs in and hogs for cutting on recent recorded days"
      >
      {scale.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={MARGIN.left}
            x2={W - MARGIN.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          <text
            x={MARGIN.left - 8}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={12}
            fill="#64748b"
          >
            {tick}
          </text>
        </g>
      ))}

      {days.map(
        (day, i) =>
          showDateLabel(i) && (
            <text
              key={day.date}
              x={x(i)}
              y={H - MARGIN.bottom + 20}
              textAnchor="middle"
              fontSize={12}
              fill="#64748b"
            >
              {formatDateLabel(day.date)}
            </text>
          ),
      )}

      {hover !== null && (
        <line
          x1={x(hover)}
          x2={x(hover)}
          y1={MARGIN.top}
          y2={H - MARGIN.bottom}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      )}

      <path
        d={linePath((day) => day.totalHogs)}
        fill="none"
        stroke={HOGS_IN_COLOR}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={linePath((day) => day.forCutting)}
        fill="none"
        stroke={FOR_CUTTING_COLOR}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="7 4"
      />

      {days.map((day, i) => (
        <g key={day.date}>
          <circle
            cx={x(i)}
            cy={y(day.totalHogs)}
            r={hover === i ? 5.5 : 4.5}
            fill={HOGS_IN_COLOR}
            stroke="#ffffff"
            strokeWidth={2}
          />
          <circle
            cx={x(i)}
            cy={y(day.forCutting)}
            r={hover === i ? 5.5 : 4.5}
            fill={FOR_CUTTING_COLOR}
            stroke="#ffffff"
            strokeWidth={2}
          />
        </g>
      ))}

      <text
        x={x(lastIndex) + 10}
        y={hogsLabelY}
        dominantBaseline="middle"
        fontSize={13}
        fontWeight={600}
        fill="#334155"
      >
        {last.totalHogs}
      </text>
      <text
        x={x(lastIndex) + 10}
        y={cutLabelY}
        dominantBaseline="middle"
        fontSize={13}
        fontWeight={600}
        fill="#334155"
      >
        {last.forCutting}
      </text>

      {hovered && hover !== null && (
        <g pointerEvents="none">
          <rect
            x={tooltipX}
            y={MARGIN.top}
            width={tooltipWidth}
            height={62}
            rx={8}
            fill="#ffffff"
            stroke="#e2e8f0"
          />
          <text
            x={tooltipX + 10}
            y={MARGIN.top + 18}
            fontSize={12}
            fontWeight={600}
            fill="#334155"
          >
            {formatDateLabel(hovered.date)}
          </text>
          <circle cx={tooltipX + 14} cy={MARGIN.top + 34} r={4} fill={HOGS_IN_COLOR} />
          <text x={tooltipX + 24} y={MARGIN.top + 38} fontSize={12} fill="#475569">
            In {hovered.totalHogs}
          </text>
          <circle cx={tooltipX + 14} cy={MARGIN.top + 50} r={4} fill={FOR_CUTTING_COLOR} />
          <text x={tooltipX + 24} y={MARGIN.top + 54} fontSize={12} fill="#475569">
            Cut {hovered.forCutting}
          </text>
        </g>
      )}

      <rect
        x={MARGIN.left}
        y={MARGIN.top}
        width={INNER_W}
        height={INNER_H}
        fill="transparent"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (days.length - 1));
          setHover(Math.min(Math.max(index, 0), days.length - 1));
        }}
      />
      </svg>
    </div>
  );
}

// Legend swatches mirror the actual line styles (solid vs dashed) so the two
// series stay tellable apart without relying on color alone.
function LegendKey({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
      <svg width="22" height="10" aria-hidden="true">
        <line
          x1="1"
          y1="5"
          x2="21"
          y2="5"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={dashed ? "5 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

// Data comes in as props — the client calls useRecentHogActivity once and
// shares the result with the Needs Attention rules.
export function RecentHogActivity({
  date,
  days,
  status,
}: {
  date: string;
  days: RecentActivityDay[];
  status: OverviewStatus;
}) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <LineChart size={15} strokeWidth={2} />
          </span>
          <h3 className="text-sm font-semibold text-slate-600">
            Recent Hog Activity
          </h3>
        </div>
        {status === "ready" && days.length >= 2 && (
          <div className="flex items-center gap-4">
            <LegendKey color={HOGS_IN_COLOR} label="Hogs In" />
            <LegendKey color={FOR_CUTTING_COLOR} label="For Cutting" dashed />
          </div>
        )}
      </div>

      {status === "loading" && (
        <div className="skeleton-shimmer mt-4 h-56 rounded-xl" />
      )}

      {status === "error" && (
        <EmptyState icon={LineChart} title="Couldn't load data" />
      )}

      {status === "ready" && days.length === 0 && (
        <EmptyState
          icon={LineChart}
          title="No hog intake recorded yet"
          description="This chart fills in as days are recorded on the Hog Intake page."
        />
      )}

      {status === "ready" && days.length === 1 && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Hogs In · {formatDateLabel(days[0].date)}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
                {days[0].totalHogs}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                For Cutting · {formatDateLabel(days[0].date)}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
                {days[0].forCutting}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Not enough history to show a trend yet.
          </p>
        </div>
      )}

      {status === "ready" && days.length >= 2 && (
        <>
          <div className="mt-1 flex-1">
            <ActivityChart days={days} />
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2.5 text-sm font-medium text-slate-600">
            {buildTakeaway(days, date)}
          </p>
        </>
      )}
    </section>
  );
}
