// Shared types for the read-only Audit Log screen. The shape mirrors the
// audit_logs table 1:1 (see the 20260714000000_audit_logs migration).

// The three tables audited in this MVP. Order here is the filter-dropdown
// display order.
export const AUDITED_TABLES = [
  "primal_orders",
  "hog_intake_records",
  "primal_ending_stock",
] as const;

export type AuditedTable = (typeof AUDITED_TABLES)[number];

// Human labels for the audited tables (used in the table column + filter).
export const TABLE_LABELS: Record<AuditedTable, string> = {
  primal_orders: "Primal Orders",
  hog_intake_records: "Hog Intake",
  primal_ending_stock: "Primal Ending Stock",
};

// The three DML verbs, matching the audit_logs action CHECK constraint.
export const AUDIT_ACTIONS = ["insert", "update", "delete"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditLogEntry = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string | null;
  old_data: unknown;
  new_data: unknown;
  source: string;
};

// Filter state for the list. A null field means "no filter". Dates are
// inclusive calendar days (YYYY-MM-DD); `user` matches user_email exactly.
export type AuditLogFilters = {
  from: string | null;
  to: string | null;
  table: AuditedTable | null;
  action: AuditAction | null;
  user: string | null;
};

export const EMPTY_AUDIT_FILTERS: AuditLogFilters = {
  from: null,
  to: null,
  table: null,
  action: null,
  user: null,
};
