"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";
import {
  TABLE_LABELS,
  TABLE_PAGES,
  type AuditAction,
  type AuditedTable,
  type AuditLogEntry,
} from "../types";
import { ChangeSummary, JsonPanel } from "./json-diff";

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

// Split the timestamp into a two-line "Jul 15, 2026" / "11:26:56 AM" pair so
// the Time column reads at a glance. Falls back to the raw ISO on an unparseable
// value.
function formatTimestamp(iso: string): { date: string; clock: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, clock: "" };
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    clock: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

// Turn a table-specific record_id (see record_audit_log migration) into a
// human-scannable key for the outer row. The Table column already names the
// table, so this shows only the identifying part:
//   * primal_ending_stock: opaque uuid -> short "#" prefix (full id in details)
//   * primal_orders:        "work_date:sku" -> "sku · work_date"
//   * hog_intake_records:   intake_date is already readable -> as-is
function recordLabel(tableName: string, recordId: string | null): string {
  if (!recordId) return "—";
  switch (tableName) {
    case "primal_ending_stock":
      return `#${recordId.slice(0, 8)}`;
    case "primal_orders": {
      const sep = recordId.indexOf(":");
      return sep === -1
        ? recordId
        : `${recordId.slice(sep + 1)} · ${recordId.slice(0, sep)}`;
    }
    default:
      return recordId;
  }
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
                <tr className="[&>td]:border-b [&>td]:border-slate-100 [&>td]:px-3 [&>td]:py-2.5 [&>td]:align-top">
                  <td className="whitespace-nowrap tabular-nums">
                    {(() => {
                      const { date, clock } = formatTimestamp(entry.created_at);
                      return (
                        <>
                          <div className="font-medium text-slate-700">
                            {date}
                          </div>
                          {clock && (
                            <div className="text-xs text-slate-400">{clock}</div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="max-w-56 truncate text-slate-700">
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
                    {recordLabel(entry.table_name, entry.record_id)}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => toggle(entry.id)}
                      aria-expanded={isOpen}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      {isOpen ? "Hide Details" : "View Details"}
                      {isOpen ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={6} className="border-b border-slate-100 p-0!">
                      <div className="grid gap-4 bg-slate-50/60 px-3 py-4 lg:grid-cols-[minmax(14rem,1fr)_2fr_2fr]">
                        {/* Left column: record identity, page and the compact
                            "what changed" summary (updates only). */}
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Record ID
                            </p>
                            <p className="mt-0.5 break-all font-mono text-xs text-slate-600">
                              {entry.record_id ?? "—"}
                            </p>
                          </div>
                          {TABLE_PAGES[entry.table_name] && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Page
                              </p>
                              <p className="mt-0.5 text-sm text-slate-600">
                                {TABLE_PAGES[entry.table_name]}
                              </p>
                            </div>
                          )}
                          {/* Compact "what changed" summary; updates only, where
                              both row images exist. Mounts on expand, so the
                              diff work is lazy. */}
                          {entry.action === "update" && (
                            <ChangeSummary
                              tableName={entry.table_name}
                              oldData={entry.old_data}
                              newData={entry.new_data}
                            />
                          )}
                        </div>
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
