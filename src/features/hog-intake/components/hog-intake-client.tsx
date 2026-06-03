"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
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
    dirty,
    setDate,
    setHogCount,
    bumpAllHogCounts,
    clearAllHogCounts,
    setProcessField,
    setNotes,
    setNextDayField,
    addFarmRecord,
    updateFarmRecord,
    removeFarmRecord,
    reset,
    save,
  } = useHogIntakeState();

  const totals = useMemo(() => deriveTotals(record), [record]);

  return (
    <>
      <AppHeader
        eyebrow="Operations Module"
        title="Hog Intake"
        actions={
          <label className="flex items-center gap-2 rounded-xl border border-white/30 bg-transparent px-3 py-2">
            <Calendar size={16} className="text-white/70" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-7 border-0 bg-transparent text-sm font-semibold tabular-nums text-white outline-none scheme-dark"
            />
          </label>
        }
      />

      <div className="bg-slate-50">
        <div className="flex flex-col gap-4 px-5 py-5 lg:px-6 lg:py-6">
          <SummaryPanel totals={totals} sideOrders={record.side_orders} />

          <HogCountGrid
            counts={record.hog_counts}
            onChange={setHogCount}
            onBumpAll={bumpAllHogCounts}
            onClearAll={clearAllHogCounts}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
            <FarmRecords
              rows={record.farm_records}
              onAdd={addFarmRecord}
              onUpdate={updateFarmRecord}
              onRemove={removeFarmRecord}
            />
            <ProcessSheet
              record={record}
              onChangeField={setProcessField}
              onChangeNotes={setNotes}
            />
            <NextDayProjection
              nextDay={record.next_day}
              onChange={setNextDayField}
            />
          </div>

          <SaveBar status={status} dirty={dirty} onSave={save} onReset={reset} />
        </div>
      </div>
    </>
  );
}
