"use client";

import { useEffect, useMemo } from "react";
import { Calendar } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { registerNavigationFlush } from "@/lib/navigation-guard";
import { deriveTotals } from "../calculations";
import { useHogIntakeState } from "../hooks/use-hog-intake-state";
import { useWeeklyHogSchedule } from "../hooks/use-weekly-hog-schedule";
import { FarmRecords } from "./farm-records";
import { HogCountGrid } from "./hog-count-grid";
import { PrimalHogsGrid } from "./primal-hogs-grid";
import { ProcessSheet } from "./process-sheet";
import { SaveBar } from "./save-bar";
import { SummaryPanel } from "./summary-panel";
import { WeeklyHogSchedule } from "./weekly-hog-schedule";

export function HogIntakeClient() {
  // Weekly Hog Plan owns its rows here (single instance) so both the plan grid
  // and the Sow card's derived "Available This Week" read the same data.
  const {
    rows: weeklyRows,
    updateValue: updateWeeklyValue,
    sowPlanTotal,
  } = useWeeklyHogSchedule();

  const {
    date,
    record,
    hogCounts,
    prevHeldOver,
    status,
    dirty,
    setDate,
    setHogCount,
    setProcessField,
    setNextDayField,
    setTodaysCutting,
    setIncludeBkInYield,
    addFarmRecord,
    updateFarmRecord,
    removeFarmRecord,
    reset,
    flush,
  } = useHogIntakeState({ sowPlanTotal });

  // Hold sidebar navigation until a pending save finishes, so leaving for Primal
  // Calc (which reads the DB) never races ahead of the write.
  useEffect(() => {
    registerNavigationFlush(flush);
    return () => registerNavigationFlush(null);
  }, [flush]);

  // hog_counts are derived from Farm Delivery Records, so totals flow from the
  // derived counts rather than the record's stored (input-only) field.
  const totals = useMemo(
    () => deriveTotals({ ...record, hog_counts: hogCounts }, prevHeldOver),
    [record, hogCounts, prevHeldOver],
  );

  return (
    <>
      <AppHeader
        eyebrow="Operations Module"
        title="Hog Intake"
        actions={
          <div className="flex items-center gap-2">
            <label className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-transparent sm:h-auto sm:w-auto sm:justify-start sm:gap-2 sm:px-3 sm:py-2">
              <Calendar size={16} className="shrink-0 text-white/70" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0 sm:static sm:h-7 sm:w-auto sm:min-w-0 sm:cursor-auto sm:border-0 sm:bg-transparent sm:text-sm sm:font-semibold sm:tabular-nums sm:text-white sm:opacity-100 sm:outline-none sm:scheme-dark"
              />
            </label>
          </div>
        }
      />

      <div className="bg-slate-50">
        <div className="flex flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <WeeklyHogSchedule
            date={date}
            rows={weeklyRows}
            onUpdateValue={updateWeeklyValue}
            nextDay={record.next_day}
            onNextDayChange={setNextDayField}
          />

          <SummaryPanel
            totals={totals}
            sideOrders={record.side_orders}
            onChangeSideOrders={(v) => setProcessField("side_orders", v)}
            middle={
              <>
                <PrimalHogsGrid
                  jp={hogCounts.JP}
                  rwa={hogCounts.RWA}
                  bk={record.include_bk_in_yield ? hogCounts.BK : null}
                  heldOverToday={record.held_over}
                  heldOverPrev={prevHeldOver}
                  deaths={record.deaths_on_arrival}
                  total={totals.yieldTotal}
                />
                <HogCountGrid counts={hogCounts} onChangeCount={setHogCount} />
              </>
            }
            after={
              <ProcessSheet record={record} onChangeField={setProcessField} />
            }
            sowAvailable={hogCounts.Sow}
            todaysCutting={record.todays_cutting}
            onChangeTodaysCutting={setTodaysCutting}
          />

          <FarmRecords
            rows={record.farm_records}
            onAdd={addFarmRecord}
            onUpdate={updateFarmRecord}
            onRemove={removeFarmRecord}
            includeBkInYield={record.include_bk_in_yield}
            onToggleIncludeBkInYield={setIncludeBkInYield}
          />

          <SaveBar status={status} dirty={dirty} onReset={reset} />
        </div>
      </div>
    </>
  );
}
