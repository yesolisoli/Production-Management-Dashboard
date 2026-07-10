// Presentation descriptor for a route's production readiness — the single source
// of truth for the badge label / chip / dot colours, so the production sheet's
// per-route badge and the route board's status column stay in sync. Mirrors the
// product / priority badge helpers in types.ts (Tailwind class strings kept next
// to the data they colour).

import type { RouteProductionStatus } from "./calculations";

export const ROUTE_PRODUCTION_STATUS_BADGE: Record<
  RouteProductionStatus,
  { label: string; short: string; dot: string; chip: string; hint: string }
> = {
  late: {
    label: "Late",
    short: "Late",
    dot: "bg-red-500",
    chip: "bg-red-50 text-red-600",
    hint: "finishes past the deadline",
  },
  at_risk: {
    label: "At Risk",
    short: "At Risk",
    dot: "bg-amber-400",
    chip: "bg-amber-50 text-amber-700",
    hint: "within 30 min of the deadline",
  },
  on_track: {
    label: "On Track",
    short: "On Track",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    hint: "finishes with time to spare",
  },
  carry_forward: {
    label: "Carry Forward",
    short: "Carry Fwd",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600",
    hint: "held to tomorrow / no timing yet",
  },
  no_items: {
    label: "No Items",
    short: "No Items",
    dot: "bg-slate-300",
    chip: "bg-slate-100 text-slate-400",
    hint: "no products on this route",
  },
};

// Signed minute difference of a route's production finish vs its print deadline,
// phrased for the board: "2h 48m late" / "56m ahead" / "on deadline".
export function formatRouteFinishVsDeadline(minutes: number): string {
  if (minutes === 0) return "on deadline";
  const late = minutes > 0;
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  return `${span} ${late ? "late" : "ahead"}`;
}
