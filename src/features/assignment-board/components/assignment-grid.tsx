"use client";

import React, { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/shared/modal";
import { DEFAULT_MODE_CODE } from "../types";
import type {
  Employee,
  ModeCode,
  ShiftCode,
  ShiftInfo,
  Station,
  StationAssignment,
  WorkArea,
  WorkAreaModeView,
  WorkAreaShiftMap,
} from "../types";
import { getAssignmentWorkAreaId } from "../utils";
import { AssignmentCell } from "./assignment-cell";
import type { StatusConfig } from "./status-select";
import { LoanTag } from "./loan-tag";
import { ShiftModal } from "./modals/shift-modal";
import { StationModal } from "./modals/station-modal";
import { WorkAreaModal } from "./modals/work-area-modal";

export function AssignmentGrid({ employees: employeesProp, statuses, disabledEmployeeIds, assignments: assignmentsProp, onAssign: onAssignProp, onUnassign: onUnassignProp, onClearWorkArea, stations: stationsProp, onStationsChange, onAddStation: onAddStationProp, onUpdateStation: onUpdateStationProp, onDeleteStation: onDeleteStationProp, onReorderStation: onReorderStationProp, onAddWorkArea: onAddWorkAreaProp, onUpdateWorkArea: onUpdateWorkAreaProp, onDeleteWorkArea: onDeleteWorkAreaProp, onAddShift: onAddShiftProp, onUpdateShift: onUpdateShiftProp, onDeleteShift: onDeleteShiftProp, workAreas: workAreasProp, onWorkAreasChange, workAreaShifts: workAreaShiftsProp, onWorkAreaShiftsChange, selectedWorkAreaId: selectedWorkAreaIdProp, onWorkAreaChange, defaultShifts: defaultShiftsProp, onEmployeeDoubleClick, statusConfigs, onOpenRoster }: { employees?: Employee[]; statuses?: Record<string, string>; disabledEmployeeIds?: Set<string>; assignments?: StationAssignment[]; onAssign?: (employeeId: string, stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) => void; onUnassign?: (employeeId: string, stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) => void; onClearWorkArea?: (workAreaId: string) => void; stations?: Station[]; onStationsChange?: (s: Station[]) => void; onAddStation?: (params: { workAreaId: string; name: string; group?: string; genderRestriction?: "M" | "F"; defaultEmployeeId?: string; modeCode: ModeCode }) => void; onUpdateStation?: (stationId: string, params: { name: string; group?: string; genderRestriction?: "M" | "F"; defaultEmployeeId?: string }) => void; onDeleteStation?: (stationId: string) => void; onReorderStation?: (draggedStationId: string, targetStationId: string) => void; onAddWorkArea?: (name: string, color: string, modeViews: WorkAreaModeView[]) => string; onUpdateWorkArea?: (id: string, name: string, color: string, modeViews: WorkAreaModeView[]) => void; onDeleteWorkArea?: (workAreaId: string) => void; onAddShift?: (workAreaId: string, modeCode: ModeCode, label: string, startTime: string, endTime: string) => void; onUpdateShift?: (workAreaId: string, modeCode: ModeCode, code: ShiftCode, label: string, startTime: string, endTime: string) => void; onDeleteShift?: (workAreaId: string, modeCode: ModeCode, code: ShiftCode) => void; workAreas?: WorkArea[]; onWorkAreasChange?: (wa: WorkArea[]) => void; workAreaShifts?: WorkAreaShiftMap; onWorkAreaShiftsChange?: (v: WorkAreaShiftMap) => void; selectedWorkAreaId?: string; onWorkAreaChange?: (id: string) => void; defaultShifts?: ShiftInfo[]; onEmployeeDoubleClick?: (name: string) => void; statusConfigs?: StatusConfig[]; onOpenRoster?: (search: string) => void } = {}) {
  const [localWorkAreas, setLocalWorkAreas] = useState<WorkArea[]>([]);
  const workAreas = workAreasProp ?? localWorkAreas;
  const setWorkAreas = (updater: WorkArea[] | ((prev: WorkArea[]) => WorkArea[])) => {
    const next = typeof updater === "function" ? updater(workAreas) : updater;
    setLocalWorkAreas(next);
    onWorkAreasChange?.(next);
  };
  const [localStations, setLocalStations] = useState<Station[]>([]);
  const stations = stationsProp ?? localStations;
  const setStations = (updater: Station[] | ((prev: Station[]) => Station[])) => {
    const next = typeof updater === "function" ? updater(stations) : updater;
    setLocalStations(next);
    onStationsChange?.(next);
  };
  const [localWorkAreaShifts, setLocalWorkAreaShifts] = useState<WorkAreaShiftMap>({});
  const workAreaShifts = workAreaShiftsProp ?? localWorkAreaShifts;
  const setWorkAreaShifts = (updater: WorkAreaShiftMap | ((prev: WorkAreaShiftMap) => WorkAreaShiftMap)) => {
    const next = typeof updater === "function" ? updater(workAreaShifts) : updater;
    setLocalWorkAreaShifts(next);
    onWorkAreaShiftsChange?.(next);
  };
  const [localAssignments] = useState<StationAssignment[]>([]);
  const assignments = assignmentsProp ?? localAssignments;
  const employees = (employeesProp ?? []).filter((e) => e.active);

  const [localSelectedWorkAreaId, setLocalSelectedWorkAreaId] = useState<string>("");
  const selectedWorkAreaId = selectedWorkAreaIdProp ?? localSelectedWorkAreaId;
  const [selectedMode, setSelectedMode] = useState<ModeCode>(DEFAULT_MODE_CODE);
  const lastSyncedWaIdRef = useRef<string>("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync selectedMode whenever the active work area changes externally
  // (e.g. via the ?workArea= deep link from the Daily Lineup dashboard).
  // Picks the work area's first declared mode_view so moded areas default
  // to Hog Break instead of the stale "normal" mode.
  useEffect(() => {
    if (!selectedWorkAreaIdProp) return;
    if (workAreas.length === 0) return;
    if (lastSyncedWaIdRef.current === selectedWorkAreaIdProp) return;
    lastSyncedWaIdRef.current = selectedWorkAreaIdProp;
    const wa = workAreas.find((w) => w.id === selectedWorkAreaIdProp);
    setSelectedMode(wa?.mode_views?.[0]?.mode_code ?? DEFAULT_MODE_CODE);
  }, [selectedWorkAreaIdProp, workAreas]);

  const [editingShift, setEditingShift] = useState<{ code: ShiftCode; label: string; startTime: string; endTime: string } | null>(null);
  const [addingShift, setAddingShift] = useState<{ label: string; startTime: string; endTime: string } | null>(null);

  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [addingStation, setAddingStation] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [editingGroupText, setEditingGroupText] = useState("");
  const [groupDeleteWarning, setGroupDeleteWarning] = useState<string | null>(null);

  const [dragStationId, setDragStationId] = useState<string | null>(null);
  const [dragOverStationId, setDragOverStationId] = useState<string | null>(null);

  const [workAreaModal, setWorkAreaModal] = useState<"add" | WorkArea | null>(null);
  const [confirmDeleteWorkArea, setConfirmDeleteWorkArea] = useState<WorkArea | null>(null);
  const [headerHover, setHeaderHover] = useState(false);
  const [loanPopover, setLoanPopover] = useState<{ entries: { name: string; dept: string }[]; label: string; top: number; left: number } | null>(null);
  const loanPopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loanPopover) return;
    const handler = (e: MouseEvent) => {
      if (loanPopoverRef.current && !loanPopoverRef.current.contains(e.target as Node)) {
        setLoanPopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [loanPopover]);

  const sortedWorkAreas = [...workAreas].sort((a, b) => a.display_order - b.display_order);
  const selectedWorkArea = workAreas.find((wa) => wa.id === selectedWorkAreaId) ?? workAreas[0];
  const hasModes = !!selectedWorkArea?.mode_views?.length;
  // Shifts are scoped by (workAreaId, modeCode). Non-moded work areas store
  // their shifts under DEFAULT_MODE_CODE. For moded work areas, `selectedMode`
  // may not yet match this work area's modes (e.g. on first mount, before any
  // tab click) — in that case, resolve to the work area's first declared mode.
  const waModeCodes = (selectedWorkArea?.mode_views?.map((mv) => mv.mode_code) ?? []) as ModeCode[];
  const currentModeCode: ModeCode = hasModes
    ? (waModeCodes.includes(selectedMode) ? selectedMode : (waModeCodes[0] ?? DEFAULT_MODE_CODE))
    : DEFAULT_MODE_CODE;
  const currentShifts: ShiftInfo[] = workAreaShifts[selectedWorkAreaId]?.[currentModeCode] ?? [];

  // TEMP DIAGNOSTIC — remove after verifying shift columns render
  console.log("[assignment-grid] shift lookup", {
    selectedWorkAreaId,
    selectedMode,
    currentModeCode,
    waModeKeys: Object.keys(workAreaShifts[selectedWorkAreaId] ?? {}),
    currentShifts,
  });

  const computeNextShiftDefaults = (): { startTime: string; endTime: string } => {
    const last = currentShifts[currentShifts.length - 1];
    if (!last) return { startTime: "06:00", endTime: "08:00" };
    const parts = last.time_range?.split("-");
    if (!parts || parts.length !== 2) return { startTime: "06:00", endTime: "08:00" };
    const [hStr, mStr] = parts[1].split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return { startTime: "06:00", endTime: "08:00" };
    const endH = (h + 2) % 24;
    const endStr = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return { startTime: parts[1], endTime: endStr };
  };
  const workAreaStations = stations
    .filter((s) => s.work_area_id === selectedWorkAreaId && (!hasModes || s.mode_code === selectedMode))
    .sort((a, b) => a.display_order - b.display_order);

  const selectWorkArea = (waId: string) => {
    setLocalSelectedWorkAreaId(waId);
    onWorkAreaChange?.(waId);
    const wa = workAreas.find((w) => w.id === waId);
    setSelectedMode(wa?.mode_views?.[0]?.mode_code ?? DEFAULT_MODE_CODE);
    setEditingShift(null);
    setAddingShift(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // ── Shift handlers ──
  const handleSaveEditShift = (label: string, startTime: string, endTime: string) => {
    if (!editingShift) return;
    if (onUpdateShiftProp) {
      onUpdateShiftProp(selectedWorkAreaId, currentModeCode, editingShift.code, label, startTime, endTime);
    } else {
      setWorkAreaShifts((prev) => ({
        ...prev,
        [selectedWorkAreaId]: {
          ...(prev[selectedWorkAreaId] ?? ({} as Record<ModeCode, ShiftInfo[]>)),
          [currentModeCode]: (prev[selectedWorkAreaId]?.[currentModeCode] ?? []).map((s) =>
            s.code === editingShift.code ? { ...s, label, time_range: startTime && endTime ? `${startTime}-${endTime}` : "" } : s,
          ),
        },
      }));
    }
    setEditingShift(null);
  };

  const slotHasAssignment = (stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) =>
    assignments.some((a) => a.station_id === stationId && a.shift_code === shiftCode && a.mode_code === modeCode);

  const handleAddShift = (label: string, startTime: string, endTime: string) => {
    if (onAddShiftProp) {
      onAddShiftProp(selectedWorkAreaId, currentModeCode, label, startTime, endTime);
    } else {
      const next = `shift_${crypto.randomUUID()}`;
      setWorkAreaShifts((prev) => ({
        ...prev,
        [selectedWorkAreaId]: {
          ...(prev[selectedWorkAreaId] ?? ({} as Record<ModeCode, ShiftInfo[]>)),
          [currentModeCode]: [
            ...(prev[selectedWorkAreaId]?.[currentModeCode] ?? []),
            { code: next, label, time_range: startTime && endTime ? `${startTime}-${endTime}` : "" },
          ],
        },
      }));
      stations
        .filter((s) => {
          if (s.work_area_id !== selectedWorkAreaId || !s.defaultEmployeeId) return false;
          const stationMode: ModeCode = (s.mode_code as ModeCode | undefined) ?? DEFAULT_MODE_CODE;
          return stationMode === currentModeCode;
        })
        .forEach((s) => {
          if (!slotHasAssignment(s.id, next, currentModeCode)) {
            handleAssign(s.defaultEmployeeId!, s.id, next, currentModeCode);
          }
        });
    }
    setAddingShift(null);
  };

  const handleDeleteShift = (code: ShiftCode) => {
    if (onDeleteShiftProp) {
      onDeleteShiftProp(selectedWorkAreaId, currentModeCode, code);
    } else {
      setWorkAreaShifts((prev) => ({
        ...prev,
        [selectedWorkAreaId]: {
          ...(prev[selectedWorkAreaId] ?? ({} as Record<ModeCode, ShiftInfo[]>)),
          [currentModeCode]: (prev[selectedWorkAreaId]?.[currentModeCode] ?? []).filter((s) => s.code !== code),
        },
      }));
      const stationIdSet = new Set(workAreaStations.map((s) => s.id));
      if (onUnassignProp) {
        assignments
          .filter(
            (a) =>
              a.station_id !== null &&
              stationIdSet.has(a.station_id) &&
              a.shift_code === code &&
              a.mode_code === currentModeCode,
          )
          .forEach((a) => onUnassignProp(a.employee_id, a.station_id!, a.shift_code, a.mode_code));
      } else {
        console.warn("[AssignmentGrid] onUnassign handler missing — shift assignment cleanup not saved");
      }
    }
  };

  // ── Assignment handlers ──
  const handleAssign = (employeeId: string, stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) => {
    if (onAssignProp) { onAssignProp(employeeId, stationId, shiftCode, modeCode); return; }
    console.warn("[AssignmentGrid] onAssign handler missing — assignment not saved");
  };

  const handleRemove = (employeeId: string, stationId: string, shiftCode: ShiftCode, modeCode: ModeCode) => {
    if (onUnassignProp) { onUnassignProp(employeeId, stationId, shiftCode, modeCode); return; }
    console.warn("[AssignmentGrid] onUnassign handler missing — removal not saved");
  };

  // ── Station handlers ──
  const handleSaveStation = (stationId: string, name: string, group: string, genderRestriction?: "M" | "F", defaultEmployeeId?: string) => {
    if (!name.trim()) return;
    if (onUpdateStationProp) {
      onUpdateStationProp(stationId, { name: name.trim(), group: group.trim() || undefined, genderRestriction, defaultEmployeeId });
    } else {
      const newGroup = group.trim() || undefined;
      const station = stations.find((s) => s.id === stationId);
      setStations((prev) => {
        const sorted = [...prev].sort((a, b) => a.display_order - b.display_order);
        const target = sorted.find((s) => s.id === stationId);
        if (!target || target.group === newGroup) {
          return prev.map((s) => s.id === stationId ? { ...s, name: name.trim(), group: newGroup, gender_restriction: genderRestriction, defaultEmployeeId: defaultEmployeeId ?? undefined } : s);
        }
        const sameArea = sorted.filter((s) => s.work_area_id === target.work_area_id && (!hasModes || s.mode_code === target.mode_code));
        const groupStations = newGroup ? sameArea.filter((s) => s.id !== stationId && s.group === newGroup) : [];
        let insertAfterOrder: number;
        if (groupStations.length > 0) {
          insertAfterOrder = groupStations[groupStations.length - 1].display_order;
        } else {
          insertAfterOrder = sameArea[sameArea.length - 1]?.display_order ?? 0;
        }
        const withoutTarget = sameArea.filter((s) => s.id !== stationId);
        const updated = withoutTarget.map((s) => ({ ...s }));
        const insertIdx = updated.findIndex((s) => s.display_order === insertAfterOrder);
        updated.splice(insertIdx + 1, 0, { ...target, name: name.trim(), group: newGroup, gender_restriction: genderRestriction, defaultEmployeeId: defaultEmployeeId ?? undefined });
        updated.forEach((s, i) => { s.display_order = i + 1; });
        return prev.map((s) => updated.find((u) => u.id === s.id) ?? s);
      });
      if (defaultEmployeeId && station) {
        const modeCode: ModeCode = (station.mode_code as ModeCode | undefined) ?? DEFAULT_MODE_CODE;
        (workAreaShifts[station.work_area_id]?.[modeCode] ?? []).forEach((shift) => {
          if (!slotHasAssignment(stationId, shift.code, modeCode)) {
            handleAssign(defaultEmployeeId, stationId, shift.code, modeCode);
          }
        });
      }
    }
    setEditingStationId(null);
  };

  // ── Group handlers ──
  const handleDeleteGroup = (groupName: string) => {
    const hasStations = workAreaStations.some((s) => s.group === groupName);
    if (hasStations) {
      setGroupDeleteWarning(groupName);
      return;
    }
    setStations((prev) => prev.map((s) =>
      s.work_area_id === selectedWorkAreaId &&
      (!hasModes || s.mode_code === selectedMode) &&
      s.group === groupName
        ? { ...s, group: undefined }
        : s,
    ));
  };

  const handleAddStation = (name: string, group: string, genderRestriction?: "M" | "F", defaultEmployeeId?: string) => {
    const modeCode: ModeCode = hasModes ? selectedMode : DEFAULT_MODE_CODE;
    if (onAddStationProp) {
      onAddStationProp({ workAreaId: selectedWorkAreaId, name, group: group || undefined, genderRestriction, defaultEmployeeId, modeCode });
    } else {
      const stationId = `st_${crypto.randomUUID()}`;
      setStations((prev) => [...prev, {
        id: stationId,
        work_area_id: selectedWorkAreaId,
        name,
        required_headcount: 1,
        display_order: workAreaStations.length + 1,
        ...(hasModes ? { mode_code: selectedMode } : {}),
        ...(group ? { group } : {}),
        ...(genderRestriction ? { gender_restriction: genderRestriction } : {}),
        ...(defaultEmployeeId ? { defaultEmployeeId } : {}),
      }]);
      if (defaultEmployeeId) {
        currentShifts.forEach((shift) => {
          if (!slotHasAssignment(stationId, shift.code, modeCode)) {
            handleAssign(defaultEmployeeId, stationId, shift.code, modeCode);
          }
        });
      }
    }
    setAddingStation(false);
  };

  const handleSaveGroupName = (oldName: string) => {
    if (!editingGroupText.trim() || editingGroupText.trim() === oldName) {
      setEditingGroupKey(null);
      return;
    }
    setStations((prev) => prev.map((s) =>
      s.work_area_id === selectedWorkAreaId &&
      (!hasModes || s.mode_code === selectedMode) &&
      s.group === oldName
        ? { ...s, group: editingGroupText.trim() }
        : s,
    ));
    setEditingGroupKey(null);
  };

  const handleStationDrop = (targetStationId: string) => {
    if (!dragStationId || dragStationId === targetStationId) return;
    if (onReorderStationProp) {
      onReorderStationProp(dragStationId, targetStationId);
    } else {
      setStations((prev) => {
        const sorted = [...prev].sort((a, b) => a.display_order - b.display_order);
        const dragged = sorted.find((s) => s.id === dragStationId);
        const target = sorted.find((s) => s.id === targetStationId);
        if (!dragged || !target) return prev;
        const sameArea = sorted.filter((s) => s.work_area_id === dragged.work_area_id && (!hasModes || s.mode_code === dragged.mode_code));
        const draggedOriginalIdx = sameArea.findIndex((s) => s.id === dragStationId);
        const targetOriginalIdx = sameArea.findIndex((s) => s.id === targetStationId);
        const movingUp = draggedOriginalIdx > targetOriginalIdx;
        if (dragged.protected) return prev;
        if (movingUp && target.protected) return prev;
        const withoutDragged = sameArea.filter((s) => s.id !== dragStationId);
        const targetIdx = withoutDragged.findIndex((s) => s.id === targetStationId);
        withoutDragged.splice(movingUp ? targetIdx : targetIdx + 1, 0, { ...dragged, group: target.group });
        withoutDragged.forEach((s, i) => { s.display_order = i + 1; });
        return prev.map((s) => withoutDragged.find((u) => u.id === s.id) ?? s);
      });
    }
    setDragStationId(null);
    setDragOverStationId(null);
  };

  const handleDeleteStation = (stationId: string) => {
    if (onDeleteStationProp) {
      onDeleteStationProp(stationId);
    } else {
      setStations((prev) => prev.filter((s) => s.id !== stationId));
      if (onUnassignProp) {
        assignments.filter((a) => a.station_id === stationId).forEach((a) => onUnassignProp(a.employee_id, a.station_id!, a.shift_code, a.mode_code));
      } else {
        console.warn("[AssignmentGrid] onUnassign handler missing — station assignment cleanup not saved");
      }
    }
  };

  // ── Work area handlers ──
  const handleSaveWorkArea = (name: string, color: string, modeViews: WorkAreaModeView[]) => {
    if (workAreaModal === "add") {
      if (onAddWorkAreaProp) {
        const newId = onAddWorkAreaProp(name, color, modeViews);
        setWorkAreaModal(null);
        selectWorkArea(newId);
        if (modeViews.length > 0) setSelectedMode(modeViews[0].mode_code as ModeCode);
      } else {
        const newWa: WorkArea = { id: `wa_${crypto.randomUUID()}`, name, color_hex: color, display_order: workAreas.length + 1, mode_views: modeViews.length ? modeViews : undefined };
        setWorkAreas((prev) => [...prev, newWa]);
        const seedTemplate: ShiftInfo[] = defaultShiftsProp ?? [];
        const seedModeCodes: ModeCode[] = modeViews.length
          ? (modeViews.map((mv) => mv.mode_code) as ModeCode[])
          : [DEFAULT_MODE_CODE];
        const seedPerMode = {} as Record<ModeCode, ShiftInfo[]>;
        for (const modeCode of seedModeCodes) seedPerMode[modeCode] = seedTemplate.map((s) => ({ ...s }));
        setWorkAreaShifts((prev) => ({ ...prev, [newWa.id]: seedPerMode }));
        setWorkAreaModal(null);
        selectWorkArea(newWa.id);
        if (modeViews.length > 0) setSelectedMode(modeViews[0].mode_code as ModeCode);
      }
    } else if (workAreaModal && typeof workAreaModal === "object") {
      if (onUpdateWorkAreaProp) {
        onUpdateWorkAreaProp(workAreaModal.id, name, color, modeViews);
      } else {
        setWorkAreas((prev) => prev.map((wa) => wa.id === workAreaModal.id ? { ...wa, name, color_hex: color, mode_views: modeViews.length ? modeViews : undefined } : wa));
      }
      // Switch to first mode if modes were just enabled
      if (modeViews.length > 0 && !workAreaModal.mode_views?.length) {
        setSelectedMode(modeViews[0].mode_code as ModeCode);
      }
      setWorkAreaModal(null);
    }
  };

  const handleDeleteWorkArea = (wa: WorkArea) => {
    const remaining = workAreas.filter((w) => w.id !== wa.id);
    if (onDeleteWorkAreaProp) {
      onDeleteWorkAreaProp(wa.id);
    } else {
      setWorkAreas((prev) => prev.filter((w) => w.id !== wa.id));
      setStations((prev) => prev.filter((s) => s.work_area_id !== wa.id));
      console.warn("[AssignmentGrid] onUnassign handler missing — work area assignment cleanup not saved");
      setWorkAreaShifts((prev) => { const next = { ...prev }; delete next[wa.id]; return next; });
    }
    if (remaining.length > 0) selectWorkArea(remaining[0].id);
    setConfirmDeleteWorkArea(null);
    setWorkAreaModal(null);
  };

  const color = selectedWorkArea?.color_hex ?? "#334155";

  const showEmptyDeptState = sortedWorkAreas.length === 0;
  const needsShifts = currentShifts.length === 0;
  const needsStations = workAreaStations.filter((s) => !s.protected).length === 0;
  const needsEmployees = employees.length === 0;
  const showEmptyBoardHint =
    !showEmptyDeptState && (needsShifts || needsStations || needsEmployees);

  return (
    <div className="flex h-full min-w-0 flex-col gap-4" onClick={() => setLoanPopover(null)}>
      {showEmptyDeptState ? (
        <div className="flex h-full flex-col items-center justify-center">
          <div className="max-w-md rounded-xl border-2 border-dashed border-slate-300 bg-white px-10 py-12 text-center shadow-sm">
            <h2 className="text-base font-bold text-slate-700">No departments yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Create your first department to get started. You&apos;ll be able to add shifts and stations next.
            </p>
            <button
              onClick={() => setWorkAreaModal("add")}
              className="mt-6 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              + Add Department
            </button>
          </div>
        </div>
      ) : (
        <>
      {/* Work Area Tabs */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
        {sortedWorkAreas.map((wa) => (
          <button key={wa.id} onClick={() => selectWorkArea(wa.id)} onDoubleClick={() => setWorkAreaModal(wa)} title="Double-click to edit"
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-all md:px-4 md:py-2 md:text-sm"
            style={selectedWorkAreaId === wa.id ? { backgroundColor: wa.color_hex ?? "#334155", color: "#fff" } : { backgroundColor: "#fff", color: "#475569", border: "1px solid #e2e8f0" }}>
            {wa.name}
          </button>
        ))}
        <button onClick={() => setWorkAreaModal("add")}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 md:px-4 md:py-2 md:text-sm">
          + Add Dept
        </button>
        </div>
        <button
          onClick={() => setConfirmClear(true)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors md:mr-8 md:px-4 md:text-sm"
        >
          Clear All
        </button>
      </div>

      {/* Mode toggle */}
      {hasModes && (
        <div className="shrink-0 flex items-center gap-2">
{selectedWorkArea.mode_views!.map((mv) => (
            <button
              key={mv.mode_code}
              onClick={() => setSelectedMode(mv.mode_code)}
              className="rounded px-4 py-1.5 text-sm font-medium transition-all"
              style={
                selectedMode === mv.mode_code
                  ? { backgroundColor: "#1e293b", color: "#fff" }
                  : { backgroundColor: "#f1f5f9", color: "#475569" }
              }
            >
              {mv.label}{mv.time_range ? ` (${mv.time_range})` : ""}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="relative min-h-0 flex-1 flex flex-col items-stretch gap-2 md:flex-row md:items-start">
        {!needsShifts && (
          <>
        <div
          ref={scrollContainerRef}
          className="min-h-0 min-w-0 h-full flex-1 overflow-auto rounded-lg border border-slate-300 bg-white"
          style={{
            backgroundImage:
              "linear-gradient(to right, transparent calc(10.5rem - 1px), #e2e8f0 calc(10.5rem - 1px), #e2e8f0 10.5rem, transparent 10.5rem)",
          }}
        >
        <table className="w-full table-fixed border-separate border-spacing-0" style={{ minWidth: `calc(10.5rem + ${currentShifts.length} * 280px)` }}>
          <thead className="sticky top-0 z-30" onMouseEnter={() => setHeaderHover(true)} onMouseLeave={() => setHeaderHover(false)}>
            <tr>
              {/* Station label */}
              <th className="group/stnhdr sticky left-0 z-10 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white" style={{ width: "10.5rem", minWidth: "10.5rem", maxWidth: "10.5rem", backgroundColor: color }}>
                <div className="flex items-center justify-between gap-2">
                  <span>Station</span>
                  <button onClick={() => setAddingStation(true)} title="Add station" disabled={needsShifts}
                    className={`flex h-5 w-5 items-center justify-center rounded border border-dashed border-white/30 text-white/80 hover:border-white hover:text-white text-xs transition-opacity disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/30 disabled:hover:text-white/80 ${needsStations && !needsShifts ? "opacity-100" : "opacity-0 group-hover/stnhdr:opacity-100"}`}>
                    +
                  </button>
                </div>
              </th>

              {/* Shift column headers */}
              {currentShifts.map((shift) => {
                const shiftAssignments = assignments.filter(
                  (a) => a.shift_code === shift.code && (!hasModes || a.mode_code === selectedMode)
                );
                // loanedIn: cross-dept employees assigned to this work area (mode-filtered, they're in our stations)
                const loanedInEmps = [...new Set(
                  shiftAssignments
                    .filter((a) =>
                      getAssignmentWorkAreaId(a, stations) === selectedWorkAreaId &&
                      employees.find((e) => e.id === a.employee_id)?.homeDepartmentId !== selectedWorkAreaId
                    )
                    .map((a) => a.employee_id)
                )].flatMap((id) => { const e = employees.find((e) => e.id === id); if (!e) return []; const dept = workAreas.find((w) => w.id === e.homeDepartmentId)?.name ?? ""; return [{ name: e.full_name, dept }]; });
                // loanedOut: home dept employees working elsewhere (mode-filtered, loaned-out assignments are migrated to match mode)
                const loanedOutEmps = [...new Set(
                  shiftAssignments
                    .filter((a) =>
                      getAssignmentWorkAreaId(a, stations) !== selectedWorkAreaId &&
                      employees.find((e) => e.id === a.employee_id)?.homeDepartmentId === selectedWorkAreaId
                    )
                    .map((a) => a.employee_id)
                )].flatMap((id) => { const e = employees.find((e) => e.id === id); if (!e) return []; const asgn = shiftAssignments.find((a) => a.employee_id === id && getAssignmentWorkAreaId(a, stations) !== selectedWorkAreaId); const dept = workAreas.find((w) => asgn && w.id === getAssignmentWorkAreaId(asgn, stations))?.name ?? ""; return [{ name: e.full_name, dept }]; });
                const loanedIn = loanedInEmps.length;
                const loanedOut = loanedOutEmps.length;
                return (
                  <th key={shift.code} className="group/col whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-white" style={{ backgroundColor: color, width: `calc((100% - 10.5rem) / ${currentShifts.length})`, minWidth: "280px" }}>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="cursor-pointer whitespace-nowrap hover:opacity-80"
                          onDoubleClick={() => {
                            const [start, end] = (shift.time_range ?? "").split("-");
                            setEditingShift({ code: shift.code, label: shift.label, startTime: start ?? "", endTime: end ?? "" });
                          }}
                          title="Double-click to edit">
                          {shift.label}
                          {shift.time_range && <span className="ml-1.5 text-xs font-normal opacity-80 whitespace-nowrap">{shift.time_range}</span>}
                        </span>
                        {loanedIn > 0 && (
                          <LoanTag
                            direction="in"
                            count={loanedIn}
                            onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setLoanPopover((prev) => prev?.label === `in-${shift.code}` ? null : { entries: loanedInEmps, label: `in-${shift.code}`, top: r.bottom + 6, left: r.left }); }}
                          />
                        )}
                        {loanedOut > 0 && (
                          <LoanTag
                            direction="out"
                            count={loanedOut}
                            onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setLoanPopover((prev) => prev?.label === `out-${shift.code}` ? null : { entries: loanedOutEmps, label: `out-${shift.code}`, top: r.bottom + 6, left: r.left }); }}
                          />
                        )}
                      </div>
                      <button onClick={() => handleDeleteShift(shift.code)}
                        className="ml-auto hidden text-white/50 hover:text-white group-hover/col:block">×</button>
                    </div>
                  </th>
                );
              })}

            </tr>
          </thead>

          <tbody style={{ backgroundColor: "#ffffff" }}>
            {(() => {
              let prevGroup: string | undefined = "__init__";
              return workAreaStations.map((station, idx) => {
                const showGroupHeader = station.group !== undefined && station.group !== prevGroup;
                prevGroup = station.group;
                const defaultEmployee = station.defaultEmployeeId ? employees.find((e) => e.id === station.defaultEmployeeId) : null;
                const defaultAssigned = defaultEmployee
                  ? assignments.some((a) => a.station_id === station.id && a.employee_id === defaultEmployee.id)
                  : false;
                const isLast = idx === workAreaStations.length - 1;
                return (
                  <React.Fragment key={station.id}>
                    {showGroupHeader && (
                      <tr className="group/grp">
                        <td
                          colSpan={currentShifts.length + 1}
                          className="border-t border-b py-0.5 pl-5 text-left"
                          style={{ borderTopColor: "#e2e8f0", borderBottomColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}
                        >
                          {editingGroupKey === station.group ? (
                            <input
                              value={editingGroupText}
                              onChange={(e) => setEditingGroupText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveGroupName(station.group!); if (e.key === "Escape") setEditingGroupKey(null); }}
                              onBlur={() => handleSaveGroupName(station.group!)}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 outline-none text-center"
                              autoFocus
                            />
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="cursor-pointer text-xs font-semibold uppercase tracking-wider hover:opacity-80"
                                style={{ color: color + "b3", letterSpacing: "0.08em" }}
                                onDoubleClick={() => { setEditingGroupKey(station.group!); setEditingGroupText(station.group!); }}
                                title="Double-click to rename"
                              >
                                {station.group}
                              </span>
                              <button
                                onClick={() => handleDeleteGroup(station.group!)}
                                className="invisible rounded px-1 text-xs group-hover/grp:visible transition-colors"
                                style={{ color: color + "80" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = color + "22"; (e.currentTarget as HTMLButtonElement).style.color = color; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""; (e.currentTarget as HTMLButtonElement).style.color = color + "80"; }}
                                title="Remove group (ungroup stations)"
                              >
                                ×
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`group border-t transition-colors ${dragOverStationId === station.id && dragStationId !== station.id ? "outline-2 -outline-offset-2" : ""}`}
                      style={{ borderColor: "#e2e8f0", outlineColor: color }}
                      draggable={!station.protected && editingStationId !== station.id}
                      onDragStart={() => setDragStationId(station.id)}
                      onDragEnd={() => { setDragStationId(null); setDragOverStationId(null); }}
                      onDragOver={(e) => { e.preventDefault(); if (dragStationId) setDragOverStationId(station.id); }}
                      onDragLeave={() => setDragOverStationId(null)}
                      onDrop={() => handleStationDrop(station.id)}
                    >
                {/* Station name */}
                <td className={`group/stnname sticky left-0 z-20 border-t border-r border-slate-200 bg-white px-5 py-4 align-top group-hover:bg-slate-50 ${isLast ? "border-b" : ""}`} style={{ borderTopColor: "#e2e8f0", borderBottomColor: "#e2e8f0", width: "10.5rem", minWidth: "10.5rem", maxWidth: "10.5rem" }}>
                  {station.protected ? (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className="cursor-pointer text-sm font-semibold text-slate-800 hover:text-slate-600"
                        onDoubleClick={() => setEditingStationId(station.id)}
                        title="Double-click to set default employee"
                      >{station.name}</span>
                      {station.gender_restriction && (
                        <span className={`self-start rounded px-1.5 py-0.5 text-[10px] font-bold ${station.gender_restriction === "M" ? "bg-sky-100 text-sky-600" : "bg-rose-100 text-rose-500"}`}>
                          {station.gender_restriction === "M" ? "M only" : "F only"}
                        </span>
                      )}
                      {defaultEmployee && (
                        <span
                          className="max-w-full truncate text-[10px] text-slate-400"
                          title={defaultAssigned ? `Default: ${defaultEmployee.full_name}` : `Default: ${defaultEmployee.full_name} (not currently assigned)`}
                        >
                          {!defaultAssigned && <span className="text-red-500">⚠ </span>}{defaultEmployee.full_name}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="cursor-pointer text-sm italic text-slate-600 hover:text-slate-900"
                          onDoubleClick={() => setEditingStationId(station.id)}
                          title="Double-click to edit">
                          {station.name}
                        </span>
                        {station.gender_restriction && (
                          <span className={`self-start rounded px-1.5 py-0.5 text-[10px] font-bold ${station.gender_restriction === "M" ? "bg-sky-100 text-sky-600" : "bg-rose-100 text-rose-500"}`}>
                            {station.gender_restriction === "M" ? "M only" : "F only"}
                          </span>
                        )}
                        {defaultEmployee && (
                          <span
                            className="max-w-full truncate text-[10px] text-slate-400"
                            title={defaultAssigned ? `Default: ${defaultEmployee.full_name}` : `Default: ${defaultEmployee.full_name} (not currently assigned)`}
                          >
                            {!defaultAssigned && <span className="text-red-500">⚠ </span>}{defaultEmployee.full_name}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteStation(station.id)}
                        className="invisible ml-auto rounded px-1 text-xs group-hover/stnname:visible transition-colors"
                        style={{ color: color + "80" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = color + "22"; (e.currentTarget as HTMLButtonElement).style.color = color; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""; (e.currentTarget as HTMLButtonElement).style.color = color + "80"; }}
                      >×</button>
                    </div>
                  )}
                </td>

                {/* Assignment cells */}
                {currentShifts.map((shift) => (
                  <td key={shift.code} className={`h-px border-t border-black/6 p-0 align-top ${isLast ? "border-b border-b-black/6" : ""}`}>
                    <div className="h-full px-2 py-4">
                      <AssignmentCell stationId={station.id} shiftCode={shift.code} modeCode={selectedMode} color={color}
                        assignments={assignments} allEmployees={employees} statuses={statuses} disabledEmployeeIds={disabledEmployeeIds} onAssign={handleAssign} onRemove={handleRemove} workAreaId={selectedWorkArea.id} workAreas={workAreas} stations={stations} workAreaShifts={workAreaShifts} genderRestriction={station.gender_restriction} onEmployeeDoubleClick={onEmployeeDoubleClick} statusConfigs={statusConfigs} />
                    </div>
                  </td>
                ))}

              </tr>
                  </React.Fragment>
                );
              });
            })()}
          </tbody>

        </table>
        </div>
        <button
          onClick={() => setAddingShift({ label: "", startTime: "", endTime: "" })}
          onMouseEnter={() => setHeaderHover(true)}
          onMouseLeave={() => setHeaderHover(false)}
          className={`shrink-0 mt-3 flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-500 hover:border-slate-500 hover:text-slate-700 text-base leading-none transition-opacity ${headerHover || currentShifts.length === 0 ? "opacity-100" : "opacity-100 md:opacity-0"}`}
          title="Add shift"
        >
          +
        </button>
          </>
        )}
        {showEmptyBoardHint && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto max-w-md rounded-xl border-2 border-dashed border-slate-300 bg-white/95 px-8 py-6 text-center shadow-sm">
              <h3 className="text-sm font-bold text-slate-700">
                {needsShifts
                  ? "Step 1 — Add a shift"
                  : needsStations
                    ? "Step 2 — Add a station"
                    : "Step 3 — Add an employee"}
              </h3>
              <p className="mt-1.5 text-xs text-slate-500">
                {needsShifts
                  ? "Add at least one shift column before creating stations."
                  : needsStations
                    ? "Add at least one station to start assigning employees."
                    : "Add employees to your roster to start assigning them to stations."}
              </p>
              <div className="mt-4 flex justify-center">
                {needsShifts ? (
                  <button
                    onClick={() => setAddingShift({ label: "", startTime: "", endTime: "" })}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    + Add Shift
                  </button>
                ) : needsStations ? (
                  <button
                    onClick={() => setAddingStation(true)}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    + Add Station
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenRoster?.("")}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    + Add Employee
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Datalist for group autocomplete — must be outside <table> */}
      <datalist id="group-datalist">
        {Array.from(new Set(
          workAreaStations.filter((s) => s.group).map((s) => s.group as string)
        )).map((g) => <option key={g} value={g} />)}
      </datalist>

      {/* Group Delete Warning */}
      {groupDeleteWarning && (
        <Modal
          title="Cannot Delete Group"
          onClose={() => setGroupDeleteWarning(null)}
          footer={
            <div className="flex justify-end">
              <button onClick={() => setGroupDeleteWarning(null)} className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Got it
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                Group <span className="text-amber-700">"{groupDeleteWarning}"</span> still has stations.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Remove all stations in this group before deleting it.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Shift Modal */}
      {addingShift !== null && (() => {
        const defaults = computeNextShiftDefaults();
        return (
          <ShiftModal
            defaultStart={defaults.startTime}
            defaultEnd={defaults.endTime}
            onClose={() => setAddingShift(null)}
            onSave={(label, startTime, endTime) => handleAddShift(label, startTime || defaults.startTime, endTime || defaults.endTime)}
          />
        );
      })()}

      {/* Edit Shift Modal */}
      {editingShift !== null && (
        <ShiftModal initial={editingShift} onClose={() => setEditingShift(null)} onSave={handleSaveEditShift} />
      )}

      {/* Edit Station Modal */}
      {editingStationId !== null && (() => {
        const s = stations.find((s) => s.id === editingStationId);
        if (!s) return null;
        return (
          <StationModal
            employees={employees}
            workAreaId={selectedWorkAreaId}
            workAreas={workAreas}
            defaultOnly={s.protected}
            initial={{ name: s.name, group: s.group ?? "", genderRestriction: s.gender_restriction, defaultEmployeeId: s.defaultEmployeeId }}
            existingGroups={Array.from(new Set(workAreaStations.filter((st) => st.group).map((st) => st.group as string)))}
            onClose={() => setEditingStationId(null)}
            onSave={(name: string, group: string, genderRestriction?: "M" | "F", defaultEmployeeId?: string) => handleSaveStation(editingStationId, name, group, genderRestriction, defaultEmployeeId)}
          />
        );
      })()}

      {/* Add Station Modal */}
      {addingStation && (
        <StationModal
          employees={employees}
          workAreaId={selectedWorkAreaId}
          workAreas={workAreas}
          existingGroups={Array.from(new Set(
            workAreaStations.filter((s) => s.group).map((s) => s.group as string)
          ))}
          onClose={() => setAddingStation(false)}
          onSave={handleAddStation}
        />
      )}

      {/* Work Area Modal */}
      {workAreaModal && (
        <WorkAreaModal
          initial={workAreaModal === "add" ? undefined : workAreaModal}
          onClose={() => setWorkAreaModal(null)}
          onSave={handleSaveWorkArea}
          onDelete={workAreaModal !== "add" ? () => setConfirmDeleteWorkArea(workAreaModal) : undefined}
        />
      )}

      {/* Delete Work Area Confirm */}
      {confirmDeleteWorkArea && (() => {
        const waStations = stations.filter((s) => s.work_area_id === confirmDeleteWorkArea.id);
        const assignedEmpIds = new Set(assignments.filter((a) => waStations.some((s) => s.id === a.station_id)).map((a) => a.employee_id));
        const homeEmployees = (employeesProp ?? []).filter((e) => e.homeDepartmentId === confirmDeleteWorkArea.id);
        const blocked = homeEmployees.length > 0;
        return (
          <Modal
            title="Delete Department"
            onClose={() => setConfirmDeleteWorkArea(null)}
            footer={
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDeleteWorkArea(null)} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteWorkArea(confirmDeleteWorkArea)}
                  disabled={blocked}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-600"
                >
                  Delete Permanently
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    Delete <span className="text-red-600">"{confirmDeleteWorkArea.name}"</span>?
                  </p>
                  <p className="mt-1 text-sm text-slate-500">This cannot be undone.</p>
                </div>
              </div>
              {blocked && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Cannot delete</p>
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">{homeEmployees.length}</span> employee{homeEmployees.length > 1 ? "s have" : " has"} this as their home department. Reassign their home department before deleting.
                  </p>
                </div>
              )}
              {!blocked && (waStations.length > 0 || assignedEmpIds.size > 0) && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Will also be deleted</p>
                  {waStations.length > 0 && (
                    <p className="text-sm text-red-700">• <span className="font-semibold">{waStations.length}</span> station{waStations.length > 1 ? "s" : ""}</p>
                  )}
                  {assignedEmpIds.size > 0 && (
                    <p className="text-sm text-red-700">• <span className="font-semibold">{assignedEmpIds.size}</span> employee assignment{assignedEmpIds.size > 1 ? "s" : ""}</p>
                  )}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Clear All Confirm */}
      {confirmClear && (
        <Modal title="Clear All Assignments" onClose={() => setConfirmClear(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmClear(false)} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => { onClearWorkArea?.(selectedWorkAreaId); setConfirmClear(false); }}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Clear All
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Remove all assignments?</p>
              <p className="mt-1 text-sm text-slate-500">
                All station assignments in <span className="font-medium text-slate-700">{selectedWorkArea?.name}</span> will be cleared. This cannot be undone.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Loan popover */}
      {loanPopover && (
        <div
          ref={loanPopoverRef}
          className="fixed z-50 min-w-36 rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ top: loanPopover.top, left: loanPopover.left }}
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {loanPopover.label.startsWith("in") ? "Support In" : "Loaned Out"}
            </p>
          </div>
          <div className="p-1.5">
            {loanPopover.entries.map(({ name, dept }) => {
              const abbrev = dept.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("");
              return (
                <div key={name} className="flex items-center justify-between gap-4 px-2.5 py-1.5">
                  <span className="text-sm font-medium text-slate-700">{name}</span>
                  {abbrev && <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">{abbrev}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
