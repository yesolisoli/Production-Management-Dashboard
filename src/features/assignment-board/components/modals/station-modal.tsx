"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import { EmployeeSelect } from "./employee-select";
import type { Employee, WorkArea } from "../../types";
import { isEmployeeEligibleForWorkArea } from "../../utils";

export function StationModal({ employees, workAreaId, workAreas, defaultOnly, existingGroups, initial, onClose, onSave }: {
  employees: Employee[];
  workAreaId?: string;
  workAreas?: WorkArea[];
  defaultOnly?: boolean;
  existingGroups: string[];
  initial?: { name: string; group: string; genderRestriction?: "M" | "F"; defaultEmployeeId?: string };
  onClose: () => void;
  onSave: (name: string, group: string, genderRestriction?: "M" | "F", defaultEmployeeId?: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [group, setGroup] = useState(initial?.group ?? "");
  const [genderRestriction, setGenderRestriction] = useState<"M" | "F" | undefined>(initial?.genderRestriction);
  const [defaultEmployeeId, setDefaultEmployeeId] = useState<string | undefined>(initial?.defaultEmployeeId);
  const canSave = name.trim().length > 0;
  const isEdit = !!initial;

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Station" : "New Station"}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
          <button
            onClick={() => canSave && onSave(name.trim(), group.trim(), genderRestriction, defaultEmployeeId)}
            disabled={!canSave}
            className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-30 transition-colors"
          >
            {isEdit ? "Save" : "Add Station"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {!defaultOnly && (
          <>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-600">Station Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSave && onSave(name.trim(), group.trim(), genderRestriction, defaultEmployeeId)}
                autoFocus
                placeholder="e.g. Saw, Helper #1"
                className="w-full rounded-xl border border-slate-800 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-600">Group</label>
                <span className="text-xs text-slate-400">— optional</span>
              </div>
              {existingGroups.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {existingGroups.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGroup(group === g ? "" : g)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${group === g ? "bg-slate-800 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
              <input
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder={existingGroups.length > 0 ? "Or type a new group name..." : "Type a group name..."}
                className="w-full rounded-xl border border-slate-800 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-600">Gender Restriction</label>
                <span className="text-xs text-slate-400">— optional</span>
              </div>
              <div className="flex gap-2">
                {([undefined, "M", "F"] as const).map((val) => (
                  <button
                    key={val ?? "none"}
                    type="button"
                    onClick={() => setGenderRestriction(val)}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all border ${genderRestriction === val ? val === "M" ? "bg-sky-500 text-white border-sky-500" : val === "F" ? "bg-rose-400 text-white border-rose-400" : "bg-slate-800 text-white border-slate-800" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"}`}
                  >
                    {val === undefined ? "None" : val === "M" ? "Male Only" : "Female Only"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-600">Default Employee</label>
            <span className="text-xs text-slate-400">— optional</span>
          </div>
          <EmployeeSelect
            employees={workAreaId ? employees.filter((e) => isEmployeeEligibleForWorkArea(e, workAreaId)) : employees}
            value={defaultEmployeeId}
            onChange={setDefaultEmployeeId}
            workAreaId={workAreaId}
            workAreas={workAreas}
            genderRestriction={genderRestriction}
          />
          {(() => {
            const emp = employees.find((e) => e.id === defaultEmployeeId);
            if (!emp || !genderRestriction || !emp.gender || emp.gender === genderRestriction) return null;
            return (
              <p className="mt-1.5 text-xs font-medium text-rose-500">
                ⚠ {emp.full_name} is {emp.gender === "M" ? "male" : "female"} — this station is {genderRestriction === "M" ? "Male Only" : "Female Only"}
              </p>
            );
          })()}
        </div>
      </div>
    </Modal>
  );
}
