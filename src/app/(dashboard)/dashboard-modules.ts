import {
  Archive,
  Beef,
  CalendarRange,
  Calculator,
  ClipboardList,
  LayoutGrid,
  Monitor,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { RouteKey } from "@/lib/permissions";

export type DashboardModule = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  iconColor: string;
  cardClassName: string;
  wide: boolean;
  routeKey: RouteKey;
};

export const dashboardModules: DashboardModule[] = [
  {
    href: "/daily-lineup",
    title: "Daily Lineup",
    description: "Today's staffing status across all work areas.",
    icon: ClipboardList,
    accent: "text-blue-700",
    iconColor: "text-blue-600",
    cardClassName: "bg-blue-100/60 ring-blue-200/80",
    wide: false,
    routeKey: "daily-lineup",
  },
  {
    href: "/hog-intake",
    title: "Hog Intake",
    description: "Record and manage hog intake information.",
    icon: Beef,
    accent: "text-emerald-700",
    iconColor: "text-emerald-600",
    cardClassName: "bg-emerald-100/60 ring-emerald-200/80",
    wide: false,
    routeKey: "hog-intake",
  },
  {
    href: "/primal-calc",
    title: "Primal Calc",
    description: "Calculate and manage primal values.",
    icon: Calculator,
    accent: "text-violet-700",
    iconColor: "text-violet-600",
    cardClassName: "bg-violet-100/60 ring-violet-200/80",
    wide: false,
    routeKey: "primal-calc",
  },
  {
    href: "/orders-allocation",
    title: "Orders & Allocation",
    description: "Manage orders and allocations efficiently.",
    icon: Package,
    accent: "text-amber-700",
    iconColor: "text-amber-600",
    cardClassName: "bg-amber-100/60 ring-amber-200/80",
    wide: false,
    routeKey: "orders-allocation",
  },
  {
    href: "/production-planner",
    title: "Production Planner",
    description: "Plan and schedule production activities.",
    icon: CalendarRange,
    accent: "text-red-600",
    iconColor: "text-red-500",
    cardClassName: "bg-red-100/60 ring-red-200/80",
    wide: true,
    routeKey: "production-planner",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Configure system settings and preferences.",
    icon: Settings,
    accent: "text-sky-700",
    iconColor: "text-sky-600",
    cardClassName: "bg-sky-100/60 ring-sky-200/80",
    wide: true,
    routeKey: "settings",
  },
];

// Dashboard cards shown to basic-role users instead of operational
// modules. Kept separate so non-basic roles don't see History/TV cards
// on their dashboard.
export const basicDashboardModules: DashboardModule[] = [
  {
    href: "/history",
    title: "History",
    description: "Review past shift snapshots and assignments.",
    icon: Archive,
    accent: "text-slate-800",
    iconColor: "text-slate-700",
    cardClassName: "bg-slate-200/70 ring-slate-300/80",
    wide: false,
    routeKey: "history",
  },
  {
    href: "/tv-display",
    title: "TV Display",
    description: "Open the live floor display.",
    icon: Monitor,
    accent: "text-indigo-700",
    iconColor: "text-indigo-600",
    cardClassName: "bg-indigo-100/60 ring-indigo-200/80",
    wide: false,
    routeKey: "tv-display",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Configure your account and preferences.",
    icon: Settings,
    accent: "text-sky-700",
    iconColor: "text-sky-600",
    cardClassName: "bg-sky-100/60 ring-sky-200/80",
    wide: true,
    routeKey: "settings",
  },
];
