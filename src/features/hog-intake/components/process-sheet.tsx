"use client";

import { clampNonNegativeInt } from "../calculations";
import type { HogIntakeRecord } from "../types";

type ProcessField = "side_orders" | "held_over" | "deaths_on_arrival" | "boars_count";

type ProcessSheetProps = {
  record: HogIntakeRecord;
  onChangeField: (field: ProcessField, value: number) => void;
  onChangeNotes: (notes: string) => void;
};

const FIELDS: { key: ProcessField; label: string; helper?: string }[] = [
  { key: "side_orders", label: "Side Orders", helper: "Deducted from Total Hogs" },
  { key: "held_over", label: "Held Over" },
  { key: "deaths_on_arrival", label: "Deaths on Arrival" },
  { key: "boars_count", label: "Boars" },
];

export function ProcessSheet({
  record,
  onChangeField,
  onChangeNotes,
}: ProcessSheetProps) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Process Sheet</h3>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50/50 p-3"
          >
            <span className="text-sm font-semibold text-slate-800">
              {field.label}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={record[field.key]}
              onChange={(e) =>
                onChangeField(field.key, clampNonNegativeInt(e.target.value))
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-base font-semibold tabular-nums text-slate-900 outline-none focus:border-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {field.helper ? (
              <span className="text-xs text-slate-400">{field.helper}</span>
            ) : null}
          </label>
        ))}
      </div>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-sm font-semibold text-slate-800">Notes</span>
        <textarea
          value={record.notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          rows={3}
          placeholder="Anything operations should know about today's intake…"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
      </label>
    </section>
  );
}
