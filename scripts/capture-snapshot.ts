import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(__dirname, "..", ".env.local") });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type WorkAreaRow = { id: string; name: string; color_hex: string | null; display_order: number };
type ModeViewRow = { work_area_id: string; mode_code: string; label: string; time_range: string | null; display_order: number };
type ShiftRow = { work_area_id: string; mode_code: string; code: string; label: string; time_range: string; display_order: number };
type StatusConfigRow = { code: string; label: string; color_hex: string | null; unavailable: boolean; display_order: number };
type EmployeeRow = { id: string; employee_code: string | null; full_name: string; home_work_area_id: string; active: boolean; gender: "M" | "F" | null; level: 1 | 2 | 3 | null; temporary: boolean };
type QualifiedRow = { employee_id: string; work_area_id: string };
type StationRow = { id: string; work_area_id: string; name: string; required_headcount: number; display_order: number; mode_code: string | null; gender_restriction: "M" | "F" | null; default_employee_id: string | null; protected: boolean; station_group: string | null };
type StatusRow = { employee_id: string; status_code: string };
type AssignmentRow = { id: string; employee_id: string; station_id: string | null; work_area_id: string | null; work_date: string; shift_code: string | null; mode_code: string };

async function fetchAll(supabase: SupabaseClient) {
  const [waR, mvR, shR, scR, eR, qR, stR, edsR, saR] = await Promise.all([
    supabase.from("work_areas").select("id, name, color_hex, display_order").order("display_order"),
    supabase.from("work_area_mode_views").select("work_area_id, mode_code, label, time_range, display_order").order("work_area_id").order("display_order"),
    supabase.from("work_area_shifts").select("work_area_id, mode_code, code, label, time_range, display_order").order("work_area_id").order("mode_code").order("display_order"),
    supabase.from("status_configs").select("code, label, color_hex, unavailable, display_order").order("display_order"),
    supabase.from("employees").select("id, employee_code, full_name, home_work_area_id, active, gender, level, temporary").order("employee_code", { nullsFirst: false }),
    supabase.from("employee_qualified_work_areas").select("employee_id, work_area_id"),
    supabase.from("stations").select("id, work_area_id, name, required_headcount, display_order, mode_code, gender_restriction, default_employee_id, protected, station_group").order("work_area_id").order("display_order"),
    supabase.from("employee_daily_statuses").select("employee_id, status_code"),
    supabase.from("station_assignments").select("id, employee_id, station_id, work_area_id, work_date, shift_code, mode_code"),
  ]);

  const errors = [waR, mvR, shR, scR, eR, qR, stR, edsR, saR].map((r) => r.error).filter(Boolean);
  if (errors.length > 0) throw new Error(errors.map((e) => e?.message).join("; "));

  return {
    workAreaRows: (waR.data ?? []) as WorkAreaRow[],
    modeViewRows: (mvR.data ?? []) as ModeViewRow[],
    shiftRows: (shR.data ?? []) as ShiftRow[],
    statusConfigRows: (scR.data ?? []) as StatusConfigRow[],
    employeeRows: (eR.data ?? []) as EmployeeRow[],
    qualifiedRows: (qR.data ?? []) as QualifiedRow[],
    stationRows: (stR.data ?? []) as StationRow[],
    statusRows: (edsR.data ?? []) as StatusRow[],
    assignmentRows: (saR.data ?? []) as AssignmentRow[],
  };
}

function buildSnapshot(d: Awaited<ReturnType<typeof fetchAll>>) {
  const modeViewsByWa = new Map<string, ModeViewRow[]>();
  for (const r of d.modeViewRows) {
    const cur = modeViewsByWa.get(r.work_area_id) ?? [];
    cur.push(r);
    modeViewsByWa.set(r.work_area_id, cur);
  }

  const workAreas = d.workAreaRows.map((r) => {
    const mvs = modeViewsByWa.get(r.id) ?? [];
    return {
      id: r.id,
      name: r.name,
      color_hex: r.color_hex,
      display_order: r.display_order,
      ...(mvs.length
        ? {
            mode_views: mvs.map((mv) => ({
              mode_code: mv.mode_code,
              label: mv.label,
              ...(mv.time_range ? { time_range: mv.time_range } : {}),
            })),
          }
        : {}),
    };
  });

  const shiftsByKey = new Map<string, { code: string; label: string; time_range: string }[]>();
  for (const r of d.shiftRows) {
    const key = `${r.work_area_id}::${r.mode_code}`;
    const cur = shiftsByKey.get(key) ?? [];
    cur.push({ code: r.code, label: r.label, time_range: r.time_range });
    shiftsByKey.set(key, cur);
  }
  const workAreaShifts: Record<string, Record<string, { code: string; label: string; time_range: string }[]>> = {};
  for (const wa of workAreas) {
    const modeCodes = wa.mode_views?.length ? wa.mode_views.map((mv) => mv.mode_code) : ["normal"];
    const perMode: Record<string, { code: string; label: string; time_range: string }[]> = {};
    for (const mc of modeCodes) perMode[mc] = shiftsByKey.get(`${wa.id}::${mc}`) ?? [];
    workAreaShifts[wa.id] = perMode;
  }

  const qualifiedByEmp = new Map<string, string[]>();
  for (const r of d.qualifiedRows) {
    const cur = qualifiedByEmp.get(r.employee_id) ?? [];
    cur.push(r.work_area_id);
    qualifiedByEmp.set(r.employee_id, cur);
  }

  const employees = d.employeeRows.map((r) => ({
    id: r.id,
    employee_code: r.employee_code,
    full_name: r.full_name,
    homeDepartmentId: r.home_work_area_id,
    qualifiedDepartmentIds: qualifiedByEmp.get(r.id) ?? [r.home_work_area_id],
    active: r.active,
    ...(r.gender ? { gender: r.gender } : {}),
    ...(r.level ? { level: r.level } : {}),
    ...(r.temporary ? { temporary: true } : {}),
  }));

  const stations = d.stationRows.map((r) => ({
    id: r.id,
    work_area_id: r.work_area_id,
    name: r.name,
    required_headcount: r.required_headcount,
    display_order: r.display_order,
    ...(r.mode_code ? { mode_code: r.mode_code } : {}),
    ...(r.gender_restriction ? { gender_restriction: r.gender_restriction } : {}),
    ...(r.default_employee_id ? { defaultEmployeeId: r.default_employee_id } : {}),
    ...(r.protected ? { protected: true } : {}),
    ...(r.station_group ? { group: r.station_group } : {}),
  }));

  const statuses: Record<string, string> = {};
  for (const r of d.statusRows) statuses[r.employee_id] = r.status_code;

  const assignments = d.assignmentRows.map((r) => ({
    id: r.id,
    employee_id: r.employee_id,
    station_id: r.station_id,
    work_area_id: r.work_area_id,
    work_date: r.work_date,
    shift_code: r.shift_code ?? "__dept_only__",
    mode_code: r.mode_code,
  }));

  const statusConfigs = d.statusConfigRows.map((r) => ({
    code: r.code,
    label: r.label,
    colorHex: r.color_hex ?? undefined,
    unavailable: r.unavailable,
  }));

  return { employees, statuses, assignments, stations, workAreas, workAreaShifts, statusConfigs };
}

async function main() {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const workDate = todayDateString();
  console.log(`[snapshot] capturing for work_date=${workDate}…`);

  const data = await fetchAll(supabase);
  const snapshot = buildSnapshot(data);

  const { error } = await supabase
    .from("assignment_board_snapshots")
    .insert({ work_date: workDate, snapshot });

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      console.log(`[snapshot] a snapshot already exists for ${workDate}; nothing inserted.`);
      return;
    }
    throw new Error(error.message);
  }

  console.log(`[snapshot] inserted (employees=${snapshot.employees.length}, assignments=${snapshot.assignments.length}, stations=${snapshot.stations.length}).`);
}

main().catch((e) => {
  console.error("[snapshot] failed:", e);
  process.exit(1);
});
