"use client";

import type { HogIntakeRecord } from "../types";
import { NumberStepper } from "./number-stepper";

type ProcessField = "side_orders" | "held_over" | "deaths_on_arrival" | "boars_count";

type ProcessSheetProps = {
  record: HogIntakeRecord;
  onChangeField: (field: ProcessField, value: number) => void;
  onChangeNotes: (notes: string) => void;
};

const FIELDS: { key: ProcessField; label: string }[] = [
  { key: "held_over", label: "Held Over" },
  { key: "deaths_on_arrival", label: "Deaths on Arrival" },
  { key: "boars_count", label: "Boars Count" },
];

const NOTES_MAX = 250;

export function ProcessSheet({
  record,
  onChangeField,
  onChangeNotes,
}: ProcessSheetProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Process Sheet (Today)
        </h3>
        <p className="text-xs text-slate-500">Enter today&apos;s processing info</p>
      </div>

      <div className="flex flex-col gap-3">
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-slate-700">{field.label}</span>
            <div className="w-32">
              <NumberStepper
                ariaLabel={field.label}
                value={record[field.key]}
                onChange={(value) => onChangeField(field.key, value)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-center justify-between">
          <label
            htmlFor="process-notes"
            className="text-sm font-medium text-slate-700"
          >
            Notes
          </label>
          <p className="text-xs text-slate-400">
            {record.notes.length} / {NOTES_MAX}
          </p>
        </div>
        <textarea
          id="process-notes"
          value={record.notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          maxLength={NOTES_MAX}
          rows={3}
          placeholder="Enter any notes..."
          className="mt-2 min-h-20 w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
      </div>
    </section>
  );
}
