"use client";

import { SlidersHorizontal } from "lucide-react";
import type { HogIntakeRecord } from "../types";
import { CardIcon, CardShell, StepperRow } from "./summary-panel";

type ProcessField = "side_orders" | "held_over" | "deaths_on_arrival" | "boars_count";

type ProcessSheetProps = {
  record: HogIntakeRecord;
  onChangeField: (field: ProcessField, value: number) => void;
};

const FIELDS: { key: ProcessField; label: string }[] = [
  { key: "held_over", label: "Held Over" },
  { key: "deaths_on_arrival", label: "Deaths on Arrival" },
  { key: "boars_count", label: "Boars Count" },
];

export function ProcessSheet({ record, onChangeField }: ProcessSheetProps) {
  return (
    <CardShell
      label="Today's Adjustments"
      subtitle="Intake count adjustments"
      icon={<CardIcon icon={SlidersHorizontal} tone="violet" />}
      className="h-full"
    >
      <div className="space-y-2">
        {FIELDS.map((field) => (
          <StepperRow
            key={field.key}
            label={field.label}
            value={record[field.key]}
            onChange={(value) => onChangeField(field.key, value)}
          />
        ))}
      </div>
    </CardShell>
  );
}
