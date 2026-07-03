"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Modal } from "@/components/shared/modal";

// Footer Clear bar. Sits at the bottom of the page content (not pinned to the
// viewport). The draft auto-persists to localStorage on every edit, so there is
// no manual save — "Clear" discards the day's draft (with confirmation).
type SaveBarProps = {
  isEmpty: boolean;
  onClear: () => void;
};

export function SaveBar({ isEmpty, onClear }: SaveBarProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={isEmpty}
          className="ml-auto flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw size={15} />
          Clear
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
