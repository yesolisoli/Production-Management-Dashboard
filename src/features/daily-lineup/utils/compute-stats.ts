import type {
  Employee,
  EmployeeStatus,
  WorkArea,
} from "@/features/assignment-board/types";
import { getUnavailableStatusCodes, type StatusConfig } from "@/features/assignment-board/components/status-select";
import type { LineupSummary, WorkAreaStats } from "../types";
import { classifyStatus } from "./classify-status";
import { resolveWorkAreaTarget } from "../config/targets";

const VACATION_CODE = "vacation";
const LIGHT_DUTY_CODE = "injured";

type ComputeContext = {
  workAreas: WorkArea[];
  employees: Employee[];
  statuses: Record<string, EmployeeStatus>;
  statusConfigs: StatusConfig[];
  targetOverrides?: Record<string, number>;
};

export function computeAllStats(ctx: ComputeContext): WorkAreaStats[] {
  const unavailable = getUnavailableStatusCodes(ctx.statusConfigs);

  type Counts = { present: number; absent: number; vacation: number; lightDuty: number };
  const countsByWa = new Map<string, Counts>();
  for (const wa of ctx.workAreas) {
    countsByWa.set(wa.id, { present: 0, absent: 0, vacation: 0, lightDuty: 0 });
  }

  for (const emp of ctx.employees) {
    if (!emp.active) continue;
    const waId = emp.homeDepartmentId;
    if (!waId) continue;
    const bucket = countsByWa.get(waId);
    if (!bucket) continue;

    const status = ctx.statuses[emp.id];
    const isUnavailable = status ? unavailable.has(status) : false;
    const isVacation = status === VACATION_CODE;
    const isLightDuty = status === LIGHT_DUTY_CODE;

    if (isVacation) {
      bucket.vacation += 1;
    } else if (isUnavailable) {
      bucket.absent += 1;
    } else {
      bucket.present += 1;
      if (isLightDuty) bucket.lightDuty += 1;
    }
  }

  return ctx.workAreas.map((wa) => {
    const required = resolveWorkAreaTarget(wa.id, ctx.employees, ctx.targetOverrides);
    const counts = countsByWa.get(wa.id) ?? { present: 0, absent: 0, vacation: 0, lightDuty: 0 };
    const present = counts.present;
    return {
      workAreaId: wa.id,
      workAreaName: wa.name,
      workAreaColorHex: wa.color_hex,
      required,
      present,
      absent: counts.absent,
      vacation: counts.vacation,
      lightDuty: counts.lightDuty,
      overTarget: present - required,
      status: classifyStatus(present, required),
    };
  });
}

export function computeSummary(stats: WorkAreaStats[]): LineupSummary {
  return stats.reduce<LineupSummary>(
    (acc, s) => {
      acc.totalPresent += s.present;
      acc.totalTarget += s.required;
      acc.lightDuty += s.lightDuty;
      acc.totalAbsent += s.absent;
      acc.onVacation += s.vacation;
      if (s.status === "short") acc.deptsShort += 1;
      if (s.status === "critical") acc.deptsCritical += 1;
      if (s.status === "over") acc.deptsOver += 1;
      if (s.status === "on_track") acc.deptsOnTrack += 1;
      if (s.status === "full_crew") acc.deptsFullCrew += 1;
      return acc;
    },
    {
      totalPresent: 0,
      totalTarget: 0,
      lightDuty: 0,
      totalAbsent: 0,
      onVacation: 0,
      deptsShort: 0,
      deptsCritical: 0,
      deptsOver: 0,
      deptsOnTrack: 0,
      deptsFullCrew: 0,
    },
  );
}
