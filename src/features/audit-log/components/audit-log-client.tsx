"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AUDIT_LOG_MAX_ROWS, fetchAuditLogs, fetchAuditUsers } from "../supabase";
import {
  EMPTY_AUDIT_FILTERS,
  type AuditLogEntry,
  type AuditLogFilters,
} from "../types";
import { AuditLogFiltersBar } from "./audit-log-filters";
import { AuditLogTable } from "./audit-log-table";

export function AuditLogClient() {
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_AUDIT_FILTERS);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Populate the user filter once — the set of actors is stable across
  // filter changes, so there's no need to refetch it on every query.
  useEffect(() => {
    let active = true;
    fetchAuditUsers()
      .then((list) => {
        if (active) setUsers(list);
      })
      .catch(() => {
        // A failed user list only disables the dropdown; the log still loads.
      });
    return () => {
      active = false;
    };
  }, []);

  // Refetch whenever the filters change. The `active` flag drops the result
  // of a stale request if the filters change again before it resolves.
  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchAuditLogs(filters);
        if (!active) return;
        setEntries(rows);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Failed to load audit log",
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [filters]);

  const truncated = entries.length >= AUDIT_LOG_MAX_ROWS;

  return (
    <>
      <AppHeader
        eyebrow="Review"
        title="Audit Log"
        description="Every change to primal orders, hog intake, and ending stock."
      />

      <div className="flex-1 space-y-4 px-4 py-5 sm:px-6">
        <AuditLogFiltersBar
          filters={filters}
          users={users}
          onChange={setFilters}
        />

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : loading ? (
          <EmptyState title="Loading…" />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit entries"
            description="No changes match the current filters."
          />
        ) : (
          <>
            {truncated && (
              <p className="text-xs text-amber-600">
                Showing the most recent {AUDIT_LOG_MAX_ROWS} entries. Narrow the
                date range to see older changes.
              </p>
            )}
            <AuditLogTable entries={entries} />
          </>
        )}
      </div>
    </>
  );
}
