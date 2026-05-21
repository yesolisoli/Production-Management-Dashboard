"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { getAssignmentWorkAreaId, isEmployeeEligibleForWorkArea, getEmployeeQualifiedWorkAreaIds, hasNullStationAssignment, abbrevDept } from "../utils";
import type { Employee, Station, StationAssignment, WorkArea } from "../types";
import { StatCard } from "./stat-card";
import { StatusSelect, getUnavailableStatusCodes, STATUS_CODE_AVAILABLE } from "./status-select";
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
  getEmployeeEffectiveDepartmentIds: (emp: import("../types").Employee) => string[];
  onOpenRoster: (search: string) => void;
  onManageStatuses: () => void;
}) {
  const [assignModalEmp, setAssignModalEmp] = useState<Employee | null>(null);

  const getStatus = (id: string): EmployeeStatus => statuses[id] ?? STATUS_CODE_AVAILABLE;

  const activeEmployees = employees.filter((e) => e.active);
  const totalStaff = activeEmployees.length;

  const unavailableCodes = getUnavailableStatusCodes(statusConfigs);
  const isUnavailableStat = (id: string) => unavailableCodes.has(getStatus(id));

  const unavailableCount = activeEmployees.filter((e) => isUnavailableStat(e.id)).length;
  const assignedCount = activeEmployees.filter(
    (e) => !isUnavailableStat(e.id) && assignments.some((a) => a.employee_id === e.id),
  ).length;
  const unassignedCount = activeEmployees.filter(
    (e) => !isUnavailableStat(e.id) && !assignments.some((a) => a.employee_id === e.id),
  ).length;
  const availableWorkforce = totalStaff - unavailableCount;
  const efficiency = availableWorkforce > 0 ? ((assignedCount / availableWorkforce) * 100).toFixed(1) : "0.0";


  return (
    <div className="flex h-full w-72 shrink-0 flex-col gap-4 overflow-hidden">
      {/* Workforce Overview */}
      <div className="shrink-0 rounded-lg border border-slate-300 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Workforce Overview</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard label="Total Staff" value={totalStaff} bg="bg-[#FFFFFF]" labelColor="text-slate-400" color="text-[#334155]" borderColor="border-[#E2E8F0]" />
          <StatCard label="Unassigned" value={unassignedCount} bg="bg-white" labelColor="text-[#F75871]" color="text-[#F75871]" borderColor="border-[#E2E8F0]" accent="#F75871" />
          <StatCard label="Unavailable" value={unavailableCount} bg="bg-white" labelColor="text-[#F8AE17]" color="text-[#F8AE17]" borderColor="border-[#E2E8F0]" accent="#F8AE17" />
          <StatCard label="Efficiency" value={`${efficiency}%`} bg="bg-[#0F172A]" labelColor="text-slate-400" color="text-[#FFFFFF]" borderColor="border-[#0F172A]" />
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
          {(() => {
            const unavailableCodes = getUnavailableStatusCodes(statusConfigs);
            const isUnavailable = (id: string) => unavailableCodes.has(getStatus(id));
            const selectedWa = workAreas.find((w) => w.id === selectedWorkAreaId);
            const visibleWorkAreas = selectedWa ? [selectedWa] : workAreas;
            const noDept = !selectedWa ? activeEmployees.filter((e) => e.homeDepartmentId === null && !isUnavailable(e.id)) : [];
            const unassignedEmps = !selectedWa ? activeEmployees.filter((e) => e.homeDepartmentId === null && !isUnavailable(e.id)) : [];
            const unavailableEmps = activeEmployees.filter((e) => {
              if (!isUnavailable(e.id)) return false;
              if (!selectedWa) return true;
              return isEmployeeEligibleForWorkArea(e, selectedWa.id);
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
                        <span className="h-2 w-2 rounded-full shrink-0 bg-red-500" />
                        <span className="text-xs font-semibold text-slate-600">No Station</span>
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
                            {emp.temporary && (
                              <span className="shrink-0 rounded bg-violet-50 px-1 py-px text-[9px] text-violet-500 border border-violet-100">TEMP</span>
                            )}
                            <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
                          {emp.temporary && (
                            <span className="shrink-0 rounded bg-violet-50 px-1 py-px text-[9px] text-violet-500 border border-violet-100">TEMP</span>
                          )}
                          <div className="ml-auto shrink-0">
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
                        {emp.temporary && (
                          <span className="shrink-0 rounded bg-violet-50 px-1 py-px text-[9px] text-violet-500 border border-violet-100">TEMP</span>
                        )}
                        <div className="ml-auto shrink-0">
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
                        <span className="text-xs font-semibold text-slate-600">{wa.name}</span>
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
                            {emp.temporary && (
                              <span className="shrink-0 rounded bg-violet-50 px-1 py-px text-[9px] text-violet-500 border border-violet-100">TEMP</span>
                            )}
                            <span className="ml-auto min-w-0 max-w-[45%] shrink-0 truncate text-right text-xs text-slate-400">{empStations.join(", ")}</span>
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

    </div>
  );
}
