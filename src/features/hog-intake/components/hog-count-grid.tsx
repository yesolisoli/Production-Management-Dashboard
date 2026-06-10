"use client";

import { Layers } from "lucide-react";
import { type HogCounts, type HogType } from "../types";
import { CardIcon, CardShell, ReadOnlyRow, StepperRow } from "./summary-panel";

type HogCountGridProps = {
  counts: HogCounts;
  onChangeCount: (type: HogType, value: number) => void;
};

const EXCLUDE_TYPES: HogType[] = ["Round", "Suckling", "Customer"];

// JP / RWA / BK roll up from Farm Delivery Records. This card is only the
// manually-entered excluded hogs (Round / Suckling / Customer) — they count
// toward Total Hog but not yield.
export function HogCountGrid({ counts, onChangeCount }: HogCountGridProps) {
  return (
    <CardShell
      label="Non-Primal Hogs"
      subtitle="Not included in Primal Calc"
      icon={<CardIcon icon={Layers} tone="amber" />}
    >
      <div className="space-y-2">
        {/* BK rolls up from Farm Delivery Records — read-only here. */}
        <ReadOnlyRow label="BK" value={counts.BK} />
        {EXCLUDE_TYPES.map((type) => (
          <StepperRow
            key={type}
            label={type}
            value={counts[type]}
            onChange={(v) => onChangeCount(type, v)}
          />
        ))}
      </div>
    </CardShell>
  );
}
