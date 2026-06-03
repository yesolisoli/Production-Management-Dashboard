"use client";

import { SUPABASE_ENABLED } from "@/lib/config";
import { fetchHogIntakeByDate } from "@/features/hog-intake/supabase";
import type { HogIntakeRecord } from "@/features/hog-intake/types";

// -------------------------------------------------------------------
// Data layer for the hog intake values the Primal Calculation screen
// consumes (hog counts, side orders, for-cutting, next-day projection).
//
// DB-only by design: Expected Production must derive from REAL Hog Intake
// records, so there is intentionally NO mock-data fallback here.
//   * Returns the Supabase record for the date when one exists.
//   * Returns null when no record exists for that date (caller shows an
//     empty state → Expected Production is 0).
//   * Throws when the database is unavailable (Supabase not configured, or
//     the query fails) so the caller can surface an error rather than
//     silently substituting fabricated data.
// Read-only: Primal Calc never writes back to hog intake.
// -------------------------------------------------------------------
export async function loadHogIntakeForDate(
  date: string,
): Promise<HogIntakeRecord | null> {
  if (!SUPABASE_ENABLED) {
    throw new Error("Hog Intake database is not configured.");
  }
  // fetchHogIntakeByDate returns null when no row matches the date and
  // throws on a query error — both behaviours are passed straight through.
  return await fetchHogIntakeByDate(date);
}
