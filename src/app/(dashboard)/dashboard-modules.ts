import {
  Beef,
  CalendarRange,
  Calculator,
  LayoutGrid,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type DashboardModule = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  iconColor: string;
  cardClassName: string;
  wide: boolean;
};

export const dashboardModules: DashboardModule[] = [
  {
    href: "/assignment-board",
    title: "Assignment Board",
    description: "View and manage assignments and tasks.",
    icon: LayoutGrid,
    accent: "text-blue-700",
    iconColor: "text-blue-600",
    cardClassName: "bg-blue-100/60 ring-blue-200/80",
    wide: false,
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
  },
];
