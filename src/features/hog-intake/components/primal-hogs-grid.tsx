"use client";

import { useState } from "react";
import { Boxes, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { CardIcon, CardShell, ReadOnlyRow } from "@/components/shared/card";

type PrimalHogsGridProps = {
  jp: number;
  rwa: number;
  // Hogs held over to the NEXT day (from Today's Adjustments) — not cut today,
  // so subtracted from Primal Total. Shown only when non-zero.
  heldOverToday: number;
  // Hogs held over FROM the previous production day — cut today, so added to
  // Primal Total. Shown only when non-zero.
  heldOverPrev: number;
  // DOA/DOP — hogs dead on arrival / on processing, never cut, so subtracted
  // from Primal Total. Shown only when non-zero.
  deaths: number;
  total: number;
};

// JP / RWA roll up from Farm Delivery Records and feed Primal Calc — read-only
// here, mirroring the Non-Primal Hogs card. Primal Total is JP + RWA, plus hogs
// carried in from yesterday, less hogs held over to tomorrow (held-over hogs are
// cut on the day they carry into, not the day they're held) and less DOA/DOP.
//
// The individual adjustments collapse into one "Adjustments" disclosure so the
// card stays compact; the net shift is always visible and the breakdown expands
// on demand.
export function PrimalHogsGrid({
  jp,
  rwa,
  heldOverToday,
  heldOverPrev,
  deaths,
  total,
}: PrimalHogsGridProps) {
  const [expanded, setExpanded] = useState(false);

  // Only the non-zero adjustments are worth showing. Each carries the signed
  // value it contributes to the Primal Total (carry-ins add, losses subtract).
  const adjustments = [
    heldOverPrev > 0
      ? { label: "Held Over (Yesterday)", value: heldOverPrev }
      : null,
    heldOverToday > 0
      ? { label: "Held Over (Today)", value: -heldOverToday }
      : null,
    deaths > 0 ? { label: "DOA/DOP", value: -deaths } : null,
  ].filter((row): row is { label: string; value: number } => row !== null);

  const netAdjustment = heldOverPrev - heldOverToday - deaths;
  const netDisplay = netAdjustment > 0 ? `+${netAdjustment}` : netAdjustment;

  return (
    <CardShell
      label="Primal Hogs"
      subtitle="Included in Primal Calc"
      icon={<CardIcon icon={Boxes} tone="blue" />}
    >
      <div className="space-y-2">
        <ReadOnlyRow label="JP" value={jp} alignWithSteppers={false} />
        <ReadOnlyRow label="RWA" value={rwa} alignWithSteppers={false} />

        {adjustments.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-2 rounded-lg py-0.5 text-left transition hover:bg-slate-50"
            >
              <span className="flex items-center gap-1 text-sm text-slate-500">
                <ChevronRight
                  size={14}
                  className={clsx(
                    "shrink-0 transition-transform",
                    expanded && "rotate-90",
                  )}
                />
                Adjustments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-7 w-7 lg:hidden" aria-hidden />
                <span className="flex h-8 w-12 items-center justify-center text-base font-semibold tabular-nums text-slate-500 lg:w-auto">
                  {netDisplay}
                </span>
                <span className="h-7 w-7 lg:hidden" aria-hidden />
              </span>
            </button>
            {expanded ? (
              <div className="mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                {adjustments.map((row) => (
                  <ReadOnlyRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    alignWithSteppers={false}
                    signed
                    compact
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <ReadOnlyRow
          label="Primal Total"
          value={total}
          emphasis
          alignWithSteppers={false}
        />
      </div>
    </CardShell>
  );
}
