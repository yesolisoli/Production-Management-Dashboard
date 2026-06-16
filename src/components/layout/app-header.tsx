"use client";

import Link from "next/link";
import clsx from "clsx";
import { Megaphone, Monitor } from "lucide-react";

type AppHeaderProps = {
  actions?: React.ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
  variant?: "default" | "hero";
};

export function AppHeader({
  actions,
  description,
  eyebrow,
  title,
  variant = "default",
}: AppHeaderProps) {
  return (
    <header
      className={clsx(
        "sticky top-0 z-20 border-b bg-[linear-gradient(135deg,#0f172a_0%,#111827_68%,#0b1220_100%)] text-white",
        variant === "hero"
          ? "border-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
          : "border-slate-700"
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-between gap-3 sm:gap-6",
          variant === "hero"
            ? "px-4 py-5 sm:px-7 sm:py-7 lg:px-9 lg:py-8"
            : "px-4 py-3 sm:px-6 sm:py-4"
        )}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className={clsx(
                "uppercase tracking-wide text-slate-400",
                variant === "hero" ? "text-xs sm:text-sm" : "text-xs"
              )}
            >
              {eyebrow}
            </p>
          ) : null}

          <h1
            className={clsx(
              "tracking-tight text-white",
              variant === "hero"
                ? "text-2xl font-black sm:text-4xl lg:text-[4rem]"
                : "truncate text-lg font-bold sm:text-xl"
            )}
          >
            {title}
          </h1>

          {description ? (
            <p
              className={clsx(
                "text-slate-300",
                variant === "hero"
                  ? "mt-2 text-base sm:text-lg lg:text-xl"
                  : "mt-1 text-xs sm:text-sm"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export function AssignmentHeaderActions() {
  return (
    <>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("announcement-edit"))}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600 bg-slate-900 text-sm font-medium text-white hover:bg-slate-700"
        title="Edit Announcement"
      >
        <Megaphone size={16} />
      </button>

      <Link
        href="/tv-display"
        title="TV Display"
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 text-sm font-medium text-white hover:bg-slate-700 sm:w-auto sm:px-4"
      >
        <Monitor size={16} />
        <span className="hidden sm:inline">TV Display</span>
      </Link>
    </>
  );
}