"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import { TimePickerInput } from "./time-picker-input";
import type { ShiftCode } from "../../types";

export function ShiftModal({ initial, defaultStart, defaultEnd, onClose, onSave }: {
  initial?: { code: ShiftCode; label: string; startTime: string; endTime: string };
  defaultStart?: string;
  defaultEnd?: string;
  onClose: () => void;
  onSave: (label: string, startTime: string, endTime: string) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const canSave = label.trim().length > 0;
  const isEdit = !!initial;

  return (
    <Modal
      title={isEdit ? "Edit Shift" : "Add Shift"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
          <button
            onClick={() => canSave && onSave(label.trim(), startTime, endTime)}
            disabled={!canSave}
            className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-30 transition-colors"
          >
            {isEdit ? "Save" : "Add Shift"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-600">Shift Name</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSave && onSave(label.trim(), startTime, endTime)}
            autoFocus
            placeholder="e.g. 1st Shift"
            className="w-full rounded-xl border border-slate-800 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-600">Time Range <span className="font-normal normal-case text-slate-400">— optional</span></label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Start</p>
              <TimePickerInput value={startTime} onChange={setStartTime} placeholder={defaultStart || "--:--"} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">End</p>
              <TimePickerInput value={endTime} onChange={setEndTime} placeholder={defaultEnd || "--:--"} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
