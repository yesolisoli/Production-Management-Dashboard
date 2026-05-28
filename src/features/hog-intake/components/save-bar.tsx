"use client";

import clsx from "clsx";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import type { SaveStatus } from "../hooks/use-hog-intake-state";

type SaveBarProps = {
  date: string;
  status: SaveStatus;
  onSave: () => void;
};

export function SaveBar({ date, status, onSave }: SaveBarProps) {
  const saving = status.kind === "saving";
  const loading = status.kind === "loading";

  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-6 border-t border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-800">
            Recording intake for{" "}
            <span className="font-semibold text-slate-900">{date}</span>
          </p>
          <StatusLine status={status} />
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || loading}
          className="flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: SaveStatus }) {
  if (status.kind === "loading") {
    return (
      <p className="flex items-center gap-1 text-xs text-slate-500">
        <Loader2 size={12} className="animate-spin" />
        Loading saved record…
      </p>
    );
  }
  if (status.kind === "saved") {
    return (
      <p className="flex items-center gap-1 text-xs text-emerald-700">
        <CheckCircle2 size={12} />
        Saved. Draft cleared for this date.
      </p>
    );
  }
  if (status.kind === "error") {
    return (
      <p className={clsx("flex items-center gap-1 text-xs text-red-700")}>
        <AlertCircle size={12} />
        {status.message}
      </p>
    );
  }
  return (
    <p className="text-xs text-slate-500">
      Edits auto-save as a local draft until you click Save.
    </p>
  );
}
