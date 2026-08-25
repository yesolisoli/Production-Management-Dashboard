"use client";

import Link from "next/link";
import { Beef, Calendar, Gauge, Scissors, UserCheck, Users } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { todayString } from "@/lib/date";
import { formatDateLabel } from "../format";
import { useNextDayProjection } from "../hooks/use-next-day-projection";
import {
  useOperationsOverview,
  type IntakeOverview,
  type StaffingOverview,
} from "../hooks/use-operations-overview";
import { usePrimalUsage } from "../hooks/use-primal-usage";
import { useProductionStatus } from "../hooks/use-production-status";
import { useRecentHogActivity } from "../hooks/use-recent-hog-activity";
import { DepartmentOverview } from "./department-overview";
import { HogTypeBreakdown } from "./hog-type-breakdown";
import { NextDayProjection } from "./next-day-projection";
import { OverviewCard } from "./overview-card";
import { PrimalUsage } from "./primal-usage";
import { ProductionStatus } from "./production-status";
import { RecentHogActivity } from "./recent-hog-activity";

// "5 more than Aug 14" / "Same as Aug 14". Names the actual compared date
// because the previous working day is not always literally yesterday.
function comparisonCaption(
  current: number,
  previous: number,
  previousDate: string,
): string {
  const label = formatDateLabel(previousDate);
  const diff = current - previous;
  if (diff === 0) return `Same as ${label}`;
  if (diff > 0) return `${diff} more than ${label}`;
  return `${-diff} fewer than ${label}`;
}

// Wraps a dashboard panel so clicking anywhere on it opens the page the data
// comes from. `grid` (not `block`) so the inner section stretches to the full
// row height the surrounding grid assigns.
function PanelLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="grid h-full rounded-2xl transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      {children}
    </Link>
  );
}

type HogCardProps = {
  title: string;
  icon: typeof Beef;
  chipTone: React.ComponentProps<typeof OverviewCard>["chipTone"];
  intake: IntakeOverview;
  pick: (values: { totalHogs: number; forCutting: number }) => number;
};

function HogCard({ title, icon, chipTone, intake, pick }: HogCardProps) {
  const hasValue = intake.status === "ready";
  const caption =
    intake.status === "error"
      ? "Couldn't load data"
      : intake.status === "missing"
        ? "No intake recorded for this day"
        : intake.previous
          ? comparisonCaption(pick(intake), pick(intake.previous), intake.previous.date)
          : undefined;
  return (
    <OverviewCard
      title={title}
      icon={icon}
      chipTone={chipTone}
      loading={intake.status === "loading"}
      value={hasValue ? String(pick(intake)) : "—"}
      caption={caption}
      href="/hog-intake"
    />
  );
}

function WorkersCard({ staffing }: { staffing: StaffingOverview }) {
  const hasValue = staffing.status === "ready";
  const caption =
    staffing.status === "error"
      ? "Couldn't load data"
      : staffing.status === "missing"
        ? "No lineup saved for this day"
        : staffing.previousAvailable
          ? comparisonCaption(
              staffing.available,
              staffing.previousAvailable.available,
              staffing.previousAvailable.date,
            )
          : undefined;
  return (
    <OverviewCard
      title="People Available"
      icon={Users}
      chipTone="emerald"
      loading={staffing.status === "loading"}
      value={hasValue ? String(staffing.available) : "—"}
      caption={caption}
      href="/assignment-board"
    />
  );
}

function StaffingCard({ staffing }: { staffing: StaffingOverview }) {
  if (staffing.status !== "ready") {
    return (
      <OverviewCard
        title="Staffing"
        icon={UserCheck}
        chipTone="slate"
        loading={staffing.status === "loading"}
        value="—"
        caption={
          staffing.status === "error"
            ? "Couldn't load data"
            : "No lineup saved for this day"
        }
        href="/assignment-board"
      />
    );
  }

  // Same figure Daily Lineup shows: staff assigned to stations vs the summed
  // work-area targets — phrased in words instead of a raw difference.
  const diff = staffing.assigned - staffing.target;
  const caption = `${staffing.assigned} assigned of ${staffing.target} target`;
  if (diff === 0) {
    return (
      <OverviewCard
        title="Staffing"
        icon={UserCheck}
        chipTone="emerald"
        value="On target"
        valueTone="good"
        caption={caption}
        href="/assignment-board"
      />
    );
  }
  if (diff < 0) {
    return (
      <OverviewCard
        title="Staffing"
        icon={UserCheck}
        chipTone="amber"
        value={String(-diff)}
        valueTone="warn"
        unit="short"
        caption={caption}
        href="/assignment-board"
      />
    );
  }
  return (
    <OverviewCard
      title="Staffing"
      icon={UserCheck}
      chipTone="slate"
      value={String(diff)}
      unit="over"
      caption={caption}
      href="/assignment-board"
    />
  );
}

// The hog-intake card's "Primal Total": hogs included in Primal Calc for the
// day (JP + RWA net of held-over/death adjustments) — the same figure the
// Primal Hogs card shows on the intake page.
function PrimalCard({ intake }: { intake: IntakeOverview }) {
  const caption =
    intake.status === "error"
      ? "Couldn't load data"
      : intake.status === "missing"
        ? "No intake recorded for this day"
        : "Included in Primal Calc";
  return (
    <OverviewCard
      title="Primal Total"
      icon={Gauge}
      chipTone="sky"
      loading={intake.status === "loading"}
      value={intake.status === "ready" ? String(intake.primalTotal) : "—"}
      caption={caption}
      href="/hog-intake"
    />
  );
}

export function OperationsDashboardClient() {
  const { date, setDate, intake, staffing } = useOperationsOverview();
  const nextDayProjection = useNextDayProjection(date, intake.record);
  const recent = useRecentHogActivity(date);
  const primalUsage = usePrimalUsage(date, intake.status, intake.record);
  const productionStatus = useProductionStatus(date);
  const isToday = date === todayString();

  return (
    <>
      <AppHeader
        eyebrow="Dashboard"
        title="Operations"
        actions={
          <label className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-transparent sm:h-auto sm:w-auto sm:justify-start sm:gap-2 sm:px-3 sm:py-2">
            <Calendar size={16} className="shrink-0 text-white/70" />
            <input
              type="date"
              aria-label="Selected date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0 sm:static sm:h-7 sm:w-auto sm:min-w-0 sm:cursor-auto sm:border-0 sm:bg-transparent sm:text-sm sm:font-semibold sm:tabular-nums sm:text-white sm:opacity-100 sm:outline-none sm:scheme-dark"
            />
          </label>
        }
      />

      <div className="flex-1 bg-slate-50">
        <div className="flex flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {isToday
              ? "Today's Overview"
              : `Overview — ${formatDateLabel(date)}`}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <HogCard
              title="Total Hogs"
              icon={Beef}
              chipTone="blue"
              intake={intake}
              pick={(values) => values.totalHogs}
            />
            <HogCard
              title="For Cutting Today"
              icon={Scissors}
              chipTone="violet"
              intake={intake}
              pick={(values) => values.forCutting}
            />
            <PrimalCard intake={intake} />
            <WorkersCard staffing={staffing} />
            <StaffingCard staffing={staffing} />
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
            <PanelLink href="/hog-intake">
              <RecentHogActivity
                date={date}
                days={recent.days}
                status={recent.status}
              />
            </PanelLink>
            <PanelLink href="/hog-intake">
              <HogTypeBreakdown
                date={date}
                days={recent.days}
                status={recent.status}
              />
            </PanelLink>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
            <PanelLink href="/assignment-board">
              <DepartmentOverview staffing={staffing} />
            </PanelLink>
            <PanelLink href="/primal-calc">
              <PrimalUsage overview={primalUsage} />
            </PanelLink>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
            <PanelLink href="/production-planner">
              <ProductionStatus
                isToday={isToday}
                production={productionStatus.production}
                routes={productionStatus.routes}
              />
            </PanelLink>
            <PanelLink href="/hog-intake">
              <NextDayProjection
                date={date}
                loading={intake.status === "loading"}
                projection={nextDayProjection}
              />
            </PanelLink>
          </div>
        </div>
      </div>
    </>
  );
}
