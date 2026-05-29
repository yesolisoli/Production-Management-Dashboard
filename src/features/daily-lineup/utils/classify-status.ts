import type { LineupStatus } from "../types";

export function classifyStatus(present: number, required: number): LineupStatus {
  if (present > required) return "over";
  const deficit = required - present;
  if (deficit >= 5) return "critical";
  if (deficit >= 3) return "short";
  if (deficit >= 1) return "on_track";
  return "full_crew";
}

export type StatusMeta = {
  label: string;
  badgeClass: string;
  barClass: string;
  cardClass: string;
};

export const STATUS_META: Record<LineupStatus, StatusMeta> = {
  full_crew: {
    label: "FULL CREW",
    badgeClass: "bg-emerald-100 text-emerald-700",
    barClass: "bg-emerald-500",
    cardClass: "bg-emerald-50/60 ring-emerald-200/80",
  },
  on_track: {
    label: "ON TRACK",
    badgeClass: "bg-blue-100 text-blue-700",
    barClass: "bg-blue-500",
    cardClass: "bg-blue-50/60 ring-blue-200/80",
  },
  short: {
    label: "SHORT",
    badgeClass: "bg-orange-100 text-orange-700",
    barClass: "bg-orange-500",
    cardClass: "bg-orange-50/60 ring-orange-200/80",
  },
  critical: {
    label: "CRITICAL",
    badgeClass: "bg-red-100 text-red-700",
    barClass: "bg-red-500",
    cardClass: "bg-red-50/70 ring-red-200/80",
  },
  over: {
    label: "OVER",
    badgeClass: "bg-violet-100 text-violet-700",
    barClass: "bg-violet-500",
    cardClass: "bg-violet-50/60 ring-violet-200/80",
  },
};
