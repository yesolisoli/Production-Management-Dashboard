import clsx from "clsx";
import type { LineupSummary } from "../types";

type Tile = {
  label: string;
  value: string | number;
  caption: string;
  cardClass: string;
  valueClass: string;
  captionClass: string;
};

function buildTiles(summary: LineupSummary): Tile[] {
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
      label: "TOTAL PRESENT",
      value: summary.totalPresent,
      caption: `of ${summary.totalTarget} target`,
      cardClass: "bg-emerald-50/70 ring-emerald-200/70",
      valueClass: "text-emerald-800",
      captionClass: "text-emerald-700/80",
    },
    {
      label: "UNAVAILABLE",
      value: unavailableTotal,
      caption: unavailableCaption,
      cardClass: "bg-rose-50/70 ring-rose-200/70",
      valueClass: "text-rose-700",
      captionClass: "text-rose-700/80",
    },
    {
      label: "SHORT DEPTS",
      value: shortTotal,
      caption: shortCaption,
      cardClass: "bg-amber-50/70 ring-amber-200/70",
      valueClass: "text-amber-700",
      captionClass: "text-amber-700/80",
    },
    {
      label: "OVER DEPTS",
      value: summary.deptsOver,
      caption: summary.deptsOver === 0 ? "none today" : "above target",
      cardClass: "bg-violet-50/70 ring-violet-200/70",
      valueClass: "text-violet-700",
      captionClass: "text-violet-700/80",
    },
    {
      label: "ON TRACK DEPTS",
      value: onTrackTotal,
      caption: onTrackCaption,
      cardClass: "bg-blue-50/70 ring-blue-200/70",
      valueClass: "text-blue-700",
      captionClass: "text-blue-700/80",
    },
  ];
}

export function SummaryTiles({ summary }: { summary: LineupSummary }) {
  const tiles = buildTiles(summary);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={clsx(
            "rounded-2xl px-4 py-3 ring-1",
            t.cardClass,
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {t.label}
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className={clsx("text-2xl font-bold", t.valueClass)}>
              {t.value}
            </span>
            <span className={clsx("truncate text-xs", t.captionClass)}>
              {t.caption}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
