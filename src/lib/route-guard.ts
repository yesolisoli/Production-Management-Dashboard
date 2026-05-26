import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ENABLED } from "@/lib/config";
import {
  canAccessRoute,
  defaultPathForRole,
  DEFAULT_ROLE,
  type Role,
  type RouteKey,
} from "@/lib/permissions";

// Returns the current user's role, or null when AUTH_ENABLED=false
// (prototype mode) or no user is signed in. Cached per render so every
// consumer in a single request shares one profiles SELECT.
export const getCurrentRole = cache(async (): Promise<Role | null> => {
  if (!AUTH_ENABLED) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (profile?.role as Role | undefined) ?? DEFAULT_ROLE;
});

// For conditional UI in server components. Returns true when
// AUTH_ENABLED=false (prototype shows everything) or the current user
// is authorized for the given route.
export async function canAccessRouteForCurrentUser(
  routeKey: RouteKey,
): Promise<boolean> {
  if (!AUTH_ENABLED) return true;
  const role = await getCurrentRole();
  if (!role) return false;
  return canAccessRoute(role, routeKey);
}

// Page-level defense-in-depth route guard. Call at the top of a server
// page component for any route that must be gated independently of the
// proxy. No-op when AUTH_ENABLED=false so the prototype flow stays intact.
export async function requireRouteAccess(routeKey: RouteKey): Promise<void> {
  if (!AUTH_ENABLED) return;

  const role = await getCurrentRole();
  if (!role) {
    redirect("/login");
  }
  if (!canAccessRoute(role, routeKey)) {
    redirect(defaultPathForRole(role));
  }
}
