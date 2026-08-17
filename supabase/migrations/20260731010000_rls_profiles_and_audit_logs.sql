-- =================================================================
-- Migration: rls_profiles_and_audit_logs
-- Security phase 1: close the two highest-risk privilege escalation
-- paths. Scope is intentionally limited to profiles and audit_logs;
-- application-wide role policies come in a later phase.
--
--   * profiles — RLS on. Users read their own row and may update their
--     own non-role fields; the role column is pinned so only admins can
--     change anyone's role (including their own row's role).
--   * audit_logs — RLS on. Append-only from database triggers: no
--     client INSERT/UPDATE/DELETE policies exist, so all client writes
--     are denied. SELECT is admin-only, matching the admin-gated
--     audit-log route in src/lib/permissions.ts.
--
-- Trigger compatibility: handle_new_user() and record_audit_log() are
-- SECURITY DEFINER functions owned by the migration role (table owner),
-- which is exempt from RLS (FORCE ROW LEVEL SECURITY is not used), so
-- profile auto-provisioning and audit inserts keep working unchanged.
-- The service role also continues to bypass RLS entirely.
--
-- ⚠ Prototype mode (NEXT_PUBLIC_AUTH_ENABLED=false, anon key): these
-- two tables stop being readable/writable by anon. The app only touches
-- them when auth is enabled (profiles) or behind the admin-only audit
-- route, so no prototype flow breaks — the audit-log page would simply
-- show zero rows. Same trade-off as employee_self_service_rls.
--
-- Uses existing helpers (no new authorization model):
--   public.user_role()      (20260525000000)
--   public.is_role(text[])  (20260526000000)
--
-- Idempotent: policies are dropped-if-exists before creation.
-- =================================================================


-- =================================================================
-- profiles
-- =================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admins manage all profiles, including role changes.
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL
  USING (public.is_role(ARRAY['admin']))
  WITH CHECK (public.is_role(ARRAY['admin']));

-- Every authenticated user reads their own row (layout, route guards,
-- and the auth proxy resolve the caller's role this way).
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users may update their own row EXCEPT the role column: WITH CHECK
-- pins the new row's role to the caller's current role via the
-- SECURITY DEFINER helper (STABLE, so it evaluates against the
-- statement snapshot — i.e. the pre-update role). A self-promotion
-- attempt fails the check; non-role fields (email, full_name) pass.
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.user_role()
  );

-- No client INSERT/DELETE policies for non-admins: rows are created by
-- the handle_new_user() trigger and removed via auth.users cascade,
-- both outside client RLS.


-- =================================================================
-- audit_logs
-- =================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Read: admin only (the audit-log route is admin-gated in the app).
DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT
  USING (public.is_role(ARRAY['admin']));

-- Deliberately NO INSERT / UPDATE / DELETE policies: with RLS enabled
-- and no matching policy, every client write is denied. Rows enter
-- exclusively through record_audit_log() (SECURITY DEFINER, RLS-exempt
-- owner), keeping the trail append-only and tamper-proof from clients.
