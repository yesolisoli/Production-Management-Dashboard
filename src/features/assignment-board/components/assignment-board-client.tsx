"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SUPABASE_ENABLED } from "@/lib/config";
import { useAssignmentBoardData } from "../hooks/use-assignment-board-data";
import { useSnapshotCapture } from "../hooks/use-snapshot-capture";
import { AssignmentGrid } from "./assignment-grid";
import { AssignmentSidebar } from "./assignment-sidebar";
import { TVDisplay } from "./tv-display";
import { RosterManageModal } from "./modals/roster-manage-modal";
import { ManageStatusesModal } from "./modals/manage-statuses-modal";

export function AssignmentBoardClient() {
  const {
    statusConfigs,
    handleUpdateStatusConfig,
    handleDeleteStatusConfig,
    handleAddStatusConfig,
    handleReorderStatusConfig,
    announcement,
    handleAnnouncementChange,
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
    disabledIds,
    defaultShiftTemplate,
    handleDeleteShift,
    handleUpdateShift,
    handleAddShift,
    handleDeleteWorkArea,
    handleUpdateWorkArea,
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
  } = useAssignmentBoardData();

  useSnapshotCapture({
    enabled: SUPABASE_ENABLED && !isHydrating,
    snapshot: {
      employees,
      statuses,
      assignments,
      stations,
      workAreas,
      workAreaShifts,
      statusConfigs,
    },
    workAreaShifts,
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showTV, setShowTV] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState(announcement);
  const [showManageStatuses, setShowManageStatuses] = useState(false);

  useEffect(() => {
    const handler = () => setShowTV(true);
    window.addEventListener("tv-open", handler);
    return () => window.removeEventListener("tv-open", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setAnnouncementDraft(announcement);
      setShowAnnouncementModal(true);
    };
    window.addEventListener("announcement-edit", handler);
    return () => window.removeEventListener("announcement-edit", handler);
  }, [announcement]);

  if (isHydrating) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
          Loading assignment board...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          <p className="font-semibold">Could not load assignment board</p>
          <p className="mt-1 wrap-break-word text-xs text-red-600">{loadError}</p>
          <p className="mt-3 text-xs text-red-500">
            Check Supabase connectivity and reload the page. The board is intentionally blank to avoid showing stale or mock data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {saveError && (
        <div
          role="alert"
          className="fixed top-3 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-md"
        >
          <div className="flex flex-col">
            <span className="font-semibold">Last save didn&apos;t go through</span>
            <span className="mt-0.5 text-xs text-amber-800">
              {saveError.context}: {saveError.message}
            </span>
          </div>
          <button
            type="button"
            onClick={clearSaveError}
            aria-label="Dismiss"
            className="ml-2 -mr-1 rounded px-1 text-base leading-none text-amber-700 hover:bg-amber-100 hover:text-amber-900"
          >
            ×
          </button>
        </div>
      )}

      {showTV && (
        <TVDisplay
          employees={employees}
          statuses={statuses}
          assignments={assignments}
          stations={stations}
          workAreas={workAreas}
          shifts={Object.values(workAreaShifts).flatMap((perMode) => Object.values(perMode)).flat().filter((s, i, arr) => arr.findIndex((x) => x.code === s.code) === i)}
          workAreaShifts={workAreaShifts}
          statusConfigs={statusConfigs}
          announcement={announcement}
          onClose={() => setShowTV(false)}
        />
      )}

      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAnnouncementModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-bold text-slate-800">Edit Announcement</h2>
            <textarea
              autoFocus
              value={announcementDraft}
              onChange={(e) => setAnnouncementDraft(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none resize-none"
              placeholder="Enter announcement for TV display..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAnnouncementModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => { handleAnnouncementChange(announcementDraft); setShowAnnouncementModal(false); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {showManageStatuses && (
        <ManageStatusesModal
          configs={statusConfigs}
          onUpdate={handleUpdateStatusConfig}
          onDelete={handleDeleteStatusConfig}
          onAdd={handleAddStatusConfig}
          onReorder={handleReorderStatusConfig}
          onClose={() => setShowManageStatuses(false)}
        />
      )}

      <div className="flex h-full items-stretch gap-0">
        {/* Sidebar + collapse toggle */}
        <div className={`relative flex shrink-0 transition-all duration-300 ${sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "w-72 opacity-100"}`}>
          <AssignmentSidebar
            employees={employees}
            statuses={statuses}
            assignments={assignments}
            stations={stations}
            workAreas={workAreas}
            selectedWorkAreaId={selectedWorkAreaId}
            statusConfigs={statusConfigs}
            onAdd={handleAdd}
            onRemove={handleRemoveEmployee}
            onUpdate={handleUpdate}
            onSetQualifiedWorkAreas={handleSetQualifiedWorkAreas}
            onStatusChange={handleStatusChange}
            onAssignToStation={handleQuickAssign}
            onUnassignAll={handleUnassignAll}
            onUnassignFromStation={handleUnassignFromStation}
            getEmployeeEffectiveDepartmentIds={getEmployeeEffectiveDepartmentIds}
            onOpenRoster={(search) => { setRosterSearch(search); setRosterOpen(true); }}
            onManageStatuses={() => setShowManageStatuses(true)}
          />
        </div>

        {/* Collapsed bar / toggle */}
        {sidebarCollapsed ? (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="group relative flex h-full w-4 shrink-0 cursor-pointer flex-col items-center justify-center gap-1"
            title="Show sidebar"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full bg-slate-200 transition-colors group-hover:bg-slate-400" />
            <div className="relative z-10 flex h-7 w-4 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors group-hover:border-slate-400 group-hover:bg-slate-50">
              <ChevronRight size={11} className="text-slate-400 group-hover:text-slate-600" />
            </div>
          </button>
        ) : (
          <div className="relative flex w-10 shrink-0 items-center justify-center">
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="z-10 flex h-7 w-4 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-slate-400 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              title="Hide sidebar"
            >
              <ChevronLeft size={11} />
            </button>
          </div>
        )}

        <div className={`relative min-w-0 flex-1 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? "ml-4" : "ml-0"}`}>
          <AssignmentGrid
            employees={employees}
            statuses={statuses}
            disabledEmployeeIds={disabledIds}
            assignments={assignments}
            stations={stations}
            workAreas={workAreas}
            selectedWorkAreaId={selectedWorkAreaId}
            onWorkAreaChange={handleWorkAreaChange}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
            onClearWorkArea={handleClearWorkArea}
            onDeleteShift={handleDeleteShift}
            onUpdateShift={handleUpdateShift}
            onAddShift={handleAddShift}
            onDeleteWorkArea={handleDeleteWorkArea}
            onUpdateWorkArea={handleUpdateWorkArea}
            onAddWorkArea={handleAddWorkArea}
            onReorderStation={handleReorderStation}
            onDeleteStation={handleDeleteStation}
            onUpdateStation={handleUpdateStation}
            onAddStation={handleAddStation}
            onStationsChange={handleStationsChange}
            workAreaShifts={workAreaShifts}
            onWorkAreaShiftsChange={handleWorkAreaShiftsChange}
            onWorkAreasChange={handleWorkAreasChange}
            defaultShifts={defaultShiftTemplate}
            statusConfigs={statusConfigs}
            onEmployeeDoubleClick={(name) => { setRosterSearch(name); setRosterOpen(true); }}
            onOpenRoster={(search) => { setRosterSearch(search); setRosterOpen(true); }}
          />
        </div>
      </div>

      {rosterOpen && (
        <RosterManageModal
          employees={employees}
          statuses={statuses}
          assignments={assignments}
          stations={stations}
          workAreas={workAreas}
          statusConfigs={statusConfigs}
          onAdd={handleAdd}
          onRemove={handleRemoveEmployee}
          onUpdate={handleUpdate}
          onSetQualifiedWorkAreas={handleSetQualifiedWorkAreas}
          onStatusChange={handleStatusChange}
          onUnassignAll={handleUnassignAll}
          onUnassignFromStation={handleUnassignFromStation}
          onAssignToDepartment={handleAssignToDepartment}
          onUnassignFromDepartment={handleUnassignFromDepartment}
          getEmployeeEffectiveDepartmentIds={getEmployeeEffectiveDepartmentIds}
          initialSearch={rosterSearch}
          onManageStatuses={() => setShowManageStatuses(true)}
          onClose={() => { setRosterOpen(false); setRosterSearch(""); }}
        />
      )}
    </>
  );
}
