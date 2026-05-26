"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Beef,
  Calculator,
  Package,
  CalendarRange,
  Settings,
  Archive,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { useDashboardUser } from "./dashboard-user-context";
import { canAccessRoute, type RouteKey } from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  routeKey: RouteKey;
};

const items: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, routeKey: "home" },
  { href: "/assignment-board", label: "Assignment Board", icon: Users, routeKey: "assignment-board" },
  { href: "/history", label: "History", icon: Archive, routeKey: "history" },
  { href: "/hog-intake", label: "Hog Intake", icon: Beef, routeKey: "hog-intake" },
  { href: "/primal-calc", label: "Primal Calc", icon: Calculator, routeKey: "primal-calc" },
  { href: "/orders-allocation", label: "Orders & Allocation", icon: Package, routeKey: "orders-allocation" },
  { href: "/production-planner", label: "Production Planner", icon: CalendarRange, routeKey: "production-planner" },
  { href: "/settings", label: "Settings", icon: Settings, routeKey: "settings" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { role } = useDashboardUser();

  const visibleItems =
    role === null ? items : items.filter((item) => canAccessRoute(role, item.routeKey));

  return (
    <aside className="group sticky top-0 h-screen w-24 shrink-0 overflow-hidden border-r bg-white transition-[width] duration-300 ease-out hover:w-80">
      <div className="flex h-full flex-col px-5 py-5">
        <div className="mb-8 grid h-16 grid-cols-[56px_1fr] items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <span className="text-xl font-bold">J</span>
          </div>

          <div className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="truncate text-xs uppercase tracking-wide text-slate-500">
              Johnston Packers 1995 LTD
            </p>
            <p className="text-lg font-semibold leading-tight text-slate-900">
              Packaging Dashboard
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "grid h-14 grid-cols-[56px_1fr] items-center rounded-2xl text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <div className="flex h-14 w-14 items-center justify-center">
                  <Icon size={20} />
                </div>

                <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="grid h-12 grid-cols-[56px_1fr] items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white">
            N
          </div>

          <div className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="text-sm font-medium text-slate-900">User</p>
            <p className="text-xs text-slate-500">Account</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
