"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { getAssignmentWorkAreaId, isEmployeeEligibleForWorkArea, getEmployeeQualifiedWorkAreaIds, hasNullStationAssignment, abbrevDept } from "../utils";
import type { Employee, Station, StationAssignment, WorkArea } from "../types";
import { StatCard } from "./stat-card";
import { StatusSelect, getUnavailableStatusCodes, STATUS_CODE_AVAILABLE } from "./status-select";
import { resolveWorkAreaTarget } from "@/features/daily-lineup/config/targets";
import { classifyStatus, STATUS_META } from "@/features/daily-lineup/utils/classify-status";
import { TargetModal } from "./modals/target-modal";
import type { StatusConfig } from "./status-select";
import { AssignmentModal } from "./modals/assignment-modal";

type EmployeeStatus = string;

export function AssignmentSidebar({
  employees,
  statuses,
  assignments,
  stations,
  workAreas,
  selectedWorkAreaId,
  statusConfigs,
  onAdd,
  onRemove,
  onUpdate,
  onSetQualifiedWorkAreas,
  onStatusChange,
  onAssignToStation,
  onUnassignAll,
  onUnassignFromStation,
  onSetTargetOverride,
  getEmployeeEffectiveDepartmentIds,
  onOpenRoster,
  onManageStatuses,
}: {
  employees: Employee[];
  statuses: Record<string, EmployeeStatus>;
  assignments: StationAssignment[];
  stations: Station[];
  workAreas: WorkArea[];
  selectedWorkAreaId?: string;
  statusConfigs: StatusConfig[];
  onAdd: (emp: Employee) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Employee, "qualifiedDepartmentIds">>) => void;
  onSetQualifiedWorkAreas: (id: string, workAreaIds: string[]) => void;
  onStatusChange: (id: string, status: EmployeeStatus) => void;
  onAssignToStation: (empId: string, stationId: string) => void;
  onUnassignAll: (empId: string, resetStatus?: boolean) => void;
  onUnassignFromStation: (empId: string, stationId: string) => void;
  onSetTargetOverride: (workAreaId: string, value: number | null) => void;
  getEmployeeEffectiveDepartmentIds: (emp: import("../types").Employee) => string[];
  onOpenRoster: (search: string) => void;
  onManageStatuses: () => void;
}) {
  const [assignModalEmp, setAssignModalEmp] = useState<Employee | null>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const selectedWorkArea = workAreas.find((w) => w.id === selectedWorkAreaId);

  const getStatus = (id: string): EmployeeStatus => statuses[id] ?? STATUS_CODE_AVAILABLE;

  const activeEmployees = employees.filter((e) => e.active);

  // Workforce Overview shows the same Daily Lineup metrics for the selected
  // work area: present (incl. light duty), light duty, over target, and
  // unavailable (absent + vacation). Scoped to the WA's home roster.
  const overviewEmployees = selectedWorkAreaId
    ? activeEmployees.filter((e) => e.homeDepartmentId === selectedWorkAreaId)
    : activeEmployees;

  const unavailableCodes = getUnavailableStatusCodes(statusConfigs);
  const VACATION_CODE = "vacation";
  const LIGHT_DUTY_CODE = "injured";

  let presentCount = 0;
  let lightDutyCount = 0;
  let absentCount = 0;
  let vacationCount = 0;
  for (const e of overviewEmployees) {
    const s = getStatus(e.id);
    if (s === VACATION_CODE) {
      vacationCount += 1;
    } else if (unavailableCodes.has(s)) {
      absentCount += 1;
    } else {
      presentCount += 1;
      if (s === LIGHT_DUTY_CODE) lightDutyCount += 1;
    }
  }
  const unavailableTotal = absentCount + vacationCount;
  const targetCount = resolveWorkAreaTarget(selectedWorkAreaId ?? "", employees, selectedWorkArea?.target_override);
  // Total Staff = distinct active employees with at least one station
  // assignment in the selected WA (loan-ins included). Over Target compares
  // against this so both tiles share one definition.
  const assignedCount = selectedWorkAreaId
    ? new Set(
        assignments
          .filter((a) => a.station_id !== null && getAssignmentWorkAreaId(a, stations) === selectedWorkAreaId)
          .map((a) => a.employee_id)
          .filter((id) => activeEmployees.some((e) => e.id === id))
      ).size
    : new Set(
        assignments
          .filter((a) => a.station_id !== null)
          .map((a) => a.employee_id)
          .filter((id) => activeEmployees.some((e) => e.id === id))
      ).size;
  const overTargetValue = assignedCount - targetCount;
  const overTargetDisplay =
    overTargetValue > 0 ? `+${overTargetValue}` :
    overTargetValue < 0 ? `${overTargetValue}` : "—";

  // Used downstream by the "Available Employees" header badge.
  const totalStaff = overviewEmployees.length;


  return (
    <div className="flex h-full w-full shrink-0 flex-col gap-4 overflow-hidden md:w-72">
      {/* Workforce Overview */}
      <div className="shrink-0 rounded-lg border border-slate-300 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Workforce Overview</p>
          {selectedWorkAreaId && (() => {
            const meta = STATUS_META[classifyStatus(assignedCount, targetCount)];
            return (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}>
                {meta.label}
              </span>
            );
          })()}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard label="Total Staff" value={assignedCount} bg="bg-[#FFFFFF]" labelColor="text-slate-400" color="text-[#334155]" borderColor="border-[#E2E8F0]" />
          <div
            onDoubleClick={() => { if (selectedWorkAreaId) setTargetModalOpen(true); }}
            title="Double-click to set target"
            className="cursor-pointer"
          >
            <StatCard label="Over Target" value={overTargetDisplay} bg="bg-white" labelColor="text-[#1E3A8A]" color="text-[#1E3A8A]" borderColor="border-[#E2E8F0]" accent="#1E3A8A" />
          </div>
          <StatCard label="Light Duty" value={lightDutyCount} bg="bg-white" labelColor="text-[#F8AE17]" color="text-[#F8AE17]" borderColor="border-[#E2E8F0]" accent="#F8AE17" />
          <StatCard label="Unavailable" value={unavailableTotal} bg="bg-white" labelColor="text-[#F75871]" color="text-[#F75871]" borderColor="border-[#E2E8F0]" accent="#F75871" />
        </div>
      </div>

      {/* Employee Roster */}
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-300 bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Available Employees
            <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {totalStaff}
            </span>
          </p>
          <button
            onClick={() => onOpenRoster("")}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Settings size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {totalStaff === 0 ? (
            <div className="flex h-full items-center justify-center px-6 py-8">
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No employees yet</p>
                <p className="mt-2 text-xs text-slate-500">
                  Add your first employee to start building the roster.
                </p>
                <button
                  onClick={() => onOpenRoster("")}
                  className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  + Add Employee
                </button>
              </div>
            </div>
          ) : (() => {
            const unavailableCodes = getUnavailableStatusCodes(statusConfigs);
            const isUnavailable = (id: string) => unavailableCodes.has(getStatus(id));
            const selectedWa = workAreas.find((w) => w.id === selectedWorkAreaId);
            const visibleWorkAreas = selectedWa ? [selectedWa] : workAreas;
            const noDept = !selectedWa ? activeEmployees.filter((e) => e.homeDepartmentId === null && !isUnavailable(e.id)) : [];
            const unassignedEmps = !selectedWa ? activeEmployees.filter((e) => e.homeDepartmentId === null && !isUnavailable(e.id)) : [];
            // Unavailable list is scoped to the selected work area's home
            // roster so the count matches the Workforce Overview tile. Loan-in
            // eligible employees from other home depts are intentionally
            // excluded here to keep the two numbers consistent.
            const unavailableEmps = activeEmployees.filter((e) => {
              if (!isUnavailable(e.id)) return false;
              if (!selectedWa) return true;
              return e.homeDepartmentId === selectedWa.id;
            });
            return (
              <>
                {visibleWorkAreas.map((wa) => {
                  const deptEmps = activeEmployees.filter((e) => {
                    if (isUnavailable(e.id)) return false;
                    if (assignments.some((a) => a.employee_id === e.id && a.station_id !== null && getAssignmentWorkAreaId(a, stations) === wa.id)) return false;
                    const hasNullStation = hasNullStationAssignment(e.id, wa.id, assignments);
                    if (selectedWa) {
                      return isEmployeeEligibleForWorkArea(e, wa.id) || hasNullStation;
                    }
                    return e.homeDepartmentId === wa.id || hasNullStation;
                  });
                  if (deptEmps.length === 0) return null;
                  return (
                    <div key={wa.id}>
                      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-t border-slate-200 bg-slate-100 px-4 py-2">
                        <span className="h-2 w-2 rounded-full shrink-0 bg-emerald-500" />
                        <span className="text-xs font-semibold text-slate-600">Available</span>
                        <span className="ml-auto text-xs text-slate-400">{deptEmps.length}</span>
                      </div>
                      {deptEmps.map((emp) => {
                        return (
                          <div
                            key={emp.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("application/json", JSON.stringify({
                                employeeId: emp.id,
                                fromStationId: null,
                                fromShiftCode: null,
                                fromModeCode: null,
                              }));
                              const ghost = document.createElement("div");
                              ghost.textContent = emp.full_name;
                              Object.assign(ghost.style, {
                                position: "fixed", top: "-200px", left: "0",
                                padding: "4px 10px", borderRadius: "6px",
                                background: wa.color_hex ?? "#64748b", color: "#fff",
                                fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                              });
                              document.body.appendChild(ghost);
                              e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
                              setTimeout(() => document.body.removeChild(ghost), 0);
                            }}
                            onDoubleClick={() => onOpenRoster(emp.full_name)}
                            title="Drag to assign station · Double-click to look up"
                            className="group flex cursor-grab items-center gap-2 border-b border-slate-100 px-4 py-2 last:border-b-0 hover:bg-slate-50/50 active:cursor-grabbing"
                          >
                              <p className="min-w-0 truncate text-sm font-medium text-slate-800">
                                {emp.full_name}
                              </p>
                            <div className="ml-auto flex shrink-0 items-center gap-1.5">
                              {emp.temporary && (
                                <span className="rounded bg-slate-100 px-1.5 py-px text-[9px] text-slate-800 border border-slate-300">TEMP</span>
                              )}
                              {emp.homeDepartmentId !== wa.id && emp.homeDepartmentId && (
                                <span className="rounded px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 border border-blue-200">
                                  {abbrevDept(workAreas.find((w) => w.id === emp.homeDepartmentId)?.name ?? "")}
                                </span>
                              )}
                              <StatusSelect
                                value={getStatus(emp.id)}
                                configs={statusConfigs}
                                onChange={(val) => onStatusChange(emp.id, val)}
                                onManageStatuses={onManageStatuses}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {unassignedEmps.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-t border-slate-200 bg-slate-100 px-4 py-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-600">Unassigned</span>
                      <span className="ml-auto text-xs text-slate-400">{unassignedEmps.length}</span>
                    </div>
                    {unassignedEmps.map((emp) => {
                      return (
                        <div
                          key={emp.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("application/json", JSON.stringify({ employeeId: emp.id, fromStationId: null, fromShiftCode: null, fromModeCode: null }));
                            const ghost = document.createElement("div");
                            ghost.textContent = emp.full_name;
                            Object.assign(ghost.style, { position: "fixed", top: "-200px", left: "0", padding: "4px 10px", borderRadius: "6px", background: "#94a3b8", color: "#fff", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" });
                            document.body.appendChild(ghost);
                            e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
                            setTimeout(() => document.body.removeChild(ghost), 0);
                          }}
                          onDoubleClick={() => onOpenRoster(emp.full_name)}
                          className="group flex cursor-grab items-center gap-2 border-b border-slate-100 px-4 py-2 last:border-b-0 hover:bg-slate-50/50 active:cursor-grabbing"
                        >
                          <p className="min-w-0 truncate text-sm font-medium text-slate-800">{emp.full_name}</p>
                          <div className="ml-auto flex shrink-0 items-center gap-1.5">
                            {emp.temporary && (
                              <span className="rounded bg-slate-100 px-1.5 py-px text-[9px] text-slate-800 border border-slate-300">TEMP</span>
                            )}
                            <StatusSelect
                              value={getStatus(emp.id)}
                              configs={statusConfigs}
                              onChange={(val) => onStatusChange(emp.id, val)}
                              onManageStatuses={onManageStatuses}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Unavailable section */}
                {unavailableEmps.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-t border-slate-200 bg-slate-100 px-4 py-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-600">Unavailable</span>
                      <span className="ml-auto text-xs text-slate-400">{unavailableEmps.length}</span>
                    </div>
                    {unavailableEmps.map((emp) => (
                      <div key={emp.id} className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 last:border-b-0 hover:bg-slate-50/50">
                        <p className="min-w-0 cursor-pointer truncate text-sm font-medium text-slate-400" onDoubleClick={() => onOpenRoster(emp.full_name)}>{emp.full_name}</p>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                          {emp.temporary && (
                            <span className="rounded bg-slate-100 px-1.5 py-px text-[9px] text-slate-800 border border-slate-300">TEMP</span>
                          )}
                          <StatusSelect
                            value={getStatus(emp.id)}
                            configs={statusConfigs}
                            onChange={(val) => {
                              if (val === STATUS_CODE_AVAILABLE) {
                                onUnassignAll(emp.id);
                              } else {
                                onStatusChange(emp.id, val);
                              }
                            }}
                            onManageStatuses={onManageStatuses}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Assigned section */}
                {visibleWorkAreas.map((wa) => {
                  const assignedEmps = activeEmployees.filter((e) =>
                    assignments.some((a) => a.employee_id === e.id && a.station_id !== null && getAssignmentWorkAreaId(a, stations) === wa.id)
                  );
                  if (assignedEmps.length === 0) return null;
                  return (
                    <div key={`assigned-${wa.id}`}>
                      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-t border-slate-200 bg-slate-100 px-4 py-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: wa.color_hex ?? "#64748b" }} />
                        <span className="text-xs font-semibold text-slate-600">Assigned</span>
                        <span className="ml-auto text-xs text-slate-400">{assignedEmps.length}</span>
                      </div>
                      {assignedEmps.map((emp) => {
                        const empStations = [...new Set(assignments.filter((a) => a.employee_id === emp.id).map((a) => stations.find((s) => s.id === a.station_id)?.name).filter(Boolean))];
                        return (
                          <div
                            key={emp.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("application/json", JSON.stringify({ employeeId: emp.id, fromStationId: null, fromShiftCode: null, fromModeCode: null }));
                              const ghost = document.createElement("div");
                              ghost.textContent = emp.full_name;
                              Object.assign(ghost.style, { position: "fixed", top: "-200px", left: "0", padding: "4px 10px", borderRadius: "6px", background: wa.color_hex ?? "#64748b", color: "#fff", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" });
                              document.body.appendChild(ghost);
                              e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
                              setTimeout(() => document.body.removeChild(ghost), 0);
                            }}
                            onDoubleClick={() => onOpenRoster(emp.full_name)}
                            className="flex cursor-grab items-center gap-2 border-b border-slate-100 px-4 py-2 last:border-b-0 hover:bg-slate-50/50 active:cursor-grabbing"
                          >
                            <p className="min-w-0 truncate text-sm font-medium text-slate-600">{emp.full_name}</p>
                            <div className="ml-auto flex shrink-0 items-center gap-1.5 min-w-0 max-w-[55%]">
                              {emp.temporary && (
                                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-px text-[9px] text-slate-800 border border-slate-300">TEMP</span>
                              )}
                              <span className="min-w-0 truncate text-right text-xs text-slate-400">{empStations.join(", ")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {noDept.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 border-b border-t border-slate-200 bg-slate-100 px-4 py-2">
                      <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
                      <span className="text-xs font-semibold text-slate-600">No Department</span>
                      <span className="ml-auto text-xs text-slate-400">{noDept.length}</span>
                    </div>
                    {noDept.map((emp) => {
                      return (
                        <div
                          key={emp.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("application/json", JSON.stringify({ employeeId: emp.id, fromStationId: null, fromShiftCode: null, fromModeCode: null }));
                            const ghost = document.createElement("div");
                            ghost.textContent = emp.full_name;
                            Object.assign(ghost.style, { position: "fixed", top: "-200px", left: "0", padding: "4px 10px", borderRadius: "6px", background: "#64748b", color: "#fff", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" });
                            document.body.appendChild(ghost);
                            e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
                            setTimeout(() => document.body.removeChild(ghost), 0);
                          }}
                          onDoubleClick={() => onOpenRoster(emp.full_name)}
                          className="group flex cursor-grab items-center gap-2 border-b border-slate-100 px-4 py-2 last:border-b-0 hover:bg-slate-50/50 active:cursor-grabbing"
                        >
                          <p className="flex-1 truncate text-sm font-medium text-slate-800">
                            {emp.full_name}
                          </p>
                          <div className="ml-auto flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => setAssignModalEmp(emp)}
                              className="text-xs text-slate-400 hover:text-blue-500">
                              + Dept
                            </button>
                            <StatusSelect
                              value={getStatus(emp.id)}
                              configs={statusConfigs}
                              onChange={(val) => onStatusChange(emp.id, val)}
                              onManageStatuses={onManageStatuses}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {assignModalEmp && (
        <AssignmentModal
          employee={assignModalEmp}
          workAreas={workAreas}
          stations={stations}
          assignedStationIds={new Set(assignments.filter((a) => a.employee_id === assignModalEmp.id && a.station_id !== null).map((a) => a.station_id!))}
          onSave={(waId: string, toAdd: string[], toRemove: string[]) => {
            const qualified = getEmployeeQualifiedWorkAreaIds(assignModalEmp);
            const q = qualified.includes(waId) ? qualified : [waId, ...qualified];
            onUpdate(assignModalEmp.id, { homeDepartmentId: waId });
            onSetQualifiedWorkAreas(assignModalEmp.id, q);
            toAdd.forEach((sid) => onAssignToStation(assignModalEmp.id, sid));
            toRemove.forEach((sid) => onUnassignFromStation(assignModalEmp.id, sid));
            setAssignModalEmp(null);
          }}
          onClear={() => {
            onUpdate(assignModalEmp.id, { homeDepartmentId: null });
            onUnassignAll(assignModalEmp.id);
          }}
          onClose={() => setAssignModalEmp(null)}
        />
      )}

      {targetModalOpen && selectedWorkAreaId && (
        <TargetModal
          workAreaName={selectedWorkArea?.name ?? "—"}
          currentTarget={targetCount}
          hasOverride={selectedWorkArea?.target_override != null}
          onSave={(value) => {
            onSetTargetOverride(selectedWorkAreaId, value);
            setTargetModalOpen(false);
          }}
          onReset={() => {
            onSetTargetOverride(selectedWorkAreaId, null);
            setTargetModalOpen(false);
          }}
          onClose={() => setTargetModalOpen(false)}
        />
      )}
    </div>
  );
}
