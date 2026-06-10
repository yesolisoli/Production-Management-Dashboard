"use client";

import { Layers } from "lucide-react";
import { type HogCounts, type HogType } from "../types";
import { CardIcon, CardShell, StepperRow } from "./summary-panel";

type HogCountGridProps = {
  counts: HogCounts;
  onChangeCount: (type: HogType, value: number) => void;
};

const EXCLUDE_TYPES: HogType[] = ["BK", "Round", "Suckling", "Customer"];

// JP / RWA live in the Primal Calc summary card. This card is only the excluded
// hogs (BK / Round / Suckling / Customer), entered manually — they count toward
// Total Hog but not yield.
export function HogCountGrid({ counts, onChangeCount }: HogCountGridProps) {
  return (
    <CardShell
      label="Non-Primal Hogs"
      subtitle="Not included in Primal Calc"
      icon={<CardIcon icon={Layers} tone="amber" />}
    >
      <div className="space-y-2">
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
