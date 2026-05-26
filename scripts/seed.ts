import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Load .env.local before any code reads process.env.
loadEnv({ path: resolve(__dirname, "..", ".env.local") });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  mockAssignments,
  mockEmployeeStatuses,
  mockEmployees,
  mockShifts,
  mockStations,
  mockWorkAreas,
} from "../src/features/assignment-board/mock-data";
import { DEFAULT_STATUS_CONFIGS } from "../src/features/assignment-board/components/status-select";

type SeedClient = SupabaseClient;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function createSeedClient(): SeedClient {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function runStep(name: string, fn: () => Promise<void>) {
  console.log(`\n[seed] ${name}...`);
  const startedAt = Date.now();
  try {
    await fn();
    console.log(`[seed] ${name} complete (${Date.now() - startedAt}ms)`);
  } catch (error) {
    console.error(`[seed] ${name} failed`);
    throw error;
  }
}

async function deleteAll(
  supabase: SeedClient,
  table: string,
  nonNullColumn: string,
) {
  const { error } = await supabase
    .from(table)
    .delete()
    .not(nonNullColumn, "is", null);

  if (error) throw new Error(`cleanup ${table}: ${error.message}`);
  console.log(`[seed] cleaned ${table}`);
}

async function upsertRows(
  supabase: SeedClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
) {
  if (rows.length === 0) {
    console.log(`[seed] skipped ${table} (0 rows)`);
    return;
  }

  const { error } = await supabase
    .from(table)
    .upsert(rows, {
      onConflict,
      ignoreDuplicates: false,
    });

  if (error) throw new Error(`upsert ${table}: ${error.message}`);
  console.log(`[seed] upserted ${rows.length} rows into ${table}`);
}

async function countRows(
  supabase: SeedClient,
  table: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

async function verifyCount(
  supabase: SeedClient,
  table: string,
  expected: number,
) {
  const actual = await countRows(supabase, table);
  const status = actual === expected ? "OK" : "MISMATCH";
  console.log(`[seed] verify ${table}: expected=${expected} actual=${actual} ${status}`);
  if (actual !== expected) {
    throw new Error(`verification failed for ${table}: expected ${expected}, got ${actual}`);
  }
}

async function cleanupSeedSlice(supabase: SeedClient) {
  await deleteAll(supabase, "station_assignments", "id");
  await deleteAll(supabase, "employee_daily_statuses", "id");
  await deleteAll(supabase, "stations", "id");
  await deleteAll(supabase, "employee_qualified_work_areas", "employee_id");
  await deleteAll(supabase, "employees", "id");
  await deleteAll(supabase, "work_area_shifts", "work_area_id");
  await deleteAll(supabase, "work_area_mode_views", "work_area_id");
  await deleteAll(supabase, "status_configs", "code");
  await deleteAll(supabase, "work_areas", "id");
}

function buildWorkAreaRows() {
  return mockWorkAreas.map((wa) => ({
    id: wa.id,
    name: wa.name,
    color_hex: wa.color_hex ?? null,
    display_order: wa.display_order,
  }));
}

function buildModeViewRows() {
  return mockWorkAreas.flatMap((wa) =>
    (wa.mode_views ?? []).map((mv, index) => ({
      work_area_id: wa.id,
      mode_code: mv.mode_code,
      label: mv.label,
      time_range: mv.time_range ?? null,
      display_order: index + 1,
    })),
  );
}

function buildShiftRows() {
  return mockWorkAreas.flatMap((wa) => {
    const modeCodes = wa.mode_views?.length
      ? wa.mode_views.map((mv) => mv.mode_code)
      : ["normal"];
    return modeCodes.flatMap((modeCode) =>
      mockShifts.map((shift, index) => ({
        work_area_id: wa.id,
        mode_code: modeCode,
        code: shift.code,
        label: shift.label,
        time_range: shift.time_range,
        display_order: index + 1,
      })),
    );
  });
}

function buildStatusConfigRows() {
  return DEFAULT_STATUS_CONFIGS
    .map((cfg, index) => ({
      code: cfg.code,
      label: cfg.label,
      color_hex: cfg.colorHex ?? null,
      unavailable: cfg.unavailable ?? false,
      display_order: index + 1,
    }));
}

function buildEmployeeRows() {
  return mockEmployees.map((emp) => ({
    id: emp.id,
    employee_code: emp.employee_code,
    full_name: emp.full_name,
    home_work_area_id: emp.homeDepartmentId,
    active: emp.active,
    gender: emp.gender ?? null,
    level: emp.level ?? null,
    temporary: emp.temporary ?? false,
  }));
}

function buildEmployeeQualifiedWorkAreaRows() {
  return mockEmployees.flatMap((emp) =>
    emp.qualifiedDepartmentIds.map((workAreaId) => ({
      employee_id: emp.id,
      work_area_id: workAreaId,
    })),
  );
}

function buildStationRows() {
  return mockStations.map((station) => ({
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
}

function buildStatusRows() {
  return mockEmployeeStatuses.map((status) => ({
    id: status.id,
    employee_id: status.employee_id,
    status_code: status.status,
    reason: status.reason,
  }));
}

function buildAssignmentRows() {
  return mockAssignments.map((assignment) => ({
    id: assignment.id,
    employee_id: assignment.employee_id,
    station_id: assignment.station_id,
    work_area_id: assignment.work_area_id,
    shift_code: assignment.shift_code ?? null,
    mode_code: assignment.mode_code,
  }));
}

async function seedWorkAreas(supabase: SeedClient) {
  await upsertRows(supabase, "work_areas", buildWorkAreaRows(), "id");
}

async function seedModeViews(supabase: SeedClient) {
  await upsertRows(supabase, "work_area_mode_views", buildModeViewRows(), "work_area_id,mode_code");
}

async function seedShifts(supabase: SeedClient) {
  await upsertRows(supabase, "work_area_shifts", buildShiftRows(), "work_area_id,mode_code,code");
}

async function seedStatusConfigs(supabase: SeedClient) {
  await upsertRows(supabase, "status_configs", buildStatusConfigRows(), "code");
}

async function seedEmployees(supabase: SeedClient) {
  await upsertRows(supabase, "employees", buildEmployeeRows(), "id");
}

async function seedEmployeeQualifiedWorkAreas(supabase: SeedClient) {
  await upsertRows(
    supabase,
    "employee_qualified_work_areas",
    buildEmployeeQualifiedWorkAreaRows(),
    "employee_id,work_area_id",
  );
}

async function seedStations(supabase: SeedClient) {
  await upsertRows(supabase, "stations", buildStationRows(), "id");
}

async function seedEmployeeDailyStatuses(supabase: SeedClient) {
  await upsertRows(supabase, "employee_daily_statuses", buildStatusRows(), "id");
}

async function seedStationAssignments(supabase: SeedClient) {
  const rows = buildAssignmentRows();
  const deptOnlyCount = rows.filter((row) => row.station_id === null && row.work_area_id !== null).length;
  console.log(`[seed] station_assignments include ${deptOnlyCount} dept-only rows`);
  await upsertRows(supabase, "station_assignments", rows, "id");
}

async function verifyCounts(supabase: SeedClient) {
  const expectedModeViews = mockWorkAreas.reduce((sum, wa) => sum + (wa.mode_views?.length ?? 0), 0);
  const expectedShifts = mockWorkAreas.reduce(
    (sum, wa) => sum + (wa.mode_views?.length ?? 1) * mockShifts.length,
    0,
  );
  const expectedStatusConfigs = DEFAULT_STATUS_CONFIGS.length;
  const expectedQualifiedRows = mockEmployees.reduce((sum, emp) => sum + emp.qualifiedDepartmentIds.length, 0);

  await verifyCount(supabase, "work_areas", mockWorkAreas.length);
  await verifyCount(supabase, "work_area_mode_views", expectedModeViews);
  await verifyCount(supabase, "work_area_shifts", expectedShifts);
  await verifyCount(supabase, "status_configs", expectedStatusConfigs);
  await verifyCount(supabase, "employees", mockEmployees.length);
  await verifyCount(supabase, "employee_qualified_work_areas", expectedQualifiedRows);
  await verifyCount(supabase, "stations", mockStations.length);
  await verifyCount(supabase, "employee_daily_statuses", mockEmployeeStatuses.length);
  await verifyCount(supabase, "station_assignments", mockAssignments.length);
}

async function main() {
  const supabase = createSeedClient();

  await runStep("validate source data", async () => {
    const uniqueEmployeeStatusKeys = new Set(
      mockEmployeeStatuses.map((status) => status.employee_id),
    );

    if (uniqueEmployeeStatusKeys.size !== mockEmployeeStatuses.length) {
      throw new Error("mockEmployeeStatuses contains duplicate employee rows");
    }

    const workAreaIds = new Set(mockWorkAreas.map((wa) => wa.id));
    const stationIds = new Set(mockStations.map((station) => station.id));

    for (const employee of mockEmployees) {
      if (!workAreaIds.has(employee.homeDepartmentId ?? "")) {
        throw new Error(`employee ${employee.id} has invalid homeDepartmentId ${employee.homeDepartmentId}`);
      }

      for (const qualifiedId of employee.qualifiedDepartmentIds) {
        if (!workAreaIds.has(qualifiedId)) {
          throw new Error(`employee ${employee.id} has invalid qualifiedDepartmentId ${qualifiedId}`);
        }
      }
    }

    for (const assignment of mockAssignments) {
      const isRealAssignment = assignment.station_id !== null && assignment.work_area_id === null;
      const isDeptOnlyAssignment = assignment.station_id === null && assignment.work_area_id !== null;

      if (!isRealAssignment && !isDeptOnlyAssignment) {
        throw new Error(`assignment ${assignment.id} violates station/work area XOR contract`);
      }

      if (assignment.station_id !== null && !stationIds.has(assignment.station_id)) {
        throw new Error(`assignment ${assignment.id} references missing station ${assignment.station_id}`);
      }

      if (assignment.work_area_id !== null && !workAreaIds.has(assignment.work_area_id)) {
        throw new Error(`assignment ${assignment.id} references missing work area ${assignment.work_area_id}`);
      }
    }

    const statusCodes = new Set(
      DEFAULT_STATUS_CONFIGS
            .map((cfg) => cfg.code),
    );

    for (const status of mockEmployeeStatuses) {
      if (!statusCodes.has(status.status)) {
        throw new Error(`status ${status.id} references missing status code ${status.status}`);
      }
    }
  });

  await runStep("cleanup existing assignment-board seed data", async () => {
    await cleanupSeedSlice(supabase);
  });

  await runStep("seed work_areas", async () => {
    await seedWorkAreas(supabase);
  });

  await runStep("seed work_area_mode_views", async () => {
    await seedModeViews(supabase);
  });

  await runStep("seed work_area_shifts", async () => {
    await seedShifts(supabase);
  });

  await runStep("seed status_configs", async () => {
    await seedStatusConfigs(supabase);
  });

  await runStep("seed employees", async () => {
    await seedEmployees(supabase);
  });

  await runStep("seed employee_qualified_work_areas", async () => {
    await seedEmployeeQualifiedWorkAreas(supabase);
  });

  await runStep("seed stations", async () => {
    await seedStations(supabase);
  });

  await runStep("seed employee_daily_statuses", async () => {
    await seedEmployeeDailyStatuses(supabase);
  });

  await runStep("seed station_assignments", async () => {
    await seedStationAssignments(supabase);
  });

  await runStep("verify final row counts", async () => {
    await verifyCounts(supabase);
  });

  console.log("\n[seed] complete");
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[seed] failed: ${message}`);
  process.exit(1);
});
