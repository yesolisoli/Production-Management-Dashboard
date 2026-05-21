import { DEFAULT_MODE_CODE } from "./types";
import type {
  Employee,
  ShiftCode,
  ShiftInfo,
  Station,
  StationAssignment,
  WorkArea,
} from "./types";

/** Sentinel shift code used for dept-level assignments when no real shift is configured. */
export const DEPT_ONLY_SHIFT_CODE: ShiftCode = "_dept";

/**
 * ISO date (YYYY-MM-DD) for "today" in the local timezone. Used only to stamp
 * locally-constructed StationAssignment objects so they round-trip with rows
 * the DB has auto-defaulted via `work_date DEFAULT current_date`. The live
 * board itself never filters or branches on this value.
 */
export function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function hasNullStationAssignment(
  employeeId: string,
  workAreaId: string,
  assignments: StationAssignment[],
): boolean {
  return assignments.some(
    (a) => a.employee_id === employeeId && a.station_id === null && a.work_area_id === workAreaId,
  );
}

export function getEmployeeQualifiedWorkAreaIds(employee: Employee): string[] {
  return employee.qualifiedDepartmentIds;
}

export function isEmployeeEligibleForWorkArea(employee: Employee, workAreaId: string): boolean {
  if (employee.homeDepartmentId === workAreaId) return true;
  if (getEmployeeQualifiedWorkAreaIds(employee).includes(workAreaId)) return true;
  return false;
}

export function abbrevDept(dept: string): string {
  return dept.split(/\s+/).map((w) => w[0].toUpperCase()).join("");
}

export function parseTimeMin(t: string): number {
  const [h, m] = t.trim().split(":").map(Number);
  return h * 60 + m;
}

export function getActiveShift(shifts: ShiftInfo[], now: Date): ShiftInfo | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    shifts.find((s) => {
      if (!s.time_range.includes("-")) return false;
      const [a, b] = s.time_range.split("-");
      return nowMin >= parseTimeMin(a) && nowMin <= parseTimeMin(b);
    }) ?? null
  );
}

export function getWaActiveMode(wa: WorkArea, nowMin: number): string {
  if (!wa.mode_views || wa.mode_views.length === 0) return DEFAULT_MODE_CODE;
  for (const mv of wa.mode_views) {
    if (!mv.time_range) continue;
    const parts = mv.time_range.split("-").map((s) => s.trim());
    if (parts.length === 2 && nowMin >= parseTimeMin(parts[0]) && nowMin <= parseTimeMin(parts[1])) {
      return mv.mode_code;
    }
  }
  return DEFAULT_MODE_CODE;
}

export function getNextShift(shifts: ShiftInfo[], current: ShiftInfo | null): ShiftInfo | null {
  if (!current) return shifts[0] ?? null;
  const idx = shifts.findIndex((s) => s.code === current.code);
  return shifts[idx + 1] ?? null;
}

export function getAssignmentWorkAreaId(
  assignment: StationAssignment,
  stations: Station[],
): string | undefined {
  if (assignment.station_id === null) return assignment.work_area_id ?? undefined;
  return stations.find((s) => s.id === assignment.station_id)?.work_area_id;
}

export function getEmployeeActiveDepartmentIds(
  employeeId: string,
  assignments: StationAssignment[],
  stations: Station[],
): string[] {
  return [
    ...new Set(
      assignments
        .filter((a) => a.employee_id === employeeId)
        .map((a) => getAssignmentWorkAreaId(a, stations))
        .filter((id): id is string => id !== undefined),
    ),
  ];
}

