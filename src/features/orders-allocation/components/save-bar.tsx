"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw, Save } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import type { SaveStatus } from "../hooks/use-orders-allocation-state";

// Sticky Save / Clear bar. The draft auto-persists to localStorage on every
// edit; "Save Orders & Allocation" is an explicit commit that flashes a
// confirmation, and "Clear" discards the day's draft (with confirmation).
type SaveBarProps = {
  status: SaveStatus;
  isEmpty: boolean;
  onSave: () => void;
  onClear: () => void;
};

export function SaveBar({ status, isEmpty, onSave, onClear }: SaveBarProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-5">
      <div className="flex items-center gap-3">
        {status.kind === "saved" && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={14} />
            Saved
          </p>
        )}

        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={isEmpty}
          className="ml-auto flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw size={15} />
          Clear
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={isEmpty}
          className="flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
        >
          <Save size={16} />
          Save All
        </button>
      </div>

      {confirmClear && (
        <Modal
          title="Clear this date?"
          onClose={() => setConfirmClear(false)}
          width="w-[90vw] max-w-sm"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                Clear
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-sm text-slate-600">
              This discards the cut orders and allocation sheet for this date.
              This action cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
