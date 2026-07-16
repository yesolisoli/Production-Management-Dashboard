"use client";

import {
  AUDITED_TABLES,
  AUDIT_ACTIONS,
  EMPTY_AUDIT_FILTERS,
  TABLE_LABELS,
  type AuditAction,
  type AuditedTable,
  type AuditLogFilters,
} from "../types";

type Props = {
  filters: AuditLogFilters;
  users: string[];
  onChange: (next: AuditLogFilters) => void;
};

const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function AuditLogFiltersBar({ filters, users, onChange }: Props) {
  const patch = (partial: Partial<AuditLogFilters>) =>
    onChange({ ...filters, ...partial });

  const hasActiveFilter =
    filters.from !== null ||
    filters.to !== null ||
    filters.table !== null ||
    filters.action !== null ||
    filters.user !== null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="From">
          <input
            type="date"
            className={FIELD_CLASS}
            value={filters.from ?? ""}
            max={filters.to ?? undefined}
            onChange={(e) => patch({ from: e.target.value || null })}
          />
        </Field>

        <Field label="To">
          <input
            type="date"
            className={FIELD_CLASS}
            value={filters.to ?? ""}
            min={filters.from ?? undefined}
            onChange={(e) => patch({ to: e.target.value || null })}
          />
        </Field>

        <Field label="Table">
          <select
            className={FIELD_CLASS}
            value={filters.table ?? ""}
            onChange={(e) =>
              patch({ table: (e.target.value || null) as AuditedTable | null })
            }
          >
            <option value="">All tables</option>
            {AUDITED_TABLES.map((t) => (
              <option key={t} value={t}>
                {TABLE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Action">
          <select
            className={FIELD_CLASS}
            value={filters.action ?? ""}
            onChange={(e) =>
              patch({ action: (e.target.value || null) as AuditAction | null })
            }
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="User">
          <select
            className={FIELD_CLASS}
            value={filters.user ?? ""}
            onChange={(e) => patch({ user: e.target.value || null })}
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end">
          <button
            type="button"
            disabled={!hasActiveFilter}
            onClick={() => onChange(EMPTY_AUDIT_FILTERS)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
