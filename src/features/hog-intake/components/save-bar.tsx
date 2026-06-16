"use client";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import type { SaveStatus } from "../hooks/use-hog-intake-state";

type SaveBarProps = {
  status: SaveStatus;
  dirty: boolean;
  onSave: () => void;
  onReset: () => void;
};

export function SaveBar({ status, dirty, onSave, onReset }: SaveBarProps) {
  const saving = status.kind === "saving";
  const loading = status.kind === "loading";
  const busy = saving || loading;

  return (
    <div className="flex items-center justify-end gap-3">
      <StatusLine status={status} dirty={dirty} />
      <button
        type="button"
        onClick={onReset}
        disabled={busy}
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        <RotateCcw size={14} />
        Reset All
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className="flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Save size={16} />
        )}
        {saving ? "Saving…" : "Save Record"}
      </button>
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
        Saved · draft cleared
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
        <AlertCircle size={13} />
        Unsaved changes — click Save to commit to DB
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
