"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Modal } from "@/components/shared/modal";
import type { SaveStatus } from "../hooks/use-hog-intake-state";

type SaveBarProps = {
  status: SaveStatus;
  dirty: boolean;
  onReset: () => void;
};

export function SaveBar({ status, dirty, onReset }: SaveBarProps) {
  const saving = status.kind === "saving";
  const loading = status.kind === "loading";
  const busy = saving || loading;
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="flex items-center justify-end gap-3">
      <StatusLine status={status} dirty={dirty} />
      <button
        type="button"
        onClick={() => setConfirmReset(true)}
        disabled={busy}
        title="Reset All"
        aria-label="Reset All"
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:w-auto sm:px-4"
      >
        <RotateCcw size={14} />
        <span className="hidden sm:inline">Reset All</span>
      </button>
      {confirmReset && (
        <Modal
          title="Reset all entries?"
          onClose={() => setConfirmReset(false)}
          width="w-[90vw] max-w-sm"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                }}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                Reset All
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-sm text-slate-600">
              This clears every field for this date and discards unsaved
              changes. This action cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatusLine({
  status,
  dirty,
}: {
  status: SaveStatus;
  dirty: boolean;
}) {
  if (status.kind === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 size={13} className="animate-spin" />
        Loading…
      </p>
    );
  }
  if (status.kind === "saved") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 size={13} />
        Saved automatically
      </p>
    );
  }
  if (status.kind === "error") {
    return (
      <p className="flex max-w-80 items-start gap-1.5 text-xs text-red-700">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        <span>{status.message}</span>
      </p>
    );
  }
  if (dirty) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <Loader2 size={13} className="animate-spin" />
        Saving…
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Up to date with saved record
    </p>
  );
}
