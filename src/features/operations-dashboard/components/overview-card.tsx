import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

type ChipTone = "blue" | "violet" | "sky" | "emerald" | "amber" | "slate";

const CHIP_TONES: Record<ChipTone, string> = {
  blue: "bg-blue-50 text-blue-500",
  violet: "bg-violet-50 text-violet-500",
  sky: "bg-sky-50 text-sky-500",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-500",
};

type ValueTone = "default" | "good" | "warn";

const VALUE_TONES: Record<ValueTone, string> = {
  default: "text-slate-900",
  good: "text-emerald-600",
  warn: "text-amber-600",
};

type OverviewCardProps = {
  title: string;
  icon: LucideIcon;
  chipTone: ChipTone;
  loading?: boolean;
  // The one large figure. Numbers render tabular; short phrases (e.g.
  // "On target") are allowed too.
  value: string;
  valueTone?: ValueTone;
  unit?: string;
  // Secondary line under the value — comparison text or a "no data" note.
  caption?: string;
};

export function OverviewCard({
  title,
  icon: Icon,
  chipTone,
  loading = false,
  value,
  valueTone = "default",
  unit,
  caption,
}: OverviewCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            CHIP_TONES[chipTone],
          )}
        >
          <Icon size={15} strokeWidth={2} />
        </span>
        <p className="text-sm font-semibold text-slate-600">{title}</p>
      </div>

      {loading ? (
        <div className="skeleton-shimmer mt-3 h-9 w-24 rounded-lg" />
      ) : (
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
          <span
            className={clsx(
              "text-4xl font-bold leading-none tracking-tight tabular-nums",
              // A muted "no value" dash — at this size a full-ink dash reads
              // as a solid black bar rather than a placeholder.
              value === "—" ? "text-slate-300" : VALUE_TONES[valueTone],
            )}
          >
            {value}
          </span>
          {unit ? (
            <span className="text-base font-medium text-slate-500">{unit}</span>
          ) : null}
        </div>
      )}

      <p className="mt-2 min-h-5 text-sm text-slate-500">
        {loading ? "" : caption}
      </p>
    </div>
  );
}
