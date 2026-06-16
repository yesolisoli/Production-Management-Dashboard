"use client";

import { AUTH_ENABLED } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

// Resolve the signed-in user's id for stamping `updated_by` on writes.
// Returns null when auth is disabled or the lookup fails.
export async function getCurrentUserId(): Promise<string | null> {
  if (!AUTH_ENABLED) return null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
