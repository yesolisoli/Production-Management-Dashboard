"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "daily-lineup.target-overrides";

/**
 * Runtime, admin-editable per-work-area target overrides.
 *
 * Persisted to localStorage so edits made on the Assignment Board admin
 * view are visible from the Daily Lineup dashboard on the next render.
 * This will be replaced with an admin-editable, DB-backed column on
 * `work_areas` later.
 */
export function useTargetOverrides() {
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === "number" && Number.isFinite(v)) next[k] = v;
        }
        setOverrides(next);
      }
    } catch {
      // ignore parse / access errors
    }

    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const parsed: unknown = e.newValue ? JSON.parse(e.newValue) : {};
        if (parsed && typeof parsed === "object") {
          setOverrides(parsed as Record<string, number>);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setOverride = (workAreaId: string, value: number | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value == null) delete next[workAreaId];
      else next[workAreaId] = value;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / access errors
      }
      return next;
    });
  };

  return { overrides, setOverride };
}
