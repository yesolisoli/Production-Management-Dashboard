"use client";

import { useEffect, useRef, useState } from "react";
import type { Employee, ModeCode, ShiftCode, Station, StationAssignment, WorkArea } from "../types";
import { getAssignmentWorkAreaId, isEmployeeEligibleForWorkArea, abbrevDept } from "../utils";
import { cfgBadge, STATUS_CODE_AVAILABLE, type StatusConfig } from "./status-select";
import { EmployeeCard } from "./employee-card";

type PendingMove = {
  employeeId: string;
  fromStationId?: string;
  fromShiftCode?: string;
  fromModeCode?: string;
  empName: string;
  fromDeptName: string;
  toDeptName: string;
};

export function AssignmentCell({
  stationId, shiftCode, modeCode, color, assignments, allEmployees, statuses, disabledEmployeeIds, onAssign, onRemove, workAreaId, workAreas, stations, genderRestriction, onEmployeeDoubleClick, statusConfigs,
}: {
  stationId: string;
  shiftCode: ShiftCode;
  modeCode: ModeCode;
  color: string;
  assignments: StationAssignment[];
  allEmployees: Employee[];
  statuses?: Record<string, string>;
  disabledEmployeeIds?: Set<string>;
  onAssign: (employeeId: string, stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) => void;
  onRemove: (employeeId: string, stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) => void;
  workAreaId?: string;
  workAreas?: WorkArea[];
  stations: Station[];
  genderRestriction?: "M" | "F";
  onEmployeeDoubleClick?: (name: string) => void;
  statusConfigs?: StatusConfig[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "unassigned">("all");
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [listMaxHeight, setListMaxHeight] = useState(280);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    if (isOpen) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [isOpen]);

  const cellAssignments = assignments.filter(
    (a) => a.station_id === stationId && a.shift_code === shiftCode && a.mode_code === modeCode,
  );
  const assignedIds = new Set(cellAssignments.map((a) => a.employee_id));

  const assignedWithInfo = cellAssignments
    .map((a) => ({ asgn: a, emp: allEmployees.find((e) => e.id === a.employee_id) }))
    .filter((x): x is { asgn: StationAssignment; emp: Employee } => !!x.emp && !disabledEmployeeIds?.has(x.emp.id));

  const isEligible = (e: Employee): boolean => {
    if (!workAreaId) return true;
    if (isEmployeeEligibleForWorkArea(e, workAreaId)) return true;
    return assignments.some((a) => a.employee_id === e.id && getAssignmentWorkAreaId(a, stations) === workAreaId);
  };

  const eligibleEmployees = workAreaId ? allEmployees.filter(isEligible) : allEmployees;
  const allPickable = eligibleEmployees.filter((e) => !assignedIds.has(e.id) && !disabledEmployeeIds?.has(e.id));
  // Department tab: all eligible employees for this work area (assigned elsewhere or not)
  const assignedDeptPickable = allPickable
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  // Unassigned tab: eligible employees with zero assignments anywhere
  const unassignedPickable = allPickable
    .filter((e) => !assignments.some((a) => a.employee_id === e.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const baseList = tab === "unassigned" ? unassignedPickable : assignedDeptPickable;
  const filtered = search.trim()
    ? baseList.filter((e) => e.full_name.toLowerCase().includes(search.toLowerCase()))
    : baseList;

  // isLoaned = activeDepartmentId !== homeDepartmentId (derived)
  const isCrossDept = (emp: Employee) =>
    !!workAreaId && !!emp.homeDepartmentId && emp.homeDepartmentId !== workAreaId;


  const openMoveModal = (
    emp: Employee,
    fromStationId?: string,
    fromShiftCode?: string,
    fromModeCode?: string,
  ) => {
    const fromDeptName = workAreas?.find((w) => w.id === emp.homeDepartmentId)?.name ?? emp.homeDepartmentId ?? "Unknown";
    const toDeptName = workAreas?.find((w) => w.id === workAreaId)?.name ?? workAreaId ?? "Unknown";
    setPendingMove({ employeeId: emp.id, fromStationId, fromShiftCode, fromModeCode, empName: emp.full_name, fromDeptName, toDeptName });
  };

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownWidth = 288;
      const spaceBelow = window.innerHeight - rect.bottom - 6;
      const spaceAbove = rect.top - 6;
      const left = Math.max(4, Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 4));
      const bottomGap = 20;
      const openBelow = spaceBelow >= 320 || spaceBelow >= spaceAbove;
      const top = openBelow ? rect.bottom + 6 : rect.top - Math.min(spaceAbove - bottomGap, 420) - 6;
      setDropPos({ top, left });
      setListMaxHeight(openBelow ? Math.min(spaceBelow - 120, 420) : Math.min(spaceAbove - bottomGap - 90, 420));
    }
    setIsOpen((v) => !v);
    setSearch("");
  };

  const handleClickAssign = (emp: Employee) => {
    setIsOpen(false);
    setSearch("");
    if (isCrossDept(emp)) {
      openMoveModal(emp);
    } else {
      onAssign(emp.id, stationId, shiftCode, modeCode);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const { employeeId, fromStationId, fromShiftCode, fromModeCode } = JSON.parse(e.dataTransfer.getData("application/json"));
      if (fromStationId === stationId && fromShiftCode === shiftCode && fromModeCode === modeCode) return;
      if (assignedIds.has(employeeId)) return;
      if (disabledEmployeeIds?.has(employeeId)) return;
      const emp = allEmployees.find((e) => e.id === employeeId);
      if (!emp) return;
      if (isCrossDept(emp)) {
        openMoveModal(emp, fromStationId, fromShiftCode, fromModeCode);
      } else {
        if (fromStationId) onRemove(employeeId, fromStationId, fromShiftCode, fromModeCode);
        onAssign(employeeId, stationId, shiftCode, modeCode);
      }
    } catch {}
  };

  const confirmMove = () => {
    if (!pendingMove) return;
    if (disabledEmployeeIds?.has(pendingMove.employeeId)) { setPendingMove(null); return; }
    if (pendingMove.fromStationId) onRemove(pendingMove.employeeId, pendingMove.fromStationId, pendingMove.fromShiftCode as ShiftCode, pendingMove.fromModeCode as ModeCode);
    onAssign(pendingMove.employeeId, stationId, shiftCode, modeCode);
    setPendingMove(null);
  };

  return (
    <>
      {/* Cross-dept Move Confirm Modal */}
      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPendingMove(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-base font-bold text-slate-800">Move to Another Department</h2>
            <p className="mb-6 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{pendingMove.empName}</span>
              <span className="mx-2 text-slate-400">·</span>
              <span className="font-medium text-slate-600">{pendingMove.fromDeptName}</span>
              <span className="mx-1 text-slate-400">→</span>
              <span className="font-medium text-slate-600">{pendingMove.toDeptName}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingMove(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmMove}
                className="flex-1 rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={ref}
        className="group/cell relative h-full min-h-12 rounded-md transition-all"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={isDragOver ? { backgroundColor: color + "22", outline: `2px solid ${color}99`, outlineOffset: "2px" } : {}}
      >
        <div className="flex items-start gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            {assignedWithInfo.length === 0 && !isOpen && (
              <div
                className="flex items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm transition-colors"
                style={{ minHeight: "2.5rem", ...(isDragOver ? { borderColor: color, color } : { borderColor: "#cbd5e1", color: "#94a3b8" }) }}
              >
                {isDragOver ? "Drop here" : "No assignment"}
              </div>
            )}
            {assignedWithInfo.map(({ asgn, emp }) => {
              const activeWaId = getAssignmentWorkAreaId(asgn, stations);
              const isLoaned = !!activeWaId && activeWaId !== emp.homeDepartmentId;
              const homeWaName = isLoaned ? workAreas?.find((w) => w.id === emp.homeDepartmentId)?.name : undefined;
              const genderViolation = genderRestriction && emp.gender && emp.gender !== genderRestriction;
              return (
                <div key={emp.id}>
                  <div className={genderViolation ? "rounded-md ring-2 ring-red-400" : undefined}>
                    <EmployeeCard
                      employee={emp}
                      stationId={stationId}
                      shiftCode={shiftCode}
                      modeCode={modeCode}
                      onRemove={() => onRemove(emp.id, stationId, shiftCode, modeCode)}
                      loanInfo={{ isLoanedIn: isLoaned, homeWaName }}
                      onDoubleClick={() => onEmployeeDoubleClick?.(emp.full_name)}
                      statusCode={statuses?.[emp.id]}
                    />
                  </div>
                  {genderViolation && (
                    <p className="mt-0.5 px-1 text-[10px] font-semibold text-red-500">
                      {genderRestriction === "M" ? "Male only" : "Female only"} — gender mismatch
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="shrink-0">
            <button
              ref={btnRef}
              onClick={handleOpen}
              className={`flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400 transition-all hover:border-slate-500 hover:text-slate-600 group-hover/cell:opacity-100 ${isOpen ? "opacity-100" : "opacity-0"}`}
            >
              +
            </button>
            {isOpen && (
              <div
                className="fixed z-50 w-72 rounded-xl border bg-white shadow-2xl"
                style={{ top: dropPos.top, left: dropPos.left }}
              >
                {/* Search */}
                <div className="p-2 pb-0">
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                {/* Tabs */}
                <div className="flex gap-1 px-2 pt-2">
                  <button
                    onClick={() => setTab("all")}
                    className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${tab === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                  >
                    {workAreas?.find((w) => w.id === workAreaId)?.name ?? "All"} ({assignedDeptPickable.length})
                  </button>
                  <button
                    onClick={() => setTab("unassigned")}
                    className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${tab === "unassigned" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                  >
                    Unassigned ({unassignedPickable.length})
                  </button>
                </div>
                {/* List */}
                <div className="overflow-y-auto p-2" style={{ maxHeight: listMaxHeight }}>
                  {filtered.length === 0 && (
                    <p className="px-3 py-3 text-center text-sm text-slate-400">
                      {search ? "No results" : "No staff available"}
                    </p>
                  )}
                  {filtered.map((emp) => {
                    const status = statuses?.[emp.id] ?? STATUS_CODE_AVAILABLE;
                    const statusCfg = statusConfigs?.find((c) => c.code === status) ?? statusConfigs?.find((c) => c.code === STATUS_CODE_AVAILABLE);
                    const empAssignCount = assignments.filter((a) => a.employee_id === emp.id).length;
                    const crossDept = isCrossDept(emp);
                    return (
                      <button
                        key={emp.id}
                        onClick={() => handleClickAssign(emp)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium text-slate-800 truncate">{emp.full_name}</span>
                          {emp.temporary && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">Temp</span>
                          )}
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          {crossDept && (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200">
                              {abbrevDept(workAreas?.find((w) => w.id === emp.homeDepartmentId)?.name ?? "")}
                            </span>
                          )}
                          {tab === "unassigned" ? (
                            <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={statusCfg ? cfgBadge(statusCfg).sty : undefined}>{statusCfg?.label ?? status}</span>
                          ) : (
                            empAssignCount > 0 && (
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-500">{empAssignCount}</span>
                            )
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
