"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUPABASE_ENABLED } from "@/lib/config";
import { useAssignmentBoardData } from "../hooks/use-assignment-board-data";
import { useSnapshotCapture } from "../hooks/use-snapshot-capture";
import { TVDisplay, type TVSyncStatus } from "./tv-display";

const POLL_INTERVAL_MS = 30_000;
const RELOAD_INTERVAL_MS = 4 * 60 * 60 * 1000;

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

export function TVDisplayPageClient() {
  const router = useRouter();
  const {
    employees,
    statuses,
    assignments,
    stations,
    workAreas,
    workAreaShifts,
    statusConfigs,
    announcement,
    isHydrating,
    loadError,
    refetchSnapshot,
  } = useAssignmentBoardData();

  useSnapshotCapture({
    enabled: SUPABASE_ENABLED && !isHydrating,
    snapshot: {
      employees,
      statuses,
      assignments,
      stations,
      workAreas,
      workAreaShifts,
      statusConfigs,
    },
    workAreaShifts,
  });

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<TVSyncStatus>("idle");

  const refetchRef = useRef(refetchSnapshot);
  useEffect(() => {
    refetchRef.current = refetchSnapshot;
  }, [refetchSnapshot]);

  const inFlightRef = useRef(false);

  useEffect(() => {
    if (isHydrating || loadError) return;

    let cancelled = false;

    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setSyncStatus("syncing");
      try {
        await refetchRef.current();
        if (cancelled) return;
        setLastSyncedAt(new Date());
        setSyncStatus("ok");
      } catch (error) {
        if (cancelled) return;
        console.error("[tv-display] poll refetch failed:", error);
        setSyncStatus("error");
      } finally {
        inFlightRef.current = false;
      }
    };

    setLastSyncedAt(new Date());
    setSyncStatus("ok");

    const interval = window.setInterval(tick, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    const onOnline = () => void tick();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [isHydrating, loadError]);

  useEffect(() => {
    const wakeLockApi = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!wakeLockApi) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await wakeLockApi.request("screen");
        if (cancelled) {
          void next.release().catch(() => {});
          return;
        }
        sentinel = next;
      } catch (error) {
        console.warn("[tv-display] wake lock request failed:", error);
      }
    };

    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel) {
        void sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.location.reload();
    }, RELOAD_INTERVAL_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  if (isHydrating) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="rounded-lg border border-white/10 bg-slate-900 px-4 py-3 text-sm">
          Loading TV display...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-lg rounded-lg border border-red-500/40 bg-red-950/60 px-5 py-4 text-sm text-red-200 shadow-md">
          <p className="font-semibold">Could not load TV display</p>
          <p className="mt-1 wrap-break-word text-xs text-red-300">{loadError}</p>
          <p className="mt-3 text-xs text-red-400">
            Check Supabase connectivity and reload the page.
          </p>
        </div>
      </div>
    );
  }

  const shifts = Object.values(workAreaShifts)
    .flatMap((perMode) => Object.values(perMode))
    .flat()
    .filter((s, i, arr) => arr.findIndex((x) => x.code === s.code) === i);

  return (
    <TVDisplay
      employees={employees}
      statuses={statuses}
      assignments={assignments}
      stations={stations}
      workAreas={workAreas}
      shifts={shifts}
      workAreaShifts={workAreaShifts}
      statusConfigs={statusConfigs}
      announcement={announcement}
      onClose={() => router.push("/assignment-board")}
      syncStatus={syncStatus}
      lastSyncedAt={lastSyncedAt}
    />
  );
}
