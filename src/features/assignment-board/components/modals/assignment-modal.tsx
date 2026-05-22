"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import type { Employee, Station, WorkArea } from "../../types";

export function AssignmentModal({
  employee, workAreas, stations, assignedStationIds, onSave, onClear, onClose,
}: {
  employee: Employee;
  workAreas: WorkArea[];
  stations: Station[];
  assignedStationIds: Set<string>;
  onSave: (waId: string, toAdd: string[], toRemove: string[]) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [selectedWaId, setSelectedWaId] = useState<string | null>(() => {
    if (assignedStationIds.size > 0) {
      const firstStation = stations.find((s) => assignedStationIds.has(s.id));
      if (firstStation) return firstStation.work_area_id;
    }
    return employee.homeDepartmentId ?? null;
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(assignedStationIds));

  const waStations = stations.filter((s) => s.work_area_id === selectedWaId);
  const selectedWa = workAreas.find((wa) => wa.id === selectedWaId);

  const toggleStation = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!selectedWa) return;
    const toAdd = waStations.filter((s) => selectedIds.has(s.id) && !assignedStationIds.has(s.id)).map((s) => s.id);
    const toRemove = waStations.filter((s) => !selectedIds.has(s.id) && assignedStationIds.has(s.id)).map((s) => s.id);
    onSave(selectedWa.id, toAdd, toRemove);
  };

  return (
    <Modal
      title="Assign Department & Station"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!selectedWa}
              className="flex-1 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              Save
            </button>
          </div>
          {employee.homeDepartmentId && (
            <button onClick={() => { onClear(); onClose(); }} className="w-full rounded-md border border-red-200 py-2 text-sm font-medium text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors">
              Clear Department
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-base font-semibold text-slate-800">
          {employee.full_name}
          {employee.employee_code && <span className="ml-2 text-sm font-normal text-slate-400">{employee.employee_code}</span>}
        </p>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">Department</p>
          <div className="flex flex-wrap gap-2">
            {workAreas.map((wa) => (
              <button
                key={wa.id}
                onClick={() => { setSelectedWaId(wa.id); setSelectedIds(new Set()); }}
                className="rounded-md border px-3 py-1.5 text-sm transition-all"
                style={selectedWaId === wa.id
                  ? { backgroundColor: wa.color_hex ?? "#334155", color: "#fff", borderColor: "transparent" }
                  : { backgroundColor: "#fff", color: "#475569", borderColor: "#e2e8f0" }}
              >
                {wa.name}
              </button>
            ))}
          </div>
        </div>

        {waStations.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              Station <span className="font-normal normal-case text-slate-400">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {waStations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleStation(s.id)}
                  className="rounded-md border px-3 py-1.5 text-sm transition-all"
                  style={selectedIds.has(s.id)
                    ? { backgroundColor: selectedWa?.color_hex ?? "#334155", borderColor: "transparent", color: "#fff" }
                    : { borderColor: "#e2e8f0", color: "#475569" }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
