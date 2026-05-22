"use client";

import { useEffect, useRef, useState } from "react";
import type { Station, StationAssignment, WorkArea } from "../types";

export function StationSelect({ employeeId, qualifiedDepartmentIds, assignments, stations, workAreas, onAssign, onUnassign }: {
  employeeId: string;
  qualifiedDepartmentIds: string[];
  assignments: StationAssignment[];
  stations: Station[];
  workAreas: WorkArea[];
  onAssign: (stationId: string) => void;
  onUnassign: (stationId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const deptWas = workAreas.filter((w) => qualifiedDepartmentIds.includes(w.id));
  const deptStations = stations.filter((s) => deptWas.some((wa) => wa.id === s.work_area_id));
  const assignedIds = new Set(
    assignments.filter((a) => a.employee_id === employeeId).map((a) => a.station_id)
  );
  const assignedStations = deptStations.filter((s) => assignedIds.has(s.id));
  const label = assignedStations.length === 0 ? "— None —" : assignedStations.length === 1 ? assignedStations[0].name : `${assignedStations.length} stations`;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={qualifiedDepartmentIds.length === 0}
        className="flex w-full items-center gap-1 rounded border border-transparent px-2 py-1 text-xs font-medium hover:border-slate-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        style={{ color: assignedStations.length > 0 ? (deptWas[0]?.color_hex ?? "#475569") : "#94a3b8" }}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3 w-3 shrink-0 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
      </button>
      {open && deptStations.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-0.5 max-h-64 min-w-44 overflow-y-auto rounded-lg border bg-white shadow-lg">
          {deptWas.map((wa, waIdx) => {
            const waStations = deptStations.filter((s) => s.work_area_id === wa.id);
            if (waStations.length === 0) return null;
            return (
              <div key={wa.id}>
                <div
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${waIdx > 0 ? "border-t-2 border-slate-300" : ""}`}
                  style={{ color: wa.color_hex ?? "#475569" }}
                >
                  {wa.name}
                </div>
                {waStations.map((s) => {
                  const assigned = assignedIds.has(s.id);
                  const waColor = wa.color_hex ?? "#475569";
                  return (
                    <button
                      key={s.id}
                      onClick={() => { assigned ? onUnassign(s.id) : onAssign(s.id); setOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium hover:bg-slate-50"
                      style={{ color: assigned ? waColor : "#64748b" }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: assigned ? waColor : "#cbd5e1" }} />
                      {s.name}
                      {assigned && <span className="ml-auto text-slate-300">✓</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
