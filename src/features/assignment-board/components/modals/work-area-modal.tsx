"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import type { ModeCode, WorkArea, WorkAreaModeView } from "../../types";

export function WorkAreaModal({ initial, onClose, onSave, onDelete }: {
  initial?: WorkArea;
  onClose: () => void;
  onSave: (name: string, color: string, modeViews: WorkAreaModeView[]) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color_hex ?? "#0F172A");
  const [hasModes, setHasModes] = useState(!!(initial?.mode_views?.length));
  const [modeLabels, setModeLabels] = useState<[string, string]>([
    initial?.mode_views?.[0]?.label ?? "Hog Break",
    initial?.mode_views?.[1]?.label ?? "After Hog Break",
  ]);
  const [modeTimeRanges, setModeTimeRanges] = useState<[string, string]>([
    initial?.mode_views?.[0]?.time_range ?? "",
    initial?.mode_views?.[1]?.time_range ?? "",
  ]);
  const modeCodes: ModeCode[] = ["hog_break", "after_hog_break"];
  const modeDefaults = ["05:00 - 09:00", "09:30 - 10:00"];
  const normalizeTimeRange = (val: string, i: number) =>
    (val || modeDefaults[i]).replace(/\s*-\s*/g, " - ").trim();
  const buildViews = (): WorkAreaModeView[] =>
    hasModes ? modeCodes.map((mc, i) => ({ mode_code: mc, label: modeLabels[i], time_range: normalizeTimeRange(modeTimeRanges[i], i) })) : [];

  return (
    <Modal
      title={initial ? "Edit Department" : "Add Department"}
      width="w-[460px]"
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {initial && onDelete && (
            <button onClick={onDelete} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
              Delete Department
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => name.trim() && onSave(name.trim(), color, buildViews())}
              disabled={!name.trim()}
              className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {initial ? "Save" : "Add Department"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Shipping"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Color</label>
          <div className="flex items-center gap-3">
            <label className="relative cursor-pointer">
              <span className="block h-9 w-9 rounded-lg border-2 border-white shadow-md" style={{ backgroundColor: color }} />
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 font-mono text-sm text-slate-500">{color}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <label className="flex cursor-pointer items-center gap-3">
            <div className={`relative h-5 w-9 rounded-full transition-colors ${hasModes ? "bg-slate-800" : "bg-slate-200"}`}
              onClick={() => setHasModes((v) => !v)}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${hasModes ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm font-medium text-slate-700">Has mode views</span>
            <span className="text-xs text-slate-400">(e.g. Hog Break / After Hog Break)</span>
          </label>

          {hasModes && (
            <div className="mt-4 space-y-3">
              {([0, 1] as const).map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs font-medium text-slate-400">Mode {i + 1}</span>
                  <input
                    value={modeLabels[i]}
                    onChange={(e) => setModeLabels((prev) => { const n = [...prev] as [string, string]; n[i] = e.target.value; return n; })}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder={`Mode ${i + 1} label`}
                  />
                  <input
                    value={modeTimeRanges[i]}
                    onChange={(e) => setModeTimeRanges((prev) => { const n = [...prev] as [string, string]; n[i] = e.target.value; return n; })}
                    className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder={modeDefaults[i]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
