import type {
  Employee,
  EmployeeStatus,
  Station,
  StationAssignment,
  WorkArea,
} from "@/features/assignment-board/types";
import { getUnavailableStatusCodes, type StatusConfig } from "@/features/assignment-board/components/status-select";
import { getAssignmentWorkAreaId } from "@/features/assignment-board/utils";
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
  assignments: StationAssignment[];
  stations: Station[];
  targetOverrides?: Record<string, number>;
};

export function computeAllStats(ctx: ComputeContext): WorkAreaStats[] {
  const unavailable = getUnavailableStatusCodes(ctx.statusConfigs);
  const activeIds = new Set(ctx.employees.filter((e) => e.active).map((e) => e.id));

  type Counts = { absent: number; vacation: number; lightDuty: number };
  const countsByWa = new Map<string, Counts>();
  for (const wa of ctx.workAreas) {
    countsByWa.set(wa.id, { absent: 0, vacation: 0, lightDuty: 0 });
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
    } else if (isLightDuty) {
      bucket.lightDuty += 1;
    }
  }

  // Distinct active employees actually assigned to a station in each WA
  // (loan-ins count toward the WA they're assigned to, not their home).
  const assignedByWa = new Map<string, Set<string>>();
  for (const wa of ctx.workAreas) assignedByWa.set(wa.id, new Set());
  for (const a of ctx.assignments) {
    if (a.station_id === null) continue;
    if (!activeIds.has(a.employee_id)) continue;
    const waId = getAssignmentWorkAreaId(a, ctx.stations);
    if (!waId) continue;
    assignedByWa.get(waId)?.add(a.employee_id);
  }

  return ctx.workAreas.map((wa) => {
    const required = resolveWorkAreaTarget(wa.id, ctx.employees, ctx.targetOverrides);
    const counts = countsByWa.get(wa.id) ?? { absent: 0, vacation: 0, lightDuty: 0 };
    const assigned = assignedByWa.get(wa.id)?.size ?? 0;
    return {
      workAreaId: wa.id,
      workAreaName: wa.name,
      workAreaColorHex: wa.color_hex,
      required,
      assigned,
      absent: counts.absent,
      vacation: counts.vacation,
      lightDuty: counts.lightDuty,
      overTarget: assigned - required,
      status: classifyStatus(assigned, required),
    };
  });
}

export function computeSummary(stats: WorkAreaStats[]): LineupSummary {
  return stats.reduce<LineupSummary>(
    (acc, s) => {
      acc.totalAssigned += s.assigned;
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
      totalAssigned: 0,
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
