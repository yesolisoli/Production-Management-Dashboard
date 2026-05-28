import clsx from "clsx";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Info,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { STATUS_META } from "../utils/classify-status";
import type { LineupStatus } from "../types";

type TooltipMeta = {
  icon: LucideIcon;
  iconClass: string;
  titleClass: string;
  description: string;
  actionIcon: LucideIcon;
  actionClass: string;
  actionLabel: string;
};

const STATUS_TOOLTIP: Record<LineupStatus, TooltipMeta> = {
  full_crew: {
    icon: Users,
    iconClass: "text-emerald-600 bg-emerald-100",
    titleClass: "text-emerald-700",
    description: "All required staff present",
    actionIcon: CheckCircle2,
    actionClass: "text-emerald-600",
    actionLabel: "Good to go",
  },
  on_track: {
    icon: Target,
    iconClass: "text-blue-600 bg-blue-100",
    titleClass: "text-blue-700",
    description: "1–2 staff below target",
    actionIcon: Info,
    actionClass: "text-blue-600",
    actionLabel: "Monitor",
  },
  short: {
    icon: TrendingUp,
    iconClass: "text-orange-600 bg-orange-100",
    titleClass: "text-orange-700",
    description: "3–4 staff below target",
    actionIcon: AlertTriangle,
    actionClass: "text-amber-600",
    actionLabel: "Take action",
  },
  critical: {
    icon: AlertOctagon,
    iconClass: "text-red-600 bg-red-100",
    titleClass: "text-red-700",
    description: "5 or more staff below target",
    actionIcon: AlertOctagon,
    actionClass: "text-red-600",
    actionLabel: "Immediate action",
  },
  over: {
    icon: ArrowUp,
    iconClass: "text-violet-600 bg-violet-100",
    titleClass: "text-violet-700",
    description: "Over target",
    actionIcon: Info,
    actionClass: "text-violet-600",
    actionLabel: "Rebalance",
  },
};

export function StatusBadge({ status }: { status: LineupStatus }) {
  const meta = STATUS_META[status];
  const tip = STATUS_TOOLTIP[status];
  const Icon = tip.icon;
  const ActionIcon = tip.actionIcon;
  return (
    <span className="group/badge relative inline-flex">
      <span
        className={clsx(
          "rounded-full px-3 py-1 text-[11px] font-bold tracking-wide",
          meta.badgeClass,
        )}
      >
        {meta.label}
      </span>
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute right-0 top-full z-20 mt-1.5 flex w-48 items-start gap-2 rounded-lg bg-white p-2 text-left opacity-0 shadow-lg ring-1 ring-slate-200/80 transition-opacity duration-150",
          "group-hover/badge:opacity-100 group-focus-within/badge:opacity-100",
        )}
      >
        <span
          className={clsx(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            tip.iconClass,
          )}
          aria-hidden
        >
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <span className={clsx("block text-[11px] font-bold uppercase tracking-wide", tip.titleClass)}>
            {meta.label}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-600">{tip.description}</span>
          <span className={clsx("mt-1 flex items-center gap-1 text-[11px] font-semibold", tip.actionClass)}>
            <ActionIcon size={11} strokeWidth={2.4} />
            {tip.actionLabel}
          </span>
        </span>
      </span>
    </span>
  );
}
