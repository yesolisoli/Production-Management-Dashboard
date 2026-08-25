import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { LineupSummary } from "../types";

type Tone = "emerald" | "rose" | "amber" | "violet" | "blue";

export type Tile = {
  label: string;
  value: string | number;
  caption: string;
  tone: Tone;
  icon: LucideIcon;
};

export const ICON_TONES: Record<Tone, { chipBg: string; chipFg: string }> = {
  emerald: { chipBg: "bg-emerald-50", chipFg: "text-emerald-500" },
  rose: { chipBg: "bg-rose-50", chipFg: "text-rose-500" },
  amber: { chipBg: "bg-amber-50", chipFg: "text-amber-500" },
  violet: { chipBg: "bg-violet-50", chipFg: "text-violet-500" },
  blue: { chipBg: "bg-blue-50", chipFg: "text-blue-500" },
};

export function buildTiles(summary: LineupSummary): Tile[] {
  const shortTotal = summary.deptsShort + summary.deptsCritical;
  const shortCaption =
    summary.deptsCritical > 0
      ? `${summary.deptsCritical} critical · ${summary.deptsShort} short`
      : shortTotal === 0
      ? "none today"
      : `${summary.deptsShort} short`;

  const onTrackTotal = summary.deptsOnTrack + summary.deptsFullCrew;
  const onTrackCaption =
    summary.deptsFullCrew > 0
      ? `${summary.deptsFullCrew} full · ${summary.deptsOnTrack} on track`
      : onTrackTotal === 0
      ? "none today"
      : `${summary.deptsOnTrack} on track`;

  const unavailableTotal = summary.totalAbsent + summary.onVacation;
  const unavailableCaption =
    unavailableTotal === 0
      ? "all available"
      : `${summary.totalAbsent} absent · ${summary.onVacation} vacation`;

  return [
    {
      label: "TOTAL STAFF",
      value: summary.totalAssigned,
      caption: `of ${summary.totalTarget} target`,
      tone: "emerald",
      icon: Users,
    },
    {
      label: "UNAVAILABLE",
      value: unavailableTotal,
      caption: unavailableCaption,
      tone: "rose",
      icon: UserMinus,
    },
    {
      label: "SHORT DEPTS",
      value: shortTotal,
      caption: shortCaption,
      tone: "amber",
      icon: AlertTriangle,
    },
    {
      label: "OVER DEPTS",
      value: summary.deptsOver,
      caption: summary.deptsOver === 0 ? "none today" : "above target",
      tone: "violet",
      icon: TrendingUp,
    },
    {
      label: "ON TRACK DEPTS",
      value: onTrackTotal,
      caption: onTrackCaption,
      tone: "blue",
      icon: CheckCircle2,
    },
  ];
}

export function SummaryTiles({ summary }: { summary: LineupSummary }) {
  const tiles = buildTiles(summary);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t) => {
        const tone = ICON_TONES[t.tone];
        const Icon = t.icon;
        return (
          <div
            key={t.label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t.label}
              </p>
              <span
                className={clsx(
                  "flex h-6 w-6 items-center justify-center rounded-md",
                  tone.chipBg,
                )}
              >
                <Icon size={13} className={tone.chipFg} strokeWidth={2} />
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {t.value}
              </span>
              <span className="truncate text-xs text-slate-500">
                {t.caption}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
