"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Beef,
  Calculator,
  Package,
  CalendarRange,
  Settings,
  LogOut,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { useDashboardUser } from "./dashboard-user-context";
import { canAccessRoute, type Role, type RouteKey } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { AUTH_ENABLED } from "@/lib/config";
import { Modal } from "@/components/shared/modal";

function formatRole(role: Role): string {
  return role
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  routeKey: RouteKey;
};

const items: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, routeKey: "home" },
  { href: "/daily-lineup", label: "Daily Lineup", icon: ClipboardList, routeKey: "daily-lineup" },
  { href: "/hog-intake", label: "Hog Intake", icon: Beef, routeKey: "hog-intake" },
  { href: "/primal-calc", label: "Primal Calc", icon: Calculator, routeKey: "primal-calc" },
  { href: "/orders-allocation", label: "Orders & Allocation", icon: Package, routeKey: "orders-allocation" },
  { href: "/production-planner", label: "Production Planner", icon: CalendarRange, routeKey: "production-planner" },
  { href: "/settings", label: "Settings", icon: Settings, routeKey: "settings" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { email, role } = useDashboardUser();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const visibleItems =
    role === null ? items : items.filter((item) => canAccessRoute(role, item.routeKey));

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    if (AUTH_ENABLED) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
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

        <div className="grid h-12 grid-cols-[56px_1fr_auto] items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {email ? email.charAt(0).toUpperCase() : "U"}
          </div>

          <div className="min-w-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="truncate text-sm font-medium text-slate-900">
              {email || "User"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {role ? formatRole(role) : "—"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={signingOut}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 opacity-0 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 group-hover:opacity-100"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>

    {confirmOpen && (
      <Modal
        title="Sign out"
        onClose={() => !signingOut && setConfirmOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={signingOut}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to sign out?
        </p>
        {email && (
          <p className="mt-2 text-xs text-slate-400">{email}</p>
        )}
      </Modal>
    )}
    </>
  );
}
