"use client";

import { createClient } from "@/lib/supabase/client";
import type { AuditLogEntry, AuditLogFilters } from "./types";

const AUDIT_LOG_COLUMNS =
  "id, created_at, user_id, user_email, action, table_name, record_id, old_data, new_data, source";

// Read cap. The audit trail grows unbounded, so the list is always bounded
// by the newest MAX_ROWS entries that match the active filters. The UI
// surfaces this cap so a truncated view never reads as "everything".
export const AUDIT_LOG_MAX_ROWS = 500;

// Fetch the newest matching audit entries, sorted created_at DESC. Date
// bounds are inclusive calendar days interpreted in the browser's local
// timezone; created_at is stored as timestamptz (UTC) so results near
// midnight may shift by the local offset — acceptable for this read-only view.
export async function fetchAuditLogs(
  filters: AuditLogFilters,
): Promise<AuditLogEntry[]> {
  const supabase = createClient();

  let query = supabase
    .from("audit_logs")
    .select(AUDIT_LOG_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(AUDIT_LOG_MAX_ROWS);

  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999`);
  if (filters.table) query = query.eq("table_name", filters.table);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.user) query = query.eq("user_email", filters.user);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLogEntry[];
}

// Distinct actor emails seen in the recent trail, for the user filter
// dropdown. Deduped client-side (Supabase has no cheap DISTINCT) over the
// most recent rows — enough to populate a small picker.
export async function fetchAuditUsers(): Promise<string[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("user_email")
    .not("user_email", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  for (const row of (data ?? []) as { user_email: string | null }[]) {
    if (row.user_email) seen.add(row.user_email);
  }
  return [...seen].sort();
}
