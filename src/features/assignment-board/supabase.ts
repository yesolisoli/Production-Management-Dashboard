"use client";

import { createClient } from "@/lib/supabase/client";

import { DEFAULT_STATUS_CONFIGS, STATUS_CODE_ASSIGNED, type StatusConfig } from "./components/status-select";
import { DEFAULT_MODE_CODE, type Employee, type EmployeeStatus, type ModeCode, type ShiftCode, type ShiftInfo, type Station, type StationAssignment, type WorkArea, type WorkAreaModeView, type WorkAreaShiftMap } from "./types";
import { DEPT_ONLY_SHIFT_CODE, todayDateString } from "./utils";

type WorkAreaRow = {
  id: string;
  name: string;
  color_hex: string | null;
  display_order: number;
};

type WorkAreaModeViewRow = {
  work_area_id: string;
  mode_code: string;
  label: string;
  time_range: string | null;
  display_order: number;
};

type WorkAreaShiftRow = {
  work_area_id: string;
  mode_code: string;
  code: string;
  label: string;
  time_range: string;
  display_order: number;
};

type StatusConfigRow = {
  code: string;
  label: string;
  color_hex: string | null;
  unavailable: boolean;
  display_order: number;
};

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  full_name: string;
  home_work_area_id: string;
  active: boolean;
  gender: "M" | "F" | null;
  level: 1 | 2 | 3 | null;
  temporary: boolean;
};

type EmployeeQualifiedWorkAreaRow = {
  employee_id: string;
  work_area_id: string;
};

type StationRow = {
  id: string;
  work_area_id: string;
  name: string;
  required_headcount: number;
  display_order: number;
  mode_code: string | null;
  gender_restriction: "M" | "F" | null;
  default_employee_id: string | null;
  protected: boolean;
  station_group: string | null;
};

type EmployeeDailyStatusRow = {
  employee_id: string;
  status_code: string;
};

type StationAssignmentRow = {
  id: string;
  employee_id: string;
  station_id: string | null;
  work_area_id: string | null;
  work_date: string;
  shift_code: string | null;
  mode_code: string;
};

export type AssignmentBoardSnapshot = {
  employees: Employee[];
  statuses: Record<string, EmployeeStatus>;
  assignments: StationAssignment[];
  stations: Station[];
  workAreas: WorkArea[];
  workAreaShifts: WorkAreaShiftMap;
  statusConfigs: StatusConfig[];
};

type RealAssignmentWrite = {
  id: string;
  employeeId: string;
  stationId: string;
  workAreaId: string;
  shiftCode: ShiftCode;
  modeCode: string;
};

type DeptOnlyAssignmentWrite = {
  id: string;
  employeeId: string;
  workAreaId: string;
  shiftCode: ShiftCode;
  modeCode: string;
};

function toDbShiftCode(shiftCode: ShiftCode | null): string | null {
  if (!shiftCode || shiftCode === DEPT_ONLY_SHIFT_CODE) return null;
  return shiftCode;
}

function mergeStatusConfigs(rows: StatusConfigRow[]): StatusConfig[] {
  const defaultsByCode = new Map(DEFAULT_STATUS_CONFIGS.map((cfg) => [cfg.code, cfg]));
  const loaded: StatusConfig[] = rows.map((row) => {
    const fallback = defaultsByCode.get(row.code);
    return {
      code: row.code,
      label: row.label,
      className: fallback?.className ?? "",
      colorHex: row.color_hex ?? fallback?.colorHex,
      unavailable: row.unavailable,
      ...(fallback?.protected ? { protected: true } : {}),
    };
  });

  if (!loaded.some((cfg) => cfg.code === STATUS_CODE_ASSIGNED)) {
    const assigned = defaultsByCode.get(STATUS_CODE_ASSIGNED);
    if (assigned) loaded.splice(1, 0, assigned);
  }

  return loaded;
}

async function fetchStatusConfigs(): Promise<StatusConfig[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("status_configs")
    .select("code, label, color_hex, unavailable, display_order")
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return mergeStatusConfigs((data ?? []) as StatusConfigRow[]);
}

async function fetchWorkAreasSnapshot(): Promise<WorkArea[]> {
  const supabase = createClient();
  const [workAreasResult, modeViewsResult] = await Promise.all([
    supabase
      .from("work_areas")
      .select("id, name, color_hex, display_order")
      .order("display_order", { ascending: true }),
    supabase
      .from("work_area_mode_views")
      .select("work_area_id, mode_code, label, time_range, display_order")
      .order("work_area_id", { ascending: true })
      .order("display_order", { ascending: true }),
  ]);

  if (workAreasResult.error) throw new Error(workAreasResult.error.message);
  if (modeViewsResult.error) throw new Error(modeViewsResult.error.message);

  return buildWorkAreas(
    (workAreasResult.data ?? []) as WorkAreaRow[],
    (modeViewsResult.data ?? []) as WorkAreaModeViewRow[],
  );
}

function buildWorkAreas(
  workAreaRows: WorkAreaRow[],
  modeViewRows: WorkAreaModeViewRow[],
): WorkArea[] {
  const modeViewsByWorkArea = new Map<string, WorkAreaModeView[]>();

  for (const row of modeViewRows) {
    const current = modeViewsByWorkArea.get(row.work_area_id) ?? [];
    current.push({
      mode_code: row.mode_code as WorkAreaModeView["mode_code"],
      label: row.label,
      ...(row.time_range ? { time_range: row.time_range } : {}),
    });
    modeViewsByWorkArea.set(row.work_area_id, current);
  }

  return workAreaRows.map((row) => ({
    id: row.id,
    name: row.name,
    color_hex: row.color_hex,
    display_order: row.display_order,
    ...(modeViewsByWorkArea.get(row.id)?.length ? { mode_views: modeViewsByWorkArea.get(row.id) } : {}),
  }));
}

function buildWorkAreaShifts(
  workAreas: WorkArea[],
  shiftRows: WorkAreaShiftRow[],
): WorkAreaShiftMap {
  const shiftsByKey = new Map<string, ShiftInfo[]>();
  const keyFor = (workAreaId: string, modeCode: string) => `${workAreaId}::${modeCode}`;

  for (const row of shiftRows) {
    const key = keyFor(row.work_area_id, row.mode_code);
    const current = shiftsByKey.get(key) ?? [];
    current.push({
      code: row.code,
      label: row.label,
      time_range: row.time_range,
    });
    shiftsByKey.set(key, current);
  }

  const result: WorkAreaShiftMap = {};
  for (const wa of workAreas) {
    const modeCodes: ModeCode[] = wa.mode_views?.length
      ? (wa.mode_views.map((mv) => mv.mode_code) as ModeCode[])
      : [DEFAULT_MODE_CODE];
    const perMode: Record<ModeCode, ShiftInfo[]> = {} as Record<ModeCode, ShiftInfo[]>;
    for (const modeCode of modeCodes) {
      perMode[modeCode] = shiftsByKey.get(keyFor(wa.id, modeCode)) ?? [];
    }
    result[wa.id] = perMode;
  }
  return result;
}

function buildEmployees(
  employeeRows: EmployeeRow[],
  qualifiedRows: EmployeeQualifiedWorkAreaRow[],
): Employee[] {
  const qualifiedByEmployeeId = new Map<string, string[]>();

  for (const row of qualifiedRows) {
    const current = qualifiedByEmployeeId.get(row.employee_id) ?? [];
    current.push(row.work_area_id);
    qualifiedByEmployeeId.set(row.employee_id, current);
  }

  return employeeRows.map((row) => ({
    id: row.id,
    employee_code: row.employee_code,
    full_name: row.full_name,
    homeDepartmentId: row.home_work_area_id,
    qualifiedDepartmentIds: qualifiedByEmployeeId.get(row.id) ?? [row.home_work_area_id],
    active: row.active,
    ...(row.gender ? { gender: row.gender } : {}),
    ...(row.level ? { level: row.level } : {}),
    ...(row.temporary ? { temporary: true } : {}),
  }));
}

function buildStations(rows: StationRow[], localOverlayStations: Station[] = []): Station[] {
  const localStationsById = new Map(localOverlayStations.map((station) => [station.id, station]));

  return rows.map((row) => {
    const local = localStationsById.get(row.id);
    const isProtected = row.protected || !!local?.protected;
    const group = row.station_group ?? local?.group;
    return {
      id: row.id,
      work_area_id: row.work_area_id,
      name: row.name,
      required_headcount: row.required_headcount,
      display_order: row.display_order,
      ...(row.mode_code ? { mode_code: row.mode_code as Station["mode_code"] } : {}),
      ...(row.gender_restriction ? { gender_restriction: row.gender_restriction } : {}),
      ...(row.default_employee_id ? { defaultEmployeeId: row.default_employee_id } : {}),
      ...(isProtected ? { protected: true } : {}),
      ...(group ? { group } : {}),
    };
  });
}

function buildStatuses(rows: EmployeeDailyStatusRow[]): Record<string, EmployeeStatus> {
  return Object.fromEntries(rows.map((row) => [row.employee_id, row.status_code]));
}

function buildAssignments(rows: StationAssignmentRow[]): StationAssignment[] {
  return rows.map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    station_id: row.station_id,
    work_area_id: row.work_area_id,
    work_date: row.work_date,
    shift_code: (row.shift_code ?? DEPT_ONLY_SHIFT_CODE),
    mode_code: row.mode_code as StationAssignment["mode_code"],
  }));
}

async function fetchEmployeesAndQualifications(): Promise<Employee[]> {
  const supabase = createClient();
  const [employeesResult, qualifiedResult] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_code, full_name, home_work_area_id, active, gender, level, temporary")
      .order("employee_code", { ascending: true, nullsFirst: false }),
    supabase
      .from("employee_qualified_work_areas")
      .select("employee_id, work_area_id")
      .order("employee_id", { ascending: true })
      .order("work_area_id", { ascending: true }),
  ]);

  if (employeesResult.error) throw new Error(employeesResult.error.message);
  if (qualifiedResult.error) throw new Error(qualifiedResult.error.message);

  return buildEmployees(
    (employeesResult.data ?? []) as EmployeeRow[],
    (qualifiedResult.data ?? []) as EmployeeQualifiedWorkAreaRow[],
  );
}

async function fetchLiveStatuses(): Promise<Record<string, EmployeeStatus>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("employee_daily_statuses")
    .select("employee_id, status_code");

  if (error) throw new Error(error.message);
  return buildStatuses((data ?? []) as EmployeeDailyStatusRow[]);
}

async function fetchLiveAssignments(): Promise<StationAssignment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("station_assignments")
    .select("id, employee_id, station_id, work_area_id, work_date, shift_code, mode_code");

  if (error) throw new Error(error.message);
  return buildAssignments((data ?? []) as StationAssignmentRow[]);
}

async function fetchWorkAreaShiftsSnapshot(workAreas: WorkArea[]): Promise<WorkAreaShiftMap> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("work_area_shifts")
    .select("work_area_id, mode_code, code, label, time_range, display_order")
    .order("work_area_id", { ascending: true })
    .order("mode_code", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return buildWorkAreaShifts(workAreas, (data ?? []) as WorkAreaShiftRow[]);
}

async function fetchStationsSnapshot(localOverlayStations: Station[] = []): Promise<Station[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stations")
    .select("id, work_area_id, name, required_headcount, display_order, mode_code, gender_restriction, default_employee_id, protected, station_group")
    .order("work_area_id", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return buildStations((data ?? []) as StationRow[], localOverlayStations);
}

export async function refetchAssignmentSnapshot(): Promise<StationAssignment[]> {
  return fetchLiveAssignments();
}

export async function refetchStatusSnapshot(): Promise<Record<string, EmployeeStatus>> {
  return fetchLiveStatuses();
}

export async function refetchStatusConfigsSnapshot(): Promise<StatusConfig[]> {
  return fetchStatusConfigs();
}

export async function refetchWorkAreasSnapshot(): Promise<WorkArea[]> {
  return fetchWorkAreasSnapshot();
}

export async function refetchEmployeesSnapshot(): Promise<Employee[]> {
  return fetchEmployeesAndQualifications();
}

export async function refetchStationsSnapshot(localOverlayStations: Station[] = []): Promise<Station[]> {
  return fetchStationsSnapshot(localOverlayStations);
}

export async function refetchWorkAreaShiftsSnapshot(workAreas: WorkArea[]): Promise<WorkAreaShiftMap> {
  return fetchWorkAreaShiftsSnapshot(workAreas);
}

export async function insertEmployee(params: {
  id: string;
  employeeCode: string | null;
  fullName: string;
  homeWorkAreaId: string;
  active: boolean;
  gender?: "M" | "F";
  level?: 1 | 2 | 3;
  temporary?: boolean;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("employees").insert({
    id: params.id,
    employee_code: params.employeeCode,
    full_name: params.fullName,
    home_work_area_id: params.homeWorkAreaId,
    active: params.active,
    gender: params.gender ?? null,
    level: params.level ?? null,
    temporary: params.temporary ?? false,
  });

  if (error) throw new Error(error.message);
}

export async function insertWorkArea(params: {
  id: string;
  name: string;
  colorHex: string;
  displayOrder: number;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("work_areas")
    .insert({
      id: params.id,
      name: params.name,
      color_hex: params.colorHex,
      display_order: params.displayOrder,
    });

  if (error) throw new Error(error.message);
}

export async function updateWorkAreaRecord(params: {
  id: string;
  name?: string;
  colorHex?: string;
  displayOrder?: number;
}): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.colorHex !== undefined) updates.color_hex = params.colorHex;
  if (params.displayOrder !== undefined) updates.display_order = params.displayOrder;

  const supabase = createClient();
  const { error } = await supabase
    .from("work_areas")
    .update(updates)
    .eq("id", params.id);

  if (error) throw new Error(error.message);
}

export async function deleteWorkAreaRecord(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("work_areas")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function replaceWorkAreaModeViews(params: {
  workAreaId: string;
  modeViews: Array<{ modeCode: string; label: string; timeRange?: string }>;
}): Promise<void> {
  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("work_area_mode_views")
    .delete()
    .eq("work_area_id", params.workAreaId);

  if (deleteError) throw new Error(deleteError.message);

  if (params.modeViews.length === 0) return;

  const { error: insertError } = await supabase
    .from("work_area_mode_views")
    .insert(
      params.modeViews.map((modeView, index) => ({
        work_area_id: params.workAreaId,
        mode_code: modeView.modeCode,
        label: modeView.label,
        time_range: modeView.timeRange ?? null,
        display_order: index + 1,
      })),
    );

  if (insertError) throw new Error(insertError.message);
}

export async function updateEmployee(params: {
  id: string;
  employeeCode?: string | null;
  fullName?: string;
  homeWorkAreaId?: string;
  active?: boolean;
  gender?: "M" | "F" | null;
  level?: 1 | 2 | 3 | null;
  temporary?: boolean;
}): Promise<void> {
  const supabase = createClient();
  const updates: Record<string, unknown> = {};

  if (params.employeeCode !== undefined) updates.employee_code = params.employeeCode;
  if (params.fullName !== undefined) updates.full_name = params.fullName;
  if (params.homeWorkAreaId !== undefined) updates.home_work_area_id = params.homeWorkAreaId;
  if (params.active !== undefined) updates.active = params.active;
  if (params.gender !== undefined) updates.gender = params.gender;
  if (params.level !== undefined) updates.level = params.level;
  if (params.temporary !== undefined) updates.temporary = params.temporary;

  const { error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", params.id);

  if (error) throw new Error(error.message);
}

export async function deleteEmployee(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function replaceEmployeeQualifiedWorkAreas(params: {
  employeeId: string;
  workAreaIds: string[];
}): Promise<void> {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("employee_qualified_work_areas")
    .delete()
    .eq("employee_id", params.employeeId);

  if (deleteError) throw new Error(deleteError.message);

  if (params.workAreaIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("employee_qualified_work_areas")
    .insert(
      params.workAreaIds.map((workAreaId) => ({
        employee_id: params.employeeId,
        work_area_id: workAreaId,
      })),
    );

  if (insertError) throw new Error(insertError.message);
}

export async function insertStation(params: {
  id: string;
  workAreaId: string;
  name: string;
  requiredHeadcount: number;
  displayOrder: number;
  modeCode?: string;
  genderRestriction?: "M" | "F";
  defaultEmployeeId?: string;
  protected?: boolean;
  group?: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("stations").insert({
    id: params.id,
    work_area_id: params.workAreaId,
    name: params.name,
    required_headcount: params.requiredHeadcount,
    display_order: params.displayOrder,
    mode_code: params.modeCode ?? null,
    gender_restriction: params.genderRestriction ?? null,
    default_employee_id: params.defaultEmployeeId ?? null,
    protected: params.protected ?? false,
    station_group: params.group ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function insertWorkAreaShift(params: {
  workAreaId: string;
  modeCode: ModeCode;
  code: string;
  label: string;
  timeRange: string;
  displayOrder: number;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("work_area_shifts")
    .insert({
      work_area_id: params.workAreaId,
      mode_code: params.modeCode,
      code: params.code,
      label: params.label,
      time_range: params.timeRange,
      display_order: params.displayOrder,
    });

  if (error) throw new Error(error.message);
}

export async function updateWorkAreaShiftRecord(params: {
  workAreaId: string;
  modeCode: ModeCode;
  code: string;
  label?: string;
  timeRange?: string;
  displayOrder?: number;
}): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (params.label !== undefined) updates.label = params.label;
  if (params.timeRange !== undefined) updates.time_range = params.timeRange;
  if (params.displayOrder !== undefined) updates.display_order = params.displayOrder;

  const supabase = createClient();
  const { error } = await supabase
    .from("work_area_shifts")
    .update(updates)
    .eq("work_area_id", params.workAreaId)
    .eq("mode_code", params.modeCode)
    .eq("code", params.code);

  if (error) throw new Error(error.message);
}

export async function deleteWorkAreaShiftRecord(params: {
  workAreaId: string;
  modeCode: ModeCode;
  code: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("work_area_shifts")
    .delete()
    .eq("work_area_id", params.workAreaId)
    .eq("mode_code", params.modeCode)
    .eq("code", params.code);

  if (error) throw new Error(error.message);
}

export async function updateStationRecord(params: {
  id: string;
  workAreaId?: string;
  name?: string;
  requiredHeadcount?: number;
  displayOrder?: number;
  modeCode?: string | null;
  genderRestriction?: "M" | "F" | null;
  defaultEmployeeId?: string | null;
  protected?: boolean;
  group?: string | null;
}): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (params.workAreaId !== undefined) updates.work_area_id = params.workAreaId;
  if (params.name !== undefined) updates.name = params.name;
  if (params.requiredHeadcount !== undefined) updates.required_headcount = params.requiredHeadcount;
  if (params.displayOrder !== undefined) updates.display_order = params.displayOrder;
  if (params.modeCode !== undefined) updates.mode_code = params.modeCode;
  if (params.genderRestriction !== undefined) updates.gender_restriction = params.genderRestriction;
  if (params.defaultEmployeeId !== undefined) updates.default_employee_id = params.defaultEmployeeId;
  if (params.protected !== undefined) updates.protected = params.protected;
  if (params.group !== undefined) updates.station_group = params.group;

  const supabase = createClient();
  const { error } = await supabase
    .from("stations")
    .update(updates)
    .eq("id", params.id);

  if (error) throw new Error(error.message);
}

export async function deleteStationRecord(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("stations")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function replaceStationOrder(stations: Station[]): Promise<void> {
  const dbStations = stations.map((station) => ({
    id: station.id,
    work_area_id: station.work_area_id,
    name: station.name,
    required_headcount: station.required_headcount,
    display_order: station.display_order,
    mode_code: station.mode_code ?? null,
    gender_restriction: station.gender_restriction ?? null,
    default_employee_id: station.defaultEmployeeId ?? null,
    protected: station.protected ?? false,
    station_group: station.group ?? null,
  }));

  if (dbStations.length === 0) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("stations")
    .upsert(dbStations, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

  if (error) throw new Error(error.message);
}

export async function writeEmployeeDailyStatus(params: {
  employeeId: string;
  statusCode: string;
}): Promise<void> {
  const supabase = createClient();
  const today = todayDateString();

  // Insert-then-update-on-conflict pattern. Avoids `.upsert(onConflict: …)`
  // because the matching unique constraint changes during the work_date
  // removal migration; insert + 23505 fallback works on both old and new
  // schemas.
  const { error: insertError } = await supabase
    .from("employee_daily_statuses")
    .insert({
      id: `status_${params.employeeId}`,
      employee_id: params.employeeId,
      work_date: today,
      status_code: params.statusCode,
      reason: null,
    });

  if (!insertError) return;

  if ((insertError as { code?: string }).code !== "23505") {
    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from("employee_daily_statuses")
    .update({ status_code: params.statusCode, work_date: today })
    .eq("employee_id", params.employeeId);

  if (updateError) throw new Error(updateError.message);
}

export async function insertStatusConfig(params: {
  code: string;
  label: string;
  colorHex?: string;
  unavailable?: boolean;
  displayOrder: number;
}): Promise<void> {
  if (params.code === STATUS_CODE_ASSIGNED) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("status_configs")
    .insert({
      code: params.code,
      label: params.label,
      color_hex: params.colorHex ?? null,
      unavailable: params.unavailable ?? false,
      display_order: params.displayOrder,
    });

  if (error) throw new Error(error.message);
}

export async function updateStatusConfigRecord(params: {
  code: string;
  label?: string;
  colorHex?: string;
  unavailable?: boolean;
  displayOrder?: number;
}): Promise<void> {
  if (params.code === STATUS_CODE_ASSIGNED) return;

  const updates: Record<string, unknown> = {};
  if (params.label !== undefined) updates.label = params.label;
  if (params.colorHex !== undefined) updates.color_hex = params.colorHex;
  if (params.unavailable !== undefined) updates.unavailable = params.unavailable;
  if (params.displayOrder !== undefined) updates.display_order = params.displayOrder;

  const supabase = createClient();
  const { error } = await supabase
    .from("status_configs")
    .update(updates)
    .eq("code", params.code);

  if (error) throw new Error(error.message);
}

export async function deleteStatusConfigRecord(code: string): Promise<void> {
  if (code === STATUS_CODE_ASSIGNED) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("status_configs")
    .delete()
    .eq("code", code);

  if (error) throw new Error(error.message);
}

export async function replaceStatusConfigOrder(configs: StatusConfig[]): Promise<void> {
  const dbConfigs = configs
    .filter((config) => config.code !== STATUS_CODE_ASSIGNED)
    .map((config, index) => ({
      code: config.code,
      label: config.label,
      color_hex: config.colorHex ?? null,
      unavailable: config.unavailable ?? false,
      display_order: index + 1,
    }));

  if (dbConfigs.length === 0) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("status_configs")
    .upsert(dbConfigs, {
      onConflict: "code",
      ignoreDuplicates: false,
    });

  if (error) throw new Error(error.message);
}

export async function writeRealStationAssignment(params: RealAssignmentWrite): Promise<void> {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("station_assignments")
    .delete()
    .eq("employee_id", params.employeeId)
    .eq("work_area_id", params.workAreaId)
    .is("station_id", null);

  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase
    .from("station_assignments")
    .insert({
      id: params.id,
      employee_id: params.employeeId,
      station_id: params.stationId,
      work_area_id: null,
      work_date: todayDateString(),
      shift_code: toDbShiftCode(params.shiftCode),
      mode_code: params.modeCode,
    });

  if (insertError) throw new Error(insertError.message);
}

export async function writeDeptOnlyAssignment(params: DeptOnlyAssignmentWrite): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("station_assignments")
    .insert({
      id: params.id,
      employee_id: params.employeeId,
      station_id: null,
      work_area_id: params.workAreaId,
      work_date: todayDateString(),
      shift_code: toDbShiftCode(params.shiftCode),
      mode_code: params.modeCode,
    });

  if (error) throw new Error(error.message);
}

export async function deleteRealStationAssignment(params: {
  employeeId: string;
  stationId: string;
  shiftCode: ShiftCode;
  modeCode: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("station_assignments")
    .delete()
    .eq("employee_id", params.employeeId)
    .eq("station_id", params.stationId)
    .eq("shift_code", toDbShiftCode(params.shiftCode))
    .eq("mode_code", params.modeCode);

  if (error) throw new Error(error.message);
}

export async function deleteAssignmentsForEmployee(params: {
  employeeId: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("station_assignments")
    .delete()
    .eq("employee_id", params.employeeId);

  if (error) throw new Error(error.message);
}

export async function deleteDeptOnlyAssignment(params: {
  employeeId: string;
  workAreaId: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("station_assignments")
    .delete()
    .eq("employee_id", params.employeeId)
    .eq("work_area_id", params.workAreaId)
    .is("station_id", null);

  if (error) throw new Error(error.message);
}

export async function deleteAssignmentsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("station_assignments")
    .delete()
    .in("id", ids);

  if (error) throw new Error(error.message);
}

export async function fetchAssignmentBoardSnapshot(): Promise<AssignmentBoardSnapshot> {
  const supabase = createClient();

  try {
    const [
      workAreasResult,
      modeViewsResult,
      shiftsResult,
      statusConfigsResult,
      employeesResult,
      qualifiedResult,
      stationsResult,
      statusesResult,
      assignmentsResult,
    ] = await Promise.all([
      supabase
        .from("work_areas")
        .select("id, name, color_hex, display_order")
        .order("display_order", { ascending: true }),
      supabase
        .from("work_area_mode_views")
        .select("work_area_id, mode_code, label, time_range, display_order")
        .order("work_area_id", { ascending: true })
        .order("display_order", { ascending: true }),
      supabase
        .from("work_area_shifts")
        .select("work_area_id, mode_code, code, label, time_range, display_order")
        .order("work_area_id", { ascending: true })
        .order("mode_code", { ascending: true })
        .order("display_order", { ascending: true }),
      supabase
        .from("status_configs")
        .select("code, label, color_hex, unavailable, display_order")
        .order("display_order", { ascending: true }),
      supabase
        .from("employees")
        .select("id, employee_code, full_name, home_work_area_id, active, gender, level, temporary")
        .order("employee_code", { ascending: true, nullsFirst: false }),
      supabase
        .from("employee_qualified_work_areas")
        .select("employee_id, work_area_id")
        .order("employee_id", { ascending: true })
        .order("work_area_id", { ascending: true }),
      supabase
        .from("stations")
        .select("id, work_area_id, name, required_headcount, display_order, mode_code, gender_restriction, default_employee_id, protected, station_group")
        .order("work_area_id", { ascending: true })
        .order("display_order", { ascending: true }),
      supabase
        .from("employee_daily_statuses")
        .select("employee_id, status_code"),
      supabase
        .from("station_assignments")
        .select("id, employee_id, station_id, work_area_id, work_date, shift_code, mode_code"),
    ]);

    const errors = [
      workAreasResult.error,
      modeViewsResult.error,
      shiftsResult.error,
      statusConfigsResult.error,
      employeesResult.error,
      qualifiedResult.error,
      stationsResult.error,
      statusesResult.error,
      assignmentsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(errors.map((error) => error?.message).join("; "));
    }

    const workAreas = buildWorkAreas(
      (workAreasResult.data ?? []) as WorkAreaRow[],
      (modeViewsResult.data ?? []) as WorkAreaModeViewRow[],
    );

    if (workAreas.length === 0) {
      throw new Error("No work areas returned from Supabase");
    }

    return {
      workAreas,
      workAreaShifts: buildWorkAreaShifts(workAreas, (shiftsResult.data ?? []) as WorkAreaShiftRow[]),
      statusConfigs: mergeStatusConfigs((statusConfigsResult.data ?? []) as StatusConfigRow[]),
      employees: buildEmployees(
        (employeesResult.data ?? []) as EmployeeRow[],
        (qualifiedResult.data ?? []) as EmployeeQualifiedWorkAreaRow[],
      ),
      stations: buildStations((stationsResult.data ?? []) as StationRow[]),
      statuses: buildStatuses((statusesResult.data ?? []) as EmployeeDailyStatusRow[]),
      assignments: buildAssignments((assignmentsResult.data ?? []) as StationAssignmentRow[]),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Assignment board fetch failed: ${message}`);
  }
}

export type SnapshotListItem = {
  id: string;
  work_date: string;
  captured_at: string;
};

export type SnapshotRecord = SnapshotListItem & {
  snapshot: AssignmentBoardSnapshot;
};

export async function snapshotExistsForDate(workDate: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assignment_board_snapshots")
    .select("id")
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function saveAssignmentBoardSnapshot(params: {
  workDate: string;
  snapshot: AssignmentBoardSnapshot;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("assignment_board_snapshots")
    .insert({
      work_date: params.workDate,
      snapshot: params.snapshot,
    });
  if (error) {
    // 23505 = unique_violation — another writer beat us. Ignore.
    if ((error as { code?: string }).code === "23505") return;
    throw new Error(error.message);
  }
}

export async function listAssignmentBoardSnapshots(): Promise<SnapshotRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assignment_board_snapshots")
    .select("id, work_date, captured_at, snapshot")
    .order("work_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SnapshotRecord[];
}

export async function loadAssignmentBoardSnapshot(workDate: string): Promise<SnapshotRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assignment_board_snapshots")
    .select("id, work_date, captured_at, snapshot")
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as SnapshotRecord;
}
