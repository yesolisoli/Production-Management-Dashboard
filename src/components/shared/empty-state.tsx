import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

// Shared empty-state placeholder.
//
// Reproduces the "no rows yet" block that the Orders & Allocation sections
// (allocation / production / route-printing) each hand-roll identically:
// a centred slate icon chip, a semibold title, and a muted description.
// The markup is a byte-for-byte match of those blocks at the default size,
// so a screen can adopt this without any visual change.
//
// Nothing imports this yet — migrating screens is a separate, opt-in step.

export type EmptyStateProps = {
  // Rendered inside the slate chip at size 20. Optional so text-only empty
  // states (no chip) are possible.
  icon?: LucideIcon;
  // Primary line. Always shown.
  title: string;
  // Secondary line. A ReactNode (not just string) so callers can pass
  // conditional / composed copy, matching the production sheet's ternary.
  description?: ReactNode;
  // Optional call-to-action, rendered below the description. Passed as a node
  // (not label+onClick) so each screen keeps its own button styling.
  action?: ReactNode;
  // Escape hatch for anything extra a screen needs below the standard block.
  children?: ReactNode;
  // Vertical spacing. "md" (default) matches the current sections exactly;
  // "lg" gives a roomier block for full-page empty states.
  size?: "md" | "lg";
  // Extend / override the container classes when a screen needs it.
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-2 px-6 text-center",
        size === "lg" ? "py-16" : "py-10 sm:py-12",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon size={20} />
        </span>
      )}
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {description && (
        <p className="max-w-md text-xs text-slate-400">{description}</p>
      )}
      {action}
      {children}
    </div>
  );
}
