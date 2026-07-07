"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Beef,
  Calculator,
  Package,
  CalendarRange,
  Settings,
  LogOut,
  ClipboardList,
  Loader2,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { useDashboardUser } from "./dashboard-user-context";
import { canAccessRoute, type Role, type RouteKey } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { AUTH_ENABLED } from "@/lib/config";
import { runNavigationFlush } from "@/lib/navigation-guard";
import { Modal } from "@/components/shared/modal";
import { ModalFooter } from "@/components/shared/modal-footer";

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
  // The href we're holding on while the leaving screen finishes its save — used
  // to show a spinner on that nav item during the wait.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // Mobile-only slide-in drawer. The desktop rail uses hover-to-expand and
  // never reads this state.
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleItems =
    role === null ? items : items.filter((item) => canAccessRoute(role, item.routeKey));

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  // Intercept in-app navigation so a screen with unsaved work (registered via
  // the navigation guard) can finish its save before we leave. Plain left-clicks
  // only — modified clicks / new-tab / same-route fall through to the browser.
  const handleNavigate = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0 ||
      href === pathname ||
      pendingHref
    ) {
      return;
    }
    e.preventDefault();
    setPendingHref(href);
    void runNavigationFlush()
      .then(() => router.push(href))
      .finally(() => setPendingHref(null));
  };

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // Let the current screen finish saving before tearing down the session.
    await runNavigationFlush();
    if (AUTH_ENABLED) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    // Hard navigation: guarantees we land on /login and fully resets client
    // state. (router.replace + router.refresh raced and bounced back to the
    // dashboard.) replace() keeps the signed-out dashboard out of history.
    window.location.replace("/login");
  };

  return (
    <>
      {/* Mobile top bar: only rendered below md, where the hover rail is hidden. */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100"
        >
          <Menu size={22} />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
          <span className="text-base font-bold">J</span>
        </div>
        <p className="truncate text-sm font-semibold text-slate-900">
          Packaging Dashboard
        </p>
      </div>

      {/* Desktop rail: hover-to-expand, hidden on mobile. */}
      <aside className="group sticky top-0 hidden h-screen w-24 shrink-0 overflow-hidden border-r bg-white transition-[width] duration-300 ease-out hover:w-80 md:block">
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
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavigate(e, item.href)}
                  className={clsx(
                    "grid h-14 grid-cols-[56px_1fr] items-center rounded-2xl text-sm font-medium transition-colors",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <div className="flex h-14 w-14 items-center justify-center">
                    {pendingHref === item.href ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Icon size={20} />
                    )}
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

      {/* Mobile drawer overlay. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <span className="text-lg font-bold">J</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                    Johnston Packers 1995 LTD
                  </p>
                  <p className="text-base font-semibold leading-tight text-slate-900">
                    Packaging Dashboard
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-4">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      setDrawerOpen(false);
                      handleNavigate(e, item.href);
                    }}
                    className={clsx(
                      "flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {pendingHref === item.href ? (
                      <Loader2 size={20} className="shrink-0 animate-spin" />
                    ) : (
                      <Icon size={20} className="shrink-0" />
                    )}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {email ? email.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {email || "User"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {role ? formatRole(role) : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setConfirmOpen(true);
                }}
                disabled={signingOut}
                title="Sign out"
                aria-label="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
              >
                <LogOut size={18} />
              </button>
            </div>
          </aside>
        </div>
      )}

      {confirmOpen && (
        <Modal
          title="Sign out"
          onClose={() => !signingOut && setConfirmOpen(false)}
          footer={
            <ModalFooter
              onCancel={() => setConfirmOpen(false)}
              cancelDisabled={signingOut}
              onConfirm={handleLogout}
              confirmTone="dark"
              confirmLoading={signingOut}
              loadingLabel="Signing out..."
              confirmLabel="Sign out"
            />
          }
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to sign out?
          </p>
          {email && <p className="mt-2 text-xs text-slate-400">{email}</p>}
        </Modal>
      )}
    </>
  );
}
