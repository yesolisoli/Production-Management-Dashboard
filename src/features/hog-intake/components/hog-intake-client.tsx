"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { deriveTotals } from "../calculations";
import { useHogIntakeState } from "../hooks/use-hog-intake-state";
import { FarmRecords } from "./farm-records";
import { HogCountGrid } from "./hog-count-grid";
import { NextDayProjection } from "./next-day-projection";
import { ProcessSheet } from "./process-sheet";
import { SaveBar } from "./save-bar";
import { SummaryPanel } from "./summary-panel";

export function HogIntakeClient() {
  const {
    date,
    record,
    status,
    setDate,
    setHogCount,
    setProcessField,
    setNotes,
    setNextDayField,
    addFarmRecord,
    updateFarmRecord,
    removeFarmRecord,
    save,
  } = useHogIntakeState();

  const totals = useMemo(() => deriveTotals(record), [record]);

  return (
    <div className="flex min-h-full flex-col gap-5 p-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Intake Date
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Pick a date to record or review that day&apos;s intake.
          </p>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
          <Calendar size={16} className="text-slate-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 border-0 bg-transparent text-base font-semibold tabular-nums text-slate-900 outline-none"
          />
        </label>
      </div>

      <SummaryPanel totals={totals} sideOrders={record.side_orders} />

      <HogCountGrid counts={record.hog_counts} onChange={setHogCount} />

      <ProcessSheet
        record={record}
        onChangeField={setProcessField}
        onChangeNotes={setNotes}
      />

      <FarmRecords
        rows={record.farm_records}
        onAdd={addFarmRecord}
        onUpdate={updateFarmRecord}
        onRemove={removeFarmRecord}
      />

      <NextDayProjection
        nextDay={record.next_day}
        onChange={setNextDayField}
      />

      <SaveBar date={date} status={status} onSave={save} />
    </div>
  );
}
