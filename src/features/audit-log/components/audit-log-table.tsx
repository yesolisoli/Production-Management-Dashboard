"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";
import {
  TABLE_LABELS,
  type AuditAction,
  type AuditedTable,
  type AuditLogEntry,
} from "../types";
import { JsonPanel } from "./json-diff";

const ACTION_TONES: Record<AuditAction, string> = {
  insert: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  update: "bg-amber-50 text-amber-700 ring-amber-200",
  delete: "bg-rose-50 text-rose-700 ring-rose-200",
};

function ActionBadge({ action }: { action: AuditAction }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset",
        ACTION_TONES[action],
      )}
    >
      {action}
    </span>
  );
}

function tableLabel(name: string): string {
  return TABLE_LABELS[name as AuditedTable] ?? name;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 [&>th]:border-b [&>th]:border-slate-200 [&>th]:bg-slate-50 [&>th]:px-3 [&>th]:py-2.5">
            <th>Time</th>
            <th>User</th>
            <th>Action</th>
            <th>Table</th>
            <th>Record ID</th>
            <th className="text-right">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isOpen = expanded.has(entry.id);
            return (
              <Fragment key={entry.id}>
                <tr className="[&>td]:border-b [&>td]:border-slate-100 [&>td]:px-3 [&>td]:py-2.5">
                  <td className="whitespace-nowrap tabular-nums text-slate-700">
                    {formatTime(entry.created_at)}
                  </td>
                  <td className="max-w-[16rem] truncate text-slate-700">
                    {entry.user_email ?? (
                      <span className="text-slate-400">System</span>
                    )}
                  </td>
                  <td>
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="whitespace-nowrap text-slate-600">
                    {tableLabel(entry.table_name)}
                  </td>
                  <td className="max-w-[16rem] truncate font-mono text-xs text-slate-500">
                    {entry.record_id ?? "—"}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => toggle(entry.id)}
                      aria-expanded={isOpen}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      {isOpen ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      View Details
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={6} className="border-b border-slate-100 p-0!">
                      <div className="flex flex-col gap-4 bg-slate-50/60 px-3 py-4 sm:flex-row">
                        {/* Highlight changed leaves only on updates, where
                            both sides exist; insert/delete render plain. */}
                        <JsonPanel
                          label="Old data"
                          value={entry.old_data}
                          other={
                            entry.action === "update"
                              ? entry.new_data
                              : undefined
                          }
                          tone="old"
                        />
                        <JsonPanel
                          label="New data"
                          value={entry.new_data}
                          other={
                            entry.action === "update"
                              ? entry.old_data
                              : undefined
                          }
                          tone="new"
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
