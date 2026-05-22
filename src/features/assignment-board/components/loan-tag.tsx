"use client";

import type React from "react";

/**
 * Tag shown next to a shift label to indicate cross-department loans.
 * - direction="in"  → employees borrowed from other departments
 * - direction="out" → home-department employees working elsewhere
 *
 * Shared between the admin grid header and the TV display so both surfaces
 * stay visually consistent.
 */
export function LoanTag({
  direction,
  count,
  onClick,
}: {
  direction: "in" | "out";
  count: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const arrow = direction === "in" ? "↓" : "↑";
  const palette =
    direction === "in"
      ? "bg-blue-400/25 text-blue-100 hover:bg-blue-400/40"
      : "bg-white/15 text-white/90 hover:bg-white/25";
  const className = `rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${palette}`;

  if (onClick) {
    return (
      <button onClick={onClick} className={className}>
        {arrow} {count} {direction}
      </button>
    );
  }
  return (
    <span className={className}>
      {arrow} {count} {direction}
    </span>
  );
}
