"use client";

import { Boxes } from "lucide-react";
import { CardIcon, CardShell, ReadOnlyRow } from "./summary-panel";

type PrimalHogsGridProps = {
  jp: number;
  rwa: number;
  total: number;
};

// JP / RWA roll up from Farm Delivery Records and feed Primal Calc — read-only
// here, mirroring the Non-Primal Hogs card. Primal Total is their sum.
export function PrimalHogsGrid({ jp, rwa, total }: PrimalHogsGridProps) {
  return (
    <CardShell
      label="Primal Hogs"
      subtitle="Included in Primal Calc"
      icon={<CardIcon icon={Boxes} tone="blue" />}
    >
      <div className="space-y-2">
        <ReadOnlyRow label="JP" value={jp} alignWithSteppers={false} />
        <ReadOnlyRow label="RWA" value={rwa} alignWithSteppers={false} />
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
