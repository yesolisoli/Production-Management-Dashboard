"use client";

import { Boxes } from "lucide-react";
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
  total: number;
};

// JP / RWA roll up from Farm Delivery Records and feed Primal Calc — read-only
// here, mirroring the Non-Primal Hogs card. Primal Total is JP + RWA, plus hogs
// carried in from yesterday, less hogs held over to tomorrow (held-over hogs are
// cut on the day they carry into, not the day they're held).
export function PrimalHogsGrid({
  jp,
  rwa,
  heldOverToday,
  heldOverPrev,
  total,
}: PrimalHogsGridProps) {
  return (
    <CardShell
      label="Primal Hogs"
      subtitle="Included in Primal Calc"
      icon={<CardIcon icon={Boxes} tone="blue" />}
    >
      <div className="space-y-2">
        <ReadOnlyRow label="JP" value={jp} alignWithSteppers={false} />
        <ReadOnlyRow label="RWA" value={rwa} alignWithSteppers={false} />
        {heldOverPrev > 0 ? (
          <ReadOnlyRow
            label="Held Over (Yesterday)"
            value={heldOverPrev}
            alignWithSteppers={false}
            signed
          />
        ) : null}
        {heldOverToday > 0 ? (
          <ReadOnlyRow
            label="Held Over (Today)"
            value={-heldOverToday}
            alignWithSteppers={false}
          />
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
