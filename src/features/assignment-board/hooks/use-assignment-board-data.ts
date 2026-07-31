"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MODE_CODE } from "../types";
import type { Employee, EmployeeStatus, ModeCode, ShiftCode, ShiftInfo, Station, StationAssignment, WorkArea, WorkAreaModeView, WorkAreaShiftMap } from "../types";
import { getUnavailableStatusCodes, STATUS_CODE_AVAILABLE } from "../components/status-select";
import { getAssignmentWorkAreaId, getEmployeeActiveDepartmentIds, hasNullStationAssignment, todayDateString, DEPT_ONLY_SHIFT_CODE } from "../utils";
import {
  bulkUpsertEmployees,
  deleteEmployee,
  deleteAssignmentsByIds,
  deleteAssignmentsForEmployee,
  deleteDeptOnlyAssignment,
  deleteRealStationAssignment,
  deleteStationRecord,
  deleteWorkAreaRecord,
  deleteWorkAreaShiftRecord,
  fetchAssignmentBoardSnapshot,
  insertEmployee,
  insertStation,
  insertWorkArea,
  insertWorkAreaShift,
  refetchWorkAreasSnapshot,
  refetchAssignmentSnapshot,
  refetchEmployeesSnapshot,
  refetchStationsSnapshot,
  refetchStatusSnapshot,
  refetchWorkAreaShiftsSnapshot,
  replaceWorkAreaModeViews,
  replaceEmployeeQualifiedWorkAreas,
  replaceStationOrder,
  updateWorkAreaRecord,
  updateEmployee as updateEmployeeRecord,
  updateStationRecord,
  updateWorkAreaShiftRecord,
  writeEmployeeDailyStatus,
  writeDeptOnlyAssignment,
  writeRealStationAssignment,
} from "../supabase";
import { useStatusConfigs } from "./use-status-configs";
import { useEmployeeStatusRealtime } from "./use-status-realtime";
import { SUPABASE_ENABLED } from "@/lib/config";

export function useAssignmentBoardData() {
  const {
    statusConfigs,
    setStatusConfigs,
    handleUpdateConfig: handleUpdateStatusConfig,
    handleDeleteConfig: handleDeleteStatusConfig,
    handleAddConfig: handleAddStatusConfig,
    handleReorderConfig: handleReorderStatusConfig,
  } = useStatusConfigs([]);

  const [announcement, setAnnouncement] = useState("Please clean your work area and report any equipment issues.");
  const [isHydrating, setIsHydrating] = useState<boolean>(SUPABASE_ENABLED);
  const [loadError, setLoadError] = useState<string | null>(
    SUPABASE_ENABLED ? null : "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  const [saveError, setSaveError] = useState<{ message: string; context: string } | null>(null);

  const reportSaveError = (context: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[assignment-board] ${context}:`, message);
    setSaveError({ message, context });
  };

  const clearSaveError = () => setSaveError(null);

  useEffect(() => {
    if (!saveError) return;
    const timeoutId = window.setTimeout(() => setSaveError(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [saveError]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statuses, setStatuses] = useState<Record<string, EmployeeStatus>>({});
  const [assignments, setAssignmentsState] = useState<StationAssignment[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
  const [workAreaShifts, setWorkAreaShifts] = useState<WorkAreaShiftMap>({});
  const [selectedWorkAreaId, setSelectedWorkAreaId] = useState<string>("");
  const persistedEmployeeIdsRef = useRef<Set<string>>(new Set());
  const pendingEmployeeInsertionsRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setIsHydrating(false);
      return;
    }

    let isCancelled = false;

    async function loadFromSupabase() {
      try {
        const snapshot = await fetchAssignmentBoardSnapshot();
        if (isCancelled) return;

        setEmployees(snapshot.employees);
        setStatuses(snapshot.statuses);
        setAssignmentsState(snapshot.assignments);
        setStations(snapshot.stations);
        setWorkAreas(snapshot.workAreas);
        setWorkAreaShifts(snapshot.workAreaShifts);
        setStatusConfigs(snapshot.statusConfigs);
        persistedEmployeeIdsRef.current = new Set(snapshot.employees.map((employee) => employee.id));
        setSelectedWorkAreaId((prev) =>
          snapshot.workAreas.some((wa) => wa.id === prev)
            ? prev
            : (snapshot.workAreas[0]?.id ?? ""),
        );
        setLoadError(null);
        setIsHydrating(false);
      } catch (error) {
        if (isCancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        console.error("[assignment-board] Initial load failed:", message);
        setLoadError(message);
        setIsHydrating(false);
      }
    }

    void loadFromSupabase();

    return () => {
      isCancelled = true;
    };
  }, [setStatusConfigs]);

  const refetchSnapshot = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    const snapshot = await fetchAssignmentBoardSnapshot();
    setEmployees(snapshot.employees);
    setStatuses(snapshot.statuses);
    setAssignmentsState(snapshot.assignments);
    setStations(snapshot.stations);
    setWorkAreas(snapshot.workAreas);
    setWorkAreaShifts(snapshot.workAreaShifts);
    setStatusConfigs(snapshot.statusConfigs);
    persistedEmployeeIdsRef.current = new Set(snapshot.employees.map((employee) => employee.id));
  }, [setStatusConfigs]);

  const setAssignments = (updater: StationAssignment[] | ((prev: StationAssignment[]) => StationAssignment[])) => {
    setAssignmentsState((prev) => typeof updater === "function" ? updater(prev) : updater);
  };

  const restoreAssignmentsFromDb = async (context: string) => {
    try {
      const dbAssignments = await refetchAssignmentSnapshot();
      setAssignmentsState(dbAssignments);
    } catch (error) {
      console.error(`[assignment-board] Failed to refetch assignments after ${context}:`, error);
    }
  };

  const restoreStatusesFromDb = async (context: string) => {
    try {
      const dbStatuses = await refetchStatusSnapshot();
      setStatuses(dbStatuses);
    } catch (error) {
      console.error(`[assignment-board] Failed to refetch statuses after ${context}:`, error);
    }
  };

  const restoreEmployeesFromDb = async (context: string) => {
    try {
      const dbEmployees = await refetchEmployeesSnapshot();
      setEmployees(dbEmployees);
      persistedEmployeeIdsRef.current = new Set(dbEmployees.map((employee) => employee.id));
    } catch (error) {
      console.error(`[assignment-board] Failed to refetch employees after ${context}:`, error);
    }
  };

  const restoreStationsFromDb = async (context: string) => {
    try {
      const dbStations = await refetchStationsSnapshot(stations);
      setStations(dbStations);
    } catch (error) {
      console.error(`[assignment-board] Failed to refetch stations after ${context}:`, error);
    }
  };

  const restoreShiftsFromDb = async (context: string) => {
    try {
      const dbShifts = await refetchWorkAreaShiftsSnapshot(workAreas);
      setWorkAreaShifts(dbShifts);
    } catch (error) {
      console.error(`[assignment-board] Failed to refetch shifts after ${context}:`, error);
    }
  };

  const restoreWorkAreasFromDb = async (context: string) => {
    try {
      const dbWorkAreas = await refetchWorkAreasSnapshot();
      setWorkAreas(dbWorkAreas);
      setSelectedWorkAreaId((prev) =>
        dbWorkAreas.some((wa) => wa.id === prev)
          ? prev
          : (dbWorkAreas[0]?.id ?? prev),
      );
    } catch (error) {
      console.error(`[assignment-board] Failed to refetch work areas after ${context}:`, error);
    }
  };

  const persistStatusForEmployee = async (employeeId: string, statusCode: EmployeeStatus, context: string) => {
    const pendingInsert = pendingEmployeeInsertionsRef.current.get(employeeId);
    if (pendingInsert) {
      try {
        await pendingInsert;
      } catch {
        console.warn(`[assignment-board] Skipping status write for non-persisted employee ${employeeId} after ${context}`);
        return;
      }
    }

    if (!persistedEmployeeIdsRef.current.has(employeeId)) {
      console.warn(`[assignment-board] Skipping status write for non-persisted employee ${employeeId} after ${context}`);
      return;
    }

    await writeEmployeeDailyStatus({
      employeeId,
      statusCode,
    });
  };

  type RestoreKey = "assignments" | "statuses" | "employees" | "stations" | "shifts" | "workAreas";

  const employeeWriteChainsRef = useRef<Map<string, Promise<void>>>(new Map());
  const pendingWriteCountRef = useRef<number>(0);
  const pendingRestoresRef = useRef<Map<RestoreKey, string>>(new Map());

  const runRestore = (key: RestoreKey, context: string): Promise<void> => {
    switch (key) {
      case "assignments": return restoreAssignmentsFromDb(context);
      case "statuses": return restoreStatusesFromDb(context);
      case "employees": return restoreEmployeesFromDb(context);
      case "stations": return restoreStationsFromDb(context);
      case "shifts": return restoreShiftsFromDb(context);
      case "workAreas": return restoreWorkAreasFromDb(context);
    }
  };

  const drainPendingRestores = () => {
    if (pendingWriteCountRef.current !== 0) return;
    if (pendingRestoresRef.current.size === 0) return;
    const entries = Array.from(pendingRestoresRef.current.entries());
    pendingRestoresRef.current.clear();
    for (const [key, context] of entries) {
      void runRestore(key, context);
    }
  };

  const gatedRestore = (key: RestoreKey, context: string) => {
    if (pendingWriteCountRef.current === 0) {
      void runRestore(key, context);
      return;
    }
    pendingRestoresRef.current.set(key, context);
  };

  // Statuses-only refetch for external triggers (realtime events, tab focus).
  // Routed through the write gate so an event echoing our own in-flight write
  // cannot clobber optimistic local state.
  const refetchStatuses = () => {
    if (!SUPABASE_ENABLED) return;
    gatedRestore("statuses", "external refresh");
  };

  const refetchWorkAreas = () => {
    if (!SUPABASE_ENABLED) return;
    gatedRestore("workAreas", "external refresh");
  };

  useEmployeeStatusRealtime(refetchStatuses, refetchWorkAreas);

  const enqueueEmployeeWrite = (employeeId: string, task: () => Promise<void>): Promise<void> => {
    const previous = employeeWriteChainsRef.current.get(employeeId) ?? Promise.resolve();
    pendingWriteCountRef.current += 1;
    const next: Promise<void> = previous
      .catch(() => {})
      .then(() => task())
      .catch(() => {})
      .finally(() => {
        pendingWriteCountRef.current -= 1;
        if (employeeWriteChainsRef.current.get(employeeId) === next) {
          employeeWriteChainsRef.current.delete(employeeId);
        }
        if (pendingWriteCountRef.current === 0) {
          drainPendingRestores();
        }
      });
    employeeWriteChainsRef.current.set(employeeId, next);
    return next;
  };

  const unavailableCodes = getUnavailableStatusCodes(statusConfigs);
  const disabledIds = new Set(
    Object.entries(statuses)
      .filter(([, s]) => unavailableCodes.has(s))
      .map(([id]) => id),
  );

  // Shift template used when seeding a newly created work area. Pull any mode's
  // shift list from the first existing work area; all modes carry the same
  // template entries, so any one of them works as the seed.
  const firstWaShifts = workAreaShifts[workAreas[0]?.id];
  const firstWaTemplate = firstWaShifts ? Object.values(firstWaShifts)[0] : undefined;
  const defaultShiftTemplate: ShiftInfo[] = firstWaTemplate ?? [];

  const handleAdd = (emp: Employee) => {
    const qualificationIds = Array.from(
      new Set([...(emp.qualifiedDepartmentIds ?? []), emp.homeDepartmentId].filter((id): id is string => !!id)),
    );
    const normalizedEmployee: Employee = {
      ...emp,
      qualifiedDepartmentIds: qualificationIds,
    };

    setEmployees((prev) => [...prev, normalizedEmployee]);

    const persistEmployeePromise = insertEmployee({
      id: normalizedEmployee.id,
      employeeCode: normalizedEmployee.employee_code,
      fullName: normalizedEmployee.full_name,
      homeWorkAreaId: normalizedEmployee.homeDepartmentId!,
      active: normalizedEmployee.active,
      gender: normalizedEmployee.gender,
      level: normalizedEmployee.level,
      temporary: normalizedEmployee.temporary,
    })
      .then(() =>
        replaceEmployeeQualifiedWorkAreas({
          employeeId: normalizedEmployee.id,
          workAreaIds: qualificationIds,
        }),
      )
      .then(() => {
        persistedEmployeeIdsRef.current.add(normalizedEmployee.id);
      })
      .catch((error) => {
        reportSaveError("Failed to persist new employee", error);
        persistedEmployeeIdsRef.current.delete(normalizedEmployee.id);
        setEmployees((prev) => prev.filter((employee) => employee.id !== normalizedEmployee.id));
        setStatuses((prev) => {
          const next = { ...prev };
          delete next[normalizedEmployee.id];
          return next;
        });
        void restoreEmployeesFromDb("handleAdd");
        throw error;
      })
      .finally(() => {
        pendingEmployeeInsertionsRef.current.delete(normalizedEmployee.id);
      });

    pendingEmployeeInsertionsRef.current.set(normalizedEmployee.id, persistEmployeePromise);
    void persistEmployeePromise;
  };

  const handleBulkImport = async (rows: Array<{
    id: string;
    employeeCode: string;
    fullName: string;
    homeWorkAreaId: string;
    active: boolean;
    gender: "M" | "F" | null;
    level: 1 | 2 | 3 | null;
    temporary: boolean;
    isUpdate: boolean;
  }>): Promise<void> => {
    if (rows.length === 0) return;

    const createdIds = rows.filter((r) => !r.isUpdate).map((r) => r.id);

    setEmployees((existing) => {
      const byId = new Map(existing.map((e) => [e.id, e] as const));
      for (const row of rows) {
        const current = byId.get(row.id);
        const qualifiedDepartmentIds = Array.from(
          new Set([
            ...(current?.qualifiedDepartmentIds ?? []),
            row.homeWorkAreaId,
          ]),
        );
        const nextEmp: Employee = {
          id: row.id,
          employee_code: row.employeeCode,
          full_name: row.fullName,
          homeDepartmentId: row.homeWorkAreaId,
          qualifiedDepartmentIds,
          active: row.active,
          ...(row.gender ? { gender: row.gender } : {}),
          ...(row.level ? { level: row.level } : {}),
          ...(row.temporary ? { temporary: true } : {}),
        };
        byId.set(row.id, nextEmp);
      }
      return Array.from(byId.values());
    });

    try {
      await bulkUpsertEmployees(
        rows.map((row) => ({
          id: row.id,
          employeeCode: row.employeeCode,
          fullName: row.fullName,
          homeWorkAreaId: row.homeWorkAreaId,
          active: row.active,
          gender: row.gender,
          level: row.level,
          temporary: row.temporary,
        })),
      );

      for (const row of rows) {
        if (!row.isUpdate) {
          await replaceEmployeeQualifiedWorkAreas({
            employeeId: row.id,
            workAreaIds: [row.homeWorkAreaId],
          });
          persistedEmployeeIdsRef.current.add(row.id);
        }
      }
    } catch (error) {
      reportSaveError("Failed to import employees", error);
      for (const id of createdIds) persistedEmployeeIdsRef.current.delete(id);
      void restoreEmployeesFromDb("handleBulkImport");
      throw error;
    }
  };

  const handleRemoveEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    persistedEmployeeIdsRef.current.delete(id);
    pendingEmployeeInsertionsRef.current.delete(id);

    void deleteEmployee(id).catch((error) => {
      reportSaveError("Failed to delete employee", error);
      void restoreEmployeesFromDb("handleRemoveEmployee");
    });
  };

  const handleUpdate = (id: string, updates: Partial<Omit<Employee, "qualifiedDepartmentIds">>) => {
    const nextHomeWorkAreaId =
      "homeDepartmentId" in updates ? (updates.homeDepartmentId ?? undefined) : undefined;

    setEmployees((prev) => prev.map((e) => {
      if (e.id !== id) return e;

      const nextEmployee = { ...e, ...updates };
      if (nextHomeWorkAreaId && !nextEmployee.qualifiedDepartmentIds.includes(nextHomeWorkAreaId)) {
        nextEmployee.qualifiedDepartmentIds = [...nextEmployee.qualifiedDepartmentIds, nextHomeWorkAreaId];
      }
      return nextEmployee;
    }));

    void updateEmployeeRecord({
      id,
      ...("employee_code" in updates ? { employeeCode: updates.employee_code ?? null } : {}),
      ...("full_name" in updates ? { fullName: updates.full_name } : {}),
      ...(nextHomeWorkAreaId ? { homeWorkAreaId: nextHomeWorkAreaId } : {}),
      ...("active" in updates ? { active: updates.active } : {}),
      ...("gender" in updates ? { gender: updates.gender ?? null } : {}),
      ...("level" in updates ? { level: updates.level ?? null } : {}),
      ...("temporary" in updates ? { temporary: updates.temporary ?? false } : {}),
    }).catch((error) => {
      reportSaveError("Failed to update employee", error);
      void restoreEmployeesFromDb("handleUpdate");
    });
  };

  const handleSetQualifiedWorkAreas = (employeeId: string, workAreaIds: string[]) => {
    let nextQualificationIds: string[] = workAreaIds;

    setEmployees((prev) => prev.map((e) => {
      if (e.id !== employeeId) return e;
      nextQualificationIds = Array.from(
        new Set([...workAreaIds, e.homeDepartmentId].filter((id): id is string => !!id)),
      );
      return { ...e, qualifiedDepartmentIds: nextQualificationIds };
    }));

    void enqueueEmployeeWrite(employeeId, async () => {
      try {
        await replaceEmployeeQualifiedWorkAreas({
          employeeId,
          workAreaIds: nextQualificationIds,
        });
      } catch (error) {
        reportSaveError("Failed to replace employee qualifications", error);
        gatedRestore("employees", "handleSetQualifiedWorkAreas");
      }
    });
  };
  const handleStatusChange = (id: string, status: EmployeeStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    const isUnavailable = getUnavailableStatusCodes(statusConfigs).has(status);

    if (isUnavailable) {
      setAssignments((prev) => prev.filter((a) => a.employee_id !== id));
    }

    void enqueueEmployeeWrite(id, async () => {
      try {
        await persistStatusForEmployee(id, status, "handleStatusChange");
      } catch (error) {
        reportSaveError("Failed to persist employee daily status", error);
        gatedRestore("statuses", "handleStatusChange");
      }
    });

    if (isUnavailable) {
      void enqueueEmployeeWrite(id, async () => {
        try {
          await deleteAssignmentsForEmployee({ employeeId: id });
        } catch (error) {
          reportSaveError("Failed to clear assignments for unavailable employee", error);
          gatedRestore("assignments", "handleStatusChange");
        }
      });
    }
  };

  const handleAssign = (employeeId: string, stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) => {
    if (disabledIds.has(employeeId)) return;
    if (assignments.some((a) => a.employee_id === employeeId && a.station_id === stationId && a.shift_code === shiftCode && a.mode_code === modeCode)) return;
    const workAreaId = stations.find((s) => s.id === stationId)?.work_area_id;
    if (!workAreaId) return;
    const newAssignment: StationAssignment = {
      id: `a_${crypto.randomUUID()}`,
      employee_id: employeeId,
      station_id: stationId,
      work_area_id: null,
      work_date: todayDateString(),
      shift_code: shiftCode,
      mode_code: modeCode,
    };

    setAssignments((prev) => [
      ...prev.filter((a) => !(a.employee_id === employeeId && a.station_id === null && a.work_area_id === workAreaId)),
      newAssignment,
    ]);

    void enqueueEmployeeWrite(employeeId, async () => {
      try {
        await writeRealStationAssignment({
          id: newAssignment.id,
          employeeId,
          stationId,
          workAreaId,
          shiftCode,
          modeCode,
        });
      } catch (error) {
        reportSaveError("Failed to persist real station assignment", error);
        gatedRestore("assignments", "handleAssign");
      }
    });
  };

  const handleUnassign = (employeeId: string, stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) => {
    setAssignments((prev) => prev.filter(
      (a) => !(a.employee_id === employeeId && a.station_id === stationId && a.shift_code === shiftCode && a.mode_code === modeCode),
    ));

    void enqueueEmployeeWrite(employeeId, async () => {
      try {
        await deleteRealStationAssignment({
          employeeId,
          stationId,
          shiftCode,
          modeCode,
        });
      } catch (error) {
        reportSaveError("Failed to delete real station assignment", error);
        gatedRestore("assignments", "handleUnassign");
      }
    });
  };

  const handleUnassignAll = (employeeId: string, resetStatus = true) => {
    setAssignments((prev) => prev.filter((a) => a.employee_id !== employeeId));
    if (resetStatus) setStatuses((prev) => ({ ...prev, [employeeId]: STATUS_CODE_AVAILABLE }));

    void enqueueEmployeeWrite(employeeId, async () => {
      try {
        await deleteAssignmentsForEmployee({ employeeId });
      } catch (error) {
        reportSaveError("Failed to delete all assignments for employee", error);
        gatedRestore("assignments", "handleUnassignAll");
      }
    });

    if (resetStatus) {
      void enqueueEmployeeWrite(employeeId, async () => {
        try {
          await persistStatusForEmployee(employeeId, STATUS_CODE_AVAILABLE, "handleUnassignAll");
        } catch (error) {
          reportSaveError("Failed to persist available status", error);
          gatedRestore("statuses", "handleUnassignAll");
        }
      });
    }
  };

  const handleUnassignFromStation = (employeeId: string, stationId: string) => {
    setAssignments((prev) => prev.filter((a) => !(a.employee_id === employeeId && a.station_id === stationId)));
  };

  const handleClearWorkArea = (workAreaId: string) => {
    const idsToDelete = assignments
      .filter((a) => getAssignmentWorkAreaId(a, stations) === workAreaId)
      .map((a) => a.id);

    setAssignments((prev) => prev.filter((a) => getAssignmentWorkAreaId(a, stations) !== workAreaId));

    void deleteAssignmentsByIds(idsToDelete).catch((error) => {
      reportSaveError("Failed to clear work area assignments", error);
      void restoreAssignmentsFromDb("handleClearWorkArea");
    });
  };

  const handleAssignToDepartment = (
    employeeId: string,
    workAreaId: string,
    shiftCode?: ShiftCode,
    modeCode?: ModeCode,
  ) => {
    if (disabledIds.has(employeeId)) return;
    const wa = workAreas.find((w) => w.id === workAreaId);
    const resolvedMode: ModeCode = modeCode ?? (wa?.mode_views?.[0]?.mode_code as ModeCode) ?? DEFAULT_MODE_CODE;
    const resolvedShift: ShiftCode = shiftCode ?? workAreaShifts[workAreaId]?.[resolvedMode]?.[0]?.code ?? DEPT_ONLY_SHIFT_CODE;
    if (hasNullStationAssignment(employeeId, workAreaId, assignments)) return;
    const newAssignment: StationAssignment = {
      id: `a_${crypto.randomUUID()}`,
      employee_id: employeeId,
      station_id: null,
      work_area_id: workAreaId,
      work_date: todayDateString(),
      shift_code: resolvedShift,
      mode_code: resolvedMode,
    };

    setAssignments((prev) => [...prev, newAssignment]);

    void enqueueEmployeeWrite(employeeId, async () => {
      try {
        await writeDeptOnlyAssignment({
          id: newAssignment.id,
          employeeId,
          workAreaId,
          shiftCode: resolvedShift,
          modeCode: resolvedMode,
        });
      } catch (error) {
        reportSaveError("Failed to persist dept-only assignment", error);
        gatedRestore("assignments", "handleAssignToDepartment");
      }
    });
  };

  const handleUnassignFromDepartment = (employeeId: string, workAreaId: string) => {
    setAssignments((prev) =>
      prev.filter((a) => !(a.employee_id === employeeId && a.station_id === null && a.work_area_id === workAreaId)),
    );

    void enqueueEmployeeWrite(employeeId, async () => {
      try {
        await deleteDeptOnlyAssignment({ employeeId, workAreaId });
      } catch (error) {
        reportSaveError("Failed to delete dept-only assignment", error);
        gatedRestore("assignments", "handleUnassignFromDepartment");
      }
    });
  };

  const handleQuickAssign = (employeeId: string, stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    const wa = workAreas.find((w) => w.id === station?.work_area_id);
    const resolvedMode: ModeCode =
      (station?.mode_code as ModeCode | undefined) ??
      (wa?.mode_views?.[0]?.mode_code as ModeCode) ??
      DEFAULT_MODE_CODE;
    const defaultShiftCode = workAreaShifts[wa?.id ?? ""]?.[resolvedMode]?.[0]?.code;
    if (!defaultShiftCode) return;
    handleAssign(employeeId, stationId, defaultShiftCode, resolvedMode);
  };

  const handleDeleteShift = (workAreaId: string, modeCode: ModeCode, code: ShiftCode) => {
    const stationIds = new Set(stations.filter((s) => s.work_area_id === workAreaId).map((s) => s.id));
    const isOrphanedAssignment = (a: StationAssignment) =>
      a.station_id !== null &&
      stationIds.has(a.station_id) &&
      a.shift_code === code &&
      a.mode_code === modeCode;
    const assignmentIdsToDelete = assignments.filter(isOrphanedAssignment).map((a) => a.id);

    setWorkAreaShifts((prev) => ({
      ...prev,
      [workAreaId]: {
        ...(prev[workAreaId] ?? ({} as Record<ModeCode, ShiftInfo[]>)),
        [modeCode]: (prev[workAreaId]?.[modeCode] ?? []).filter((s) => s.code !== code),
      },
    }));
    setAssignments((prev) => prev.filter((a) => !isOrphanedAssignment(a)));

    void (async () => {
      try {
        await deleteAssignmentsByIds(assignmentIdsToDelete);
        await deleteWorkAreaShiftRecord({ workAreaId, modeCode, code });
      } catch (error) {
        reportSaveError("Failed to delete shift", error);
        void restoreShiftsFromDb("handleDeleteShift");
        void restoreAssignmentsFromDb("handleDeleteShift");
      }
    })();
  };

  const handleUpdateShift = (workAreaId: string, modeCode: ModeCode, code: ShiftCode, label: string, startTime: string, endTime: string) => {
    const timeRange = startTime && endTime ? `${startTime}-${endTime}` : "";

    setWorkAreaShifts((prev) => ({
      ...prev,
      [workAreaId]: {
        ...(prev[workAreaId] ?? ({} as Record<ModeCode, ShiftInfo[]>)),
        [modeCode]: (prev[workAreaId]?.[modeCode] ?? []).map((s) =>
          s.code === code ? { ...s, label, time_range: timeRange } : s,
        ),
      },
    }));

    void updateWorkAreaShiftRecord({
      workAreaId,
      modeCode,
      code,
      label,
      timeRange,
    }).catch((error) => {
      reportSaveError("Failed to update shift", error);
      void restoreShiftsFromDb("handleUpdateShift");
    });
  };

  const handleAddShift = (workAreaId: string, modeCode: ModeCode, label: string, startTime: string, endTime: string) => {
    const code = `shift_${crypto.randomUUID()}`;
    const timeRange = startTime && endTime ? `${startTime}-${endTime}` : "";
    const nextShift: ShiftInfo = { code, label, time_range: timeRange };

    setWorkAreaShifts((prev) => ({
      ...prev,
      [workAreaId]: {
        ...(prev[workAreaId] ?? ({} as Record<ModeCode, ShiftInfo[]>)),
        [modeCode]: [...(prev[workAreaId]?.[modeCode] ?? []), nextShift],
      },
    }));

    const displayOrder = (workAreaShifts[workAreaId]?.[modeCode] ?? []).length + 1;
    void insertWorkAreaShift({
      workAreaId,
      modeCode,
      code,
      label,
      timeRange,
      displayOrder,
    }).catch((error) => {
      reportSaveError("Failed to add shift", error);
      void restoreShiftsFromDb("handleAddShift");
    });

    const wa = workAreas.find((w) => w.id === workAreaId);
    const waHasModes = (wa?.mode_views?.length ?? 0) > 0;
    const stationsInScope = stations.filter((s) => {
      if (s.work_area_id !== workAreaId) return false;
      if (!waHasModes) return true;
      return ((s.mode_code as ModeCode | undefined) ?? DEFAULT_MODE_CODE) === modeCode;
    });
    if (stationsInScope.length === 0) {
      const supervisorId = `st_${crypto.randomUUID()}`;
      const supervisorStation: Station = {
        id: supervisorId,
        work_area_id: workAreaId,
        name: "Supervisor",
        required_headcount: 1,
        display_order: 0,
        protected: true,
        ...(waHasModes ? { mode_code: modeCode } : {}),
      };
      setStations((prev) => [...prev, supervisorStation]);
      void insertStation({
        id: supervisorId,
        workAreaId,
        name: "Supervisor",
        requiredHeadcount: 1,
        displayOrder: 0,
        protected: true,
        modeCode: waHasModes ? modeCode : undefined,
      }).catch((error) => {
        reportSaveError("Failed to auto-create supervisor station", error);
        void restoreStationsFromDb("handleAddShift supervisor");
      });
    }

    stations
      .filter((s) => {
        if (s.work_area_id !== workAreaId || !s.defaultEmployeeId) return false;
        const stationMode: ModeCode = (s.mode_code as ModeCode | undefined) ?? DEFAULT_MODE_CODE;
        return stationMode === modeCode;
      })
      .forEach((s) => {
        if (!assignments.some((a) => a.station_id === s.id && a.shift_code === code && a.mode_code === modeCode)) {
          handleAssign(s.defaultEmployeeId!, s.id, code, modeCode);
        }
      });
  };

  const handleDeleteWorkArea = (workAreaId: string) => {
    setWorkAreas((prev) => prev.filter((w) => w.id !== workAreaId));
    setStations((prev) => prev.filter((s) => s.work_area_id !== workAreaId));
    setAssignments((prev) => prev.filter((a) => getAssignmentWorkAreaId(a, stations) !== workAreaId));
    setWorkAreaShifts((prev) => { const next = { ...prev }; delete next[workAreaId]; return next; });

    void deleteWorkAreaRecord(workAreaId).catch((error: unknown) => {
      reportSaveError("Failed to delete work area", error);
      void restoreWorkAreasFromDb("handleDeleteWorkArea");
      void restoreShiftsFromDb("handleDeleteWorkArea");
      void restoreStationsFromDb("handleDeleteWorkArea");
      void restoreAssignmentsFromDb("handleDeleteWorkArea");
    });
  };

  const handleUpdateWorkArea = (id: string, name: string, color: string, modeViews: WorkAreaModeView[]) => {
    const prevWa = workAreas.find((w) => w.id === id);
    const wasNoModes = !prevWa?.mode_views?.length;
    const nowHasModes = modeViews.length > 0;
    const firstModeCode = modeViews[0]?.mode_code as ModeCode | undefined;
    const secondModeCode = (modeViews[1]?.mode_code ?? modeViews[0]?.mode_code) as ModeCode | undefined;
    const stationsToMigrate = wasNoModes && nowHasModes
      ? stations.filter((s) => s.work_area_id === id && !s.mode_code)
      : [];
    const newStationsForFirstMode: Station[] = wasNoModes && nowHasModes && firstModeCode
      ? ["Station 1", "Station 2", "Station 3"].map((stationName, index) => ({
          id: `st_${crypto.randomUUID()}`,
          work_area_id: id,
          name: stationName,
          required_headcount: 1,
          display_order: index + 1,
          group: "Group 1",
          mode_code: firstModeCode,
        }))
      : [];
    const loanedOutEmpIds = new Set(
      employees
        .filter((e) => e.homeDepartmentId === id)
        .map((e) => e.id),
    );
    const assignmentsToMigrate = wasNoModes && nowHasModes && secondModeCode
      ? assignments.filter((a) => {
          if (a.station_id !== null && stationsToMigrate.some((s) => s.id === a.station_id)) return true;
          return loanedOutEmpIds.has(a.employee_id) && getAssignmentWorkAreaId(a, stations) !== id;
        })
      : [];

    setWorkAreas((prev) =>
      prev.map((wa) => wa.id === id ? { ...wa, name, color_hex: color, mode_views: modeViews.length ? modeViews : undefined } : wa),
    );

    // Migrate existing data to second mode (After Hog Break) when modes are first enabled
    if (wasNoModes && nowHasModes && secondModeCode) {
      // Migrate existing stations → second mode
      setStations((prev) => {
        const migrated = prev.map((s) =>
          s.work_area_id === id && !s.mode_code ? { ...s, mode_code: secondModeCode } : s,
        );
        return [...migrated, ...newStationsForFirstMode];
      });

      // Migrate assignments in this work area → second mode
      // Also migrate loaned-out assignments (home dept = this WA, assigned elsewhere) → second mode
      // so loanedOut count shows correctly per mode tab
      setAssignments((prev) =>
        prev.map((a) => {
          if (a.station_id !== null && stationsToMigrate.some((s) => s.id === a.station_id)) return { ...a, mode_code: secondModeCode! };
          if (loanedOutEmpIds.has(a.employee_id) && getAssignmentWorkAreaId(a, stations) !== id) return { ...a, mode_code: secondModeCode };
          return a;
        }),
      );
    }

    void (async () => {
      try {
        await updateWorkAreaRecord({
          id,
          name,
          colorHex: color,
        });

        await replaceWorkAreaModeViews({
          workAreaId: id,
          modeViews: modeViews.map((modeView) => ({
            modeCode: modeView.mode_code,
            label: modeView.label,
            timeRange: modeView.time_range,
          })),
        });

        if (wasNoModes && nowHasModes && secondModeCode) {
          for (const station of stationsToMigrate) {
            await updateStationRecord({
              id: station.id,
              modeCode: secondModeCode,
            });
          }

          for (const station of newStationsForFirstMode) {
            await insertStation({
              id: station.id,
              workAreaId: station.work_area_id,
              name: station.name,
              requiredHeadcount: station.required_headcount,
              displayOrder: station.display_order,
              modeCode: station.mode_code,
              group: station.group,
            });
          }

          await deleteAssignmentsByIds(assignmentsToMigrate.map((assignment) => assignment.id));
          for (const assignment of assignmentsToMigrate) {
            if (!assignment.station_id) continue;
            const assignmentWorkAreaId = getAssignmentWorkAreaId(assignment, stations);
            if (!assignmentWorkAreaId) continue;
            await writeRealStationAssignment({
              id: assignment.id,
              employeeId: assignment.employee_id,
              stationId: assignment.station_id,
              workAreaId: assignmentWorkAreaId,
              shiftCode: assignment.shift_code,
              modeCode: secondModeCode,
            });
          }
        }
      } catch (error) {
        reportSaveError("Failed to update work area", error);
        void restoreWorkAreasFromDb("handleUpdateWorkArea");
        void restoreStationsFromDb("handleUpdateWorkArea");
        void restoreAssignmentsFromDb("handleUpdateWorkArea");
      }
    })();
  };

  const handleSetTargetOverride = (workAreaId: string, targetOverride: number | null) => {
    setWorkAreas((prev) =>
      prev.map((wa) => (wa.id === workAreaId ? { ...wa, target_override: targetOverride } : wa)),
    );

    void updateWorkAreaRecord({ id: workAreaId, targetOverride }).catch((error) => {
      reportSaveError("Failed to update target headcount", error);
      void restoreWorkAreasFromDb("handleSetTargetOverride");
    });
  };

  const handleAddWorkArea = (name: string, color: string, modeViews: WorkAreaModeView[]): string => {
    const newId = `wa_${crypto.randomUUID()}`;
    const newWa: WorkArea = {
      id: newId,
      name,
      color_hex: color,
      display_order: workAreas.length + 1,
      mode_views: modeViews.length ? modeViews : undefined,
    };
    setWorkAreas((prev) => [...prev, newWa]);

    void (async () => {
      try {
        await insertWorkArea({
          id: newId,
          name,
          colorHex: color,
          displayOrder: workAreas.length + 1,
        });

        await replaceWorkAreaModeViews({
          workAreaId: newId,
          modeViews: modeViews.map((modeView) => ({
            modeCode: modeView.mode_code,
            label: modeView.label,
            timeRange: modeView.time_range,
          })),
        });
      } catch (error) {
        reportSaveError("Failed to add work area", error);
        void restoreWorkAreasFromDb("handleAddWorkArea");
      }
    })();

    return newId;
  };

  const handleReorderStation = (draggedStationId: string, targetStationId: string) => {
    let reorderedStations: Station[] | null = null;

    setStations((prev) => {
      const sorted = [...prev].sort((a, b) => a.display_order - b.display_order);
      const dragged = sorted.find((s) => s.id === draggedStationId);
      const target = sorted.find((s) => s.id === targetStationId);
      if (!dragged || !target) return prev;
      const wa = workAreas.find((w) => w.id === dragged.work_area_id);
      const hasModes = !!(wa?.mode_views?.length);
      const sameArea = sorted.filter((s) => s.work_area_id === dragged.work_area_id && (!hasModes || s.mode_code === dragged.mode_code));
      const draggedOriginalIdx = sameArea.findIndex((s) => s.id === draggedStationId);
      const targetOriginalIdx = sameArea.findIndex((s) => s.id === targetStationId);
      const movingUp = draggedOriginalIdx > targetOriginalIdx;
      if (dragged.protected) return prev;
      if (movingUp && target.protected) return prev;
      const withoutDragged = sameArea.filter((s) => s.id !== draggedStationId);
      const targetIdx = withoutDragged.findIndex((s) => s.id === targetStationId);
      withoutDragged.splice(movingUp ? targetIdx : targetIdx + 1, 0, { ...dragged, group: target.group });
      withoutDragged.forEach((s, i) => { s.display_order = i + 1; });
      reorderedStations = prev.map((s) => withoutDragged.find((u) => u.id === s.id) ?? s);
      return reorderedStations;
    });

    if (!reorderedStations) return;

    void replaceStationOrder(reorderedStations).catch((error) => {
      reportSaveError("Failed to reorder stations", error);
      void restoreStationsFromDb("handleReorderStation");
    });
  };

  const handleDeleteStation = (stationId: string) => {
    setStations((prev) => prev.filter((s) => s.id !== stationId));
    setAssignments((prev) => prev.filter((a) => a.station_id !== stationId));

    void deleteStationRecord(stationId).catch((error) => {
      reportSaveError("Failed to delete station", error);
      void restoreStationsFromDb("handleDeleteStation");
      void restoreAssignmentsFromDb("handleDeleteStation");
    });
  };

  const handleUpdateStation = (
    stationId: string,
    params: { name: string; group?: string; genderRestriction?: "M" | "F"; defaultEmployeeId?: string },
  ) => {
    const station = stations.find((s) => s.id === stationId);
    if (!station) return;
    const wa = workAreas.find((w) => w.id === station.work_area_id);
    const hasModes = !!(wa?.mode_views?.length);
    const newGroup = params.group || undefined;
    let nextStations: Station[] | null = null;

    setStations((prev) => {
      const sorted = [...prev].sort((a, b) => a.display_order - b.display_order);
      const target = sorted.find((s) => s.id === stationId);
      if (!target || target.group === newGroup) {
        nextStations = prev.map((s) =>
          s.id === stationId
            ? { ...s, name: params.name, group: newGroup, gender_restriction: params.genderRestriction, defaultEmployeeId: params.defaultEmployeeId }
            : s,
        );
        return nextStations;
      }
      const sameArea = sorted.filter((s) => s.work_area_id === target.work_area_id && (!hasModes || s.mode_code === target.mode_code));
      const groupStations = newGroup ? sameArea.filter((s) => s.id !== stationId && s.group === newGroup) : [];
      const insertAfterOrder = groupStations.length > 0
        ? groupStations[groupStations.length - 1].display_order
        : sameArea[sameArea.length - 1]?.display_order ?? 0;
      const withoutTarget = sameArea.filter((s) => s.id !== stationId).map((s) => ({ ...s }));
      const insertIdx = withoutTarget.findIndex((s) => s.display_order === insertAfterOrder);
      withoutTarget.splice(insertIdx + 1, 0, { ...target, name: params.name, group: newGroup, gender_restriction: params.genderRestriction, defaultEmployeeId: params.defaultEmployeeId });
      withoutTarget.forEach((s, i) => { s.display_order = i + 1; });
      nextStations = prev.map((s) => withoutTarget.find((u) => u.id === s.id) ?? s);
      return nextStations;
    });

    void updateStationRecord({
      id: stationId,
      name: params.name,
      group: newGroup ?? null,
      genderRestriction: params.genderRestriction ?? null,
      defaultEmployeeId: params.defaultEmployeeId ?? null,
    }).catch((error) => {
      reportSaveError("Failed to update station", error);
      void restoreStationsFromDb("handleUpdateStation");
    });

    if (nextStations && station.group !== newGroup) {
      void replaceStationOrder(nextStations).catch((error) => {
        reportSaveError("Failed to persist station order after update", error);
        void restoreStationsFromDb("handleUpdateStation");
      });
    }

    if (params.defaultEmployeeId) {
      const modeCode: ModeCode = (station.mode_code as ModeCode | undefined) ?? DEFAULT_MODE_CODE;
      const shifts = workAreaShifts[station.work_area_id]?.[modeCode] ?? [];
      const empId = params.defaultEmployeeId;
      const existingStationAssignments = assignments.filter((a) => a.station_id === stationId);
      const nextDefaultAssignments: StationAssignment[] = shifts.map((shift) => ({
        id: `a_${crypto.randomUUID()}`,
        employee_id: empId,
        station_id: stationId,
        work_area_id: null,
        work_date: todayDateString(),
        shift_code: shift.code,
        mode_code: modeCode,
      }));

      // Single optimistic update: remove all existing station assignments and add new default employee
      setAssignments((prev) => [
        ...prev.filter((a) => a.station_id !== stationId),
        ...nextDefaultAssignments,
      ]);

      void (async () => {
        try {
          await deleteAssignmentsByIds(existingStationAssignments.map((assignment) => assignment.id));

          for (const assignment of nextDefaultAssignments) {
            await writeRealStationAssignment({
              id: assignment.id,
              employeeId: assignment.employee_id,
              stationId: assignment.station_id!,
              workAreaId: station.work_area_id,
              shiftCode: assignment.shift_code,
              modeCode: assignment.mode_code,
            });
          }
        } catch (error) {
          reportSaveError("Failed to persist default employee assignments for station", error);
          void restoreAssignmentsFromDb("handleUpdateStation");
        }
      })();
    }
  };

  const handleAddStation = (params: {
    workAreaId: string;
    name: string;
    group?: string;
    genderRestriction?: "M" | "F";
    defaultEmployeeId?: string;
    modeCode: ModeCode;
  }) => {
    const stationId = `st_${crypto.randomUUID()}`;
    const wa = workAreas.find((w) => w.id === params.workAreaId);
    const hasModes = !!(wa?.mode_views?.length);
    const currentShifts = workAreaShifts[params.workAreaId]?.[params.modeCode] ?? [];
    const displayOrder =
      stations.filter(
        (s) => s.work_area_id === params.workAreaId && (!hasModes || s.mode_code === params.modeCode),
      ).length + 1;

    setStations((prev) => [
      ...prev,
      {
        id: stationId,
        work_area_id: params.workAreaId,
        name: params.name,
        required_headcount: 1,
        display_order: displayOrder,
        ...(hasModes ? { mode_code: params.modeCode } : {}),
        ...(params.group ? { group: params.group } : {}),
        ...(params.genderRestriction ? { gender_restriction: params.genderRestriction } : {}),
        ...(params.defaultEmployeeId ? { defaultEmployeeId: params.defaultEmployeeId } : {}),
      },
    ]);

    void insertStation({
      id: stationId,
      workAreaId: params.workAreaId,
      name: params.name,
      requiredHeadcount: 1,
      displayOrder,
      modeCode: hasModes ? params.modeCode : undefined,
      genderRestriction: params.genderRestriction,
      defaultEmployeeId: params.defaultEmployeeId,
      group: params.group,
    }).catch((error) => {
      reportSaveError("Failed to add station", error);
      void restoreStationsFromDb("handleAddStation");
    });

    if (params.defaultEmployeeId) {
      currentShifts.forEach((shift) => {
        if (!assignments.some((a) => a.station_id === stationId && a.shift_code === shift.code && a.mode_code === params.modeCode)) {
          handleAssign(params.defaultEmployeeId!, stationId, shift.code, params.modeCode);
        }
      });
    }
  };

  const getEmployeeEffectiveDepartmentIds = (emp: Employee): string[] =>
    getEmployeeActiveDepartmentIds(emp.id, assignments, stations);

  const handleStationsChange = (next: Station[]) => setStations(next);
  const handleWorkAreasChange = (next: WorkArea[]) => setWorkAreas(next);
  const handleWorkAreaShiftsChange = (next: WorkAreaShiftMap) => setWorkAreaShifts(next);
  const handleWorkAreaChange = (id: string) => setSelectedWorkAreaId(id);
  const handleAnnouncementChange = (text: string) => setAnnouncement(text);

  return {
    // Status configs
    statusConfigs,
    handleUpdateStatusConfig,
    handleDeleteStatusConfig,
    handleAddStatusConfig,
    handleReorderStatusConfig,
    // Announcement
    announcement,
    handleAnnouncementChange,
    // Board data
    employees,
    statuses,
    assignments,
    stations,
    workAreas,
    workAreaShifts,
    selectedWorkAreaId,
    isHydrating,
    loadError,
    saveError,
    clearSaveError,
    refetchSnapshot,
    refetchStatuses,
    disabledIds,
    defaultShiftTemplate,
    handleDeleteShift,
    handleUpdateShift,
    handleAddShift,
    handleDeleteWorkArea,
    handleUpdateWorkArea,
    handleSetTargetOverride,
    handleAddWorkArea,
    handleReorderStation,
    handleDeleteStation,
    handleUpdateStation,
    handleAddStation,
    handleStationsChange,
    handleWorkAreasChange,
    handleWorkAreaShiftsChange,
    handleWorkAreaChange,
    handleAdd,
    handleBulkImport,
    handleRemoveEmployee,
    handleUpdate,
    handleSetQualifiedWorkAreas,
    handleStatusChange,
    handleAssign,
    handleUnassign,
    handleUnassignAll,
    handleUnassignFromStation,
    handleClearWorkArea,
    handleAssignToDepartment,
    handleUnassignFromDepartment,
    handleQuickAssign,
    getEmployeeEffectiveDepartmentIds,
  };
}
