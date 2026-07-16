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

// Human labels for the columns of each audited table, used by the plain-
// language change summary. ONLY columns listed here are surfaced — this
// doubles as the noise filter, so audit/system columns (id, PK parts,
// created_at, updated_at, updated_by) are omitted deliberately and any new
// column stays hidden from the summary until given a label here. Dictionary
// order is the display order. Nested jsonb columns are labelled but rendered
// as "updated" (their detail lives in the raw JSON panels below).
export const FIELD_LABELS: Record<string, Record<string, string>> = {
  hog_intake_records: {
    hog_counts: "Hog counts",
    side_orders: "Side orders",
    held_over: "Held over",
    deaths_on_arrival: "Deaths on arrival",
    boars_count: "Boars",
    notes: "Notes",
    farm_records: "Farm records",
    next_day: "Next day plan",
  },
  primal_ending_stock: {
    group_name: "Group",
    ending_stock: "Ending stock",
    work_date: "Work date",
  },
  primal_orders: {
    today_cases: "Cases",
    today_pcs: "Pieces",
  },
};

// Labels for nested jsonb sub-keys, so the change summary can spell out
// what changed *inside* an object column (e.g. next_day) in human terms
// instead of just "updated". Keys not listed fall back to the raw sub-key,
// which is fine for maps already keyed by a human token (hog_counts uses the
// HOG_TYPES codes: JP, RWA, …).
export const SUBFIELD_LABELS: Record<string, string> = {
  hog_count: "Hog count",
  side_orders: "Side orders",
  cooler_overstock: "Cooler overstock",
};

// The app page an operator edits each table on, shown in an audit entry's
// details so a reviewer knows where the change was made.
export const TABLE_PAGES: Record<string, string> = {
  hog_intake_records: "Hog Intake",
  primal_ending_stock: "Primal Calculation",
  primal_orders: "Primal Calculation",
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
