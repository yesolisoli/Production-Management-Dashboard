"use client";

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
        "sticky top-0 z-10 border-b bg-[linear-gradient(135deg,#0f172a_0%,#111827_68%,#0b1220_100%)] text-white",
        variant === "hero"
          ? "border-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
          : "border-slate-700"
      )}
    >
      <div
        className={clsx(
          "flex items-start justify-between gap-6",
          variant === "hero" ? "px-7 py-7 lg:px-9 lg:py-8" : "px-6 py-4"
        )}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className={clsx(
                "uppercase tracking-wide text-slate-400",
                variant === "hero" ? "text-sm" : "text-xs"
              )}
            >
              {eyebrow}
            </p>
          ) : null}

          <h1
            className={clsx(
              "tracking-tight text-white",
              variant === "hero"
                ? "text-4xl font-black lg:text-[4rem]"
                : "text-xl font-bold"
            )}
          >
            {title}
          </h1>

          {description ? (
            <p
              className={clsx(
                "text-slate-300",
                variant === "hero" ? "mt-2 text-lg lg:text-xl" : "mt-1 text-sm"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-3">
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

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("tv-open"))}
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
      >
        <Monitor size={16} />
        TV Display
      </button>
    </>
  );
}