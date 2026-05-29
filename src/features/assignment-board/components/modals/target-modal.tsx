"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/modal";

type Props = {
  workAreaName: string;
  currentTarget: number;
  hasOverride: boolean;
  onSave: (value: number) => void;
  onReset: () => void;
  onClose: () => void;
};

export function TargetModal({
  workAreaName,
  currentTarget,
  hasOverride,
  onSave,
  onReset,
  onClose,
}: Props) {
  const [value, setValue] = useState<string>(String(currentTarget));
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && Number.isInteger(parsed);

  const handleSave = () => {
    if (!valid) return;
    onSave(parsed);
  };

  return (
    <Modal
      title="Set Target Headcount"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onReset}
            disabled={!hasOverride}
            className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
          >
            Reset to default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!valid}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm text-slate-600">
        Department: <span className="font-semibold text-slate-800">{workAreaName}</span>
      </p>
      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Target Headcount
      </label>
      <input
        type="number"
        min={0}
        step={1}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valid) handleSave();
        }}
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold text-slate-800 focus:border-blue-400 focus:outline-none"
      />
      {!valid && value.trim() !== "" && (
        <p className="mt-2 text-xs text-rose-500">Enter a non-negative whole number.</p>
      )}
    </Modal>
  );
}
