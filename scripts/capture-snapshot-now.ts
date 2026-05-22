import { createClient } from "@supabase/supabase-js";

import { DEFAULT_MODE_CODE } from "../src/features/assignment-board/types";
import type {
  Employee,
  EmployeeStatus,
  ModeCode,
  ShiftInfo,
  Station,
  StationAssignment,
  WorkArea,
  WorkAreaModeView,
  WorkAreaShiftMap,
} from "../src/features/assignment-board/types";
import { DEPT_ONLY_SHIFT_CODE } from "../src/features/assignment-board/utils";
import { DEFAULT_STATUS_CONFIGS, type StatusConfig } from "../src/features/assignment-board/components/status-select";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const WORK_DATE = process.argv[2] ?? new Date().toISOString().split("T")[0];

async function main() {
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[capture] building snapshot for work_date=${WORK_DATE}`);

  const [
    workAreas,
    modeViews,
    shifts,
    statusConfigs,
    employees,
    qualified,
    stations,
    statuses,
    assignments,
  ] = await Promise.all([
    supabase.from("work_areas").select("id, name, color_hex, display_order").order("display_order"),
    supabase.from("work_area_mode_views").select("work_area_id, mode_code, label, time_range, display_order").order("work_area_id").order("display_order"),
    supabase.from("work_area_shifts").select("work_area_id, mode_code, code, label, time_range, display_order").order("work_area_id").order("mode_code").order("display_order"),
    supabase.from("status_configs").select("code, label, color_hex, unavailable, display_order").order("display_order"),
    supabase.from("employees").select("id, employee_code, full_name, home_work_area_id, active, gender, level, temporary").order("employee_code", { nullsFirst: false }),
    supabase.from("employee_qualified_work_areas").select("employee_id, work_area_id"),
    supabase.from("stations").select("id, work_area_id, name, required_headcount, display_order, mode_code, gender_restriction, default_employee_id").order("work_area_id").order("display_order"),
    supabase.from("employee_daily_statuses").select("employee_id, status_code"),
    supabase.from("station_assignments").select("id, employee_id, station_id, work_area_id, work_date, shift_code, mode_code"),
  ]);

  for (const r of [workAreas, modeViews, shifts, statusConfigs, employees, qualified, stations, statuses, assignments]) {
    if (r.error) throw new Error(r.error.message);
  }

  const mvByWa = new Map<string, WorkAreaModeView[]>();
  for (const row of modeViews.data ?? []) {
    const arr = mvByWa.get(row.work_area_id) ?? [];
    arr.push({
      mode_code: row.mode_code as WorkAreaModeView["mode_code"],
      label: row.label,
      ...(row.time_range ? { time_range: row.time_range } : {}),
    });
    mvByWa.set(row.work_area_id, arr);
  }

  const builtWorkAreas: WorkArea[] = (workAreas.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    color_hex: row.color_hex,
    display_order: row.display_order,
    ...(mvByWa.get(row.id)?.length ? { mode_views: mvByWa.get(row.id) } : {}),
  }));

  const shiftsByKey = new Map<string, ShiftInfo[]>();
  for (const row of shifts.data ?? []) {
    const key = `${row.work_area_id}::${row.mode_code}`;
    const arr = shiftsByKey.get(key) ?? [];
    arr.push({ code: row.code, label: row.label, time_range: row.time_range });
    shiftsByKey.set(key, arr);
  }
  const workAreaShifts: WorkAreaShiftMap = {};
  for (const wa of builtWorkAreas) {
    const modes: ModeCode[] = wa.mode_views?.length
      ? (wa.mode_views.map((mv) => mv.mode_code) as ModeCode[])
      : [DEFAULT_MODE_CODE];
    const perMode = {} as Record<ModeCode, ShiftInfo[]>;
    for (const m of modes) perMode[m] = shiftsByKey.get(`${wa.id}::${m}`) ?? [];
    workAreaShifts[wa.id] = perMode;
  }

  const qualifiedByEmp = new Map<string, string[]>();
  for (const row of qualified.data ?? []) {
    const arr = qualifiedByEmp.get(row.employee_id) ?? [];
    arr.push(row.work_area_id);
    qualifiedByEmp.set(row.employee_id, arr);
  }
  const builtEmployees: Employee[] = (employees.data ?? []).map((row) => ({
    id: row.id,
    employee_code: row.employee_code,
    full_name: row.full_name,
    homeDepartmentId: row.home_work_area_id,
    qualifiedDepartmentIds: qualifiedByEmp.get(row.id) ?? [row.home_work_area_id],
    active: row.active,
    ...(row.gender ? { gender: row.gender } : {}),
    ...(row.level ? { level: row.level } : {}),
    ...(row.temporary ? { temporary: true } : {}),
  }));

  const builtStations: Station[] = (stations.data ?? []).map((row) => ({
    id: row.id,
    work_area_id: row.work_area_id,
    name: row.name,
    required_headcount: row.required_headcount,
    display_order: row.display_order,
    ...(row.mode_code ? { mode_code: row.mode_code as Station["mode_code"] } : {}),
    ...(row.gender_restriction ? { gender_restriction: row.gender_restriction } : {}),
    ...(row.default_employee_id ? { defaultEmployeeId: row.default_employee_id } : {}),
  }));

  const builtStatuses: Record<string, EmployeeStatus> = Object.fromEntries(
    (statuses.data ?? []).map((row) => [row.employee_id, row.status_code]),
  );

  const builtAssignments: StationAssignment[] = (assignments.data ?? []).map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    station_id: row.station_id,
    work_area_id: row.work_area_id,
    work_date: row.work_date,
    shift_code: row.shift_code ?? DEPT_ONLY_SHIFT_CODE,
    mode_code: row.mode_code as StationAssignment["mode_code"],
  }));

  const builtStatusConfigs: StatusConfig[] = (statusConfigs.data?.length ? statusConfigs.data : DEFAULT_STATUS_CONFIGS.map((c) => ({
    code: c.code,
    label: c.label,
    color_hex: c.colorHex ?? null,
    unavailable: c.unavailable ?? false,
    display_order: 0,
  }))).map((row) => ({
    code: row.code,
    label: row.label,
    className: "",
    ...(row.color_hex ? { colorHex: row.color_hex } : {}),
    ...(row.unavailable ? { unavailable: true } : {}),
  }));

  const snapshot = {
    employees: builtEmployees,
    statuses: builtStatuses,
    assignments: builtAssignments,
    stations: builtStations,
    workAreas: builtWorkAreas,
    workAreaShifts,
    statusConfigs: builtStatusConfigs,
  };

  console.log(`[capture] employees=${builtEmployees.length} assignments=${builtAssignments.length} statuses=${Object.keys(builtStatuses).length} stations=${builtStations.length} workAreas=${builtWorkAreas.length}`);

  const { error } = await supabase
    .from("assignment_board_snapshots")
    .upsert({ work_date: WORK_DATE, snapshot, captured_at: new Date().toISOString() }, { onConflict: "work_date" });

  if (error) throw new Error(error.message);

  console.log(`[capture] snapshot saved for work_date=${WORK_DATE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
