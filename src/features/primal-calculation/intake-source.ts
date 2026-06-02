"use client";

import { SUPABASE_ENABLED } from "@/lib/config";
import { buildHogIntakeMockRecords } from "@/features/hog-intake/mock-data";
import { fetchHogIntakeByDate } from "@/features/hog-intake/supabase";
import {
  emptyHogIntakeRecord,
  type HogIntakeRecord,
} from "@/features/hog-intake/types";

// -------------------------------------------------------------------
// Data layer for the hog intake values the Primal Calculation screen
// consumes (hog counts, side orders, for-cutting, next-day projection).
//
// This is the ONLY place that decides where intake data comes from, so
// the backend can be swapped in later without touching the hook or UI:
//   1. Supabase (when configured) — reuse the hog-intake loader.
//   2. Mock records — for local/prototype work.
// Read-only: Primal Calc never writes back to hog intake.
// -------------------------------------------------------------------
export async function loadHogIntakeForDate(
  date: string,
): Promise<HogIntakeRecord> {
  if (SUPABASE_ENABLED) {
    try {
      const remote = await fetchHogIntakeByDate(date);
      if (remote) return remote;
    } catch {
      // Fall through to mock data so the screen still renders offline.
    }
  }

  const mock = buildHogIntakeMockRecords().find((r) => r.date === date);
  return mock ?? emptyHogIntakeRecord(date);
}
