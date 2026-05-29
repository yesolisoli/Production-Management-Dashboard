import Link from "next/link";
import clsx from "clsx";
import { STATUS_META } from "../utils/classify-status";
import type { WorkAreaStats } from "../types";
import { StatusBadge } from "./status-badge";
import { ProgressBar } from "./progress-bar";

type MetricProps = {
  label: string;
  value: string | number;
  caption: string;
};

function Metric({ label, value, caption }: MetricProps) {
  return (
    <div className="rounded-xl bg-white/60 px-3 py-2 ring-1 ring-slate-200/60">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold text-slate-800">{value}</p>
      <p className="truncate text-[11px] text-slate-500">{caption}</p>
    </div>
  );
}

export function WorkAreaCard({ stats }: { stats: WorkAreaStats }) {
  const meta = STATUS_META[stats.status];
  const assignedPct =
    stats.required > 0
      ? Math.round((stats.assigned / stats.required) * 100)
      : 0;

  const overTargetValue =
    stats.overTarget > 0
      ? `+${stats.overTarget}`
      : stats.overTarget < 0
      ? `${stats.overTarget}`
      : "—";

  const overTargetCaption =
    stats.overTarget > 0
      ? "surplus"
      : stats.overTarget < 0
      ? `${Math.abs(stats.overTarget)} below target`
      : "at target";

  const lightDutyCaption =
    stats.lightDuty === 0 ? "none today" : "modified duty";

  const unavailableCount = stats.absent + stats.vacation;
  const unavailableCaption =
    unavailableCount === 0
      ? "all available"
      : `${stats.absent} absent · ${stats.vacation} vacation`;

  return (
    <Link
      href={`/assignment-board?workArea=${encodeURIComponent(stats.workAreaId)}`}
      className={clsx(
        "group flex flex-col gap-2.5 rounded-2xl p-3.5 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md",
        meta.cardClass,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-slate-800">
            {stats.workAreaName}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Headcount overview
          </p>
        </div>
        <StatusBadge status={stats.status} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="TOTAL STAFF"
          value={stats.assigned}
          caption={`of ${stats.required} required`}
        />
        <Metric
          label="OVER TARGET"
          value={overTargetValue}
          caption={overTargetCaption}
        />
        <Metric
          label="LIGHT DUTY"
          value={stats.lightDuty}
          caption={lightDutyCaption}
        />
        <Metric
          label="UNAVAILABLE"
          value={unavailableCount}
          caption={unavailableCaption}
        />
      </div>

      <div className="flex flex-col gap-1">
        <ProgressBar
          present={stats.assigned}
          required={stats.required}
          barClass={meta.barClass}
        />
        <p className="text-[11px] text-slate-600">
          {stats.assigned} / {stats.required} assigned · {assignedPct}%
          {stats.overTarget < 0 && ` · ${Math.abs(stats.overTarget)} below target`}
          {stats.overTarget > 0 && ` · +${stats.overTarget} surplus`}
        </p>
      </div>
    </Link>
  );
}
