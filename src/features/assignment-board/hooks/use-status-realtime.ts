"use client";

import { useEffect, useRef } from "react";
import { SUPABASE_ENABLED } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

const REFETCH_DEBOUNCE_MS = 400;
const FALLBACK_POLL_INTERVAL_MS = 30_000;

// Subscribes to INSERT/UPDATE on employee_daily_statuses while the caller is
// mounted and invokes `refetchStatuses` (debounced) so the board reloads
// through its normal snapshot path instead of patching state from payloads.
//
// Until the Realtime server confirms the postgres_changes subscription (a
// "system" event with status "ok"), the hook polls the same refetch on an
// interval. This keeps the board fresh when Realtime is degraded or
// unavailable; polling stops automatically once live events are confirmed.
export function useEmployeeStatusRealtime(refetchStatuses: () => void) {
  const refetchRef = useRef(refetchStatuses);

  useEffect(() => {
    refetchRef.current = refetchStatuses;
  }, [refetchStatuses]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;

    const supabase = createClient();
    let debounceId: number | null = null;
    let pollId: number | null = null;

    const startPolling = () => {
      if (pollId !== null) return;
      pollId = window.setInterval(() => refetchRef.current(), FALLBACK_POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (pollId === null) return;
      window.clearInterval(pollId);
      pollId = null;
    };

    startPolling();

    const scheduleRefetch = () => {
      if (debounceId !== null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = null;
        refetchRef.current();
      }, REFETCH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("employee-daily-statuses-changes")
      .on("system", {}, (payload: { status?: string; message?: string }) => {
        if (payload.status === "ok") {
          stopPolling();
        } else if (payload.status === "error") {
          console.warn(
            "[assignment-board] Realtime rejected the employee_daily_statuses subscription; falling back to interval polling.",
            payload.message,
          );
          startPolling();
        }
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "employee_daily_statuses" },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "employee_daily_statuses" },
        scheduleRefetch,
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "[assignment-board] Realtime subscription for employee_daily_statuses is unavailable; falling back to interval polling.",
            error?.message ?? status,
          );
          startPolling();
        }
      });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refetchRef.current();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (debounceId !== null) window.clearTimeout(debounceId);
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, []);
}
