import type { LucideIcon } from "lucide-react";

// Shared building blocks for the dashboard's summary cards so every column
// reads the same top-to-bottom: uppercase section label, primary figure,
// tinted metric tiles, and a banner takeaway pinned to the bottom.

export type Accent =
  | "emerald"
  | "amber"
  | "red"
  | "blue"
  | "violet"
  | "teal"
  | "slate";

const ACCENT_STYLES: Record<
  Accent,
  { text: string; tile: string; banner: string }
> = {
  emerald: {
    text: "text-emerald-600",
    tile: "bg-emerald-50",
    banner: "bg-emerald-50 text-emerald-700",
  },
  amber: {
    text: "text-amber-600",
    tile: "bg-amber-50",
    banner: "bg-amber-50 text-amber-700",
  },
  red: {
    text: "text-red-600",
    tile: "bg-red-50",
    banner: "bg-red-50 text-red-700",
  },
  blue: {
    text: "text-blue-600",
    tile: "bg-blue-50",
    banner: "bg-blue-50 text-blue-700",
  },
  violet: {
    text: "text-violet-600",
    tile: "bg-violet-50",
    banner: "bg-violet-50 text-violet-700",
  },
  teal: {
    text: "text-teal-600",
    tile: "bg-teal-50",
    banner: "bg-teal-50 text-teal-700",
  },
  slate: {
    text: "text-slate-700",
    tile: "bg-slate-50",
    banner: "bg-slate-50 text-slate-600",
  },
};

// Uppercase column heading with a small leading icon, e.g. "Today's Production".
export function SectionLabel({
  icon: Icon,
  accent = "slate",
  children,
}: {
  icon?: LucideIcon;
  accent?: Accent;
  children: React.ReactNode;
}) {
  return (
    <h4
      className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${ACCENT_STYLES[accent].text}`}
    >
      {Icon ? <Icon size={14} strokeWidth={2.25} className="shrink-0" /> : null}
      {children}
    </h4>
  );
}

// Primary figure, e.g. "26 lines planned".
export function PrimaryCount({
  value,
  unit,
  bad = false,
}: {
  value: number;
  unit: string;
  bad?: boolean;
}) {
  return (
    <p
      className={`mt-2 text-3xl font-bold tabular-nums ${
        bad ? "text-red-600" : "text-slate-900"
      }`}
    >
      {value}
      <span className="ml-2 text-sm font-medium text-slate-500">
        {unit}
      </span>
    </p>
  );
}

// Three side-by-side tinted tiles under the primary figure, each with its
// count above a small label.
export function MetricTiles({
  metrics,
}: {
  metrics: { value: number; label: string; accent: Accent }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {metrics.map((metric) => {
        const styles = ACCENT_STYLES[metric.accent];
        return (
          <div
            key={metric.label}
            className={`rounded-2xl px-2 py-4 text-center ${styles.tile}`}
          >
            <div className={`text-xl font-bold tabular-nums ${styles.text}`}>
              {metric.value}
            </div>
            <div className="mt-0.5 text-xs font-medium text-slate-500">
              {metric.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// One-line takeaway banner pinned to the bottom of a column so every card's
// bottom edge aligns.
export function ColumnFooter({
  icon: Icon,
  accent,
  children,
}: {
  icon: LucideIcon;
  accent: Accent;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`mt-auto flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-medium ${ACCENT_STYLES[accent].banner}`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}
