-- =================================================================
-- Migration: employee_self_service_rls
-- Enables RLS on the three shared tables the employee mobile app
-- touches, with:
--   * staff policies that preserve the existing Daily Lineup admin
--     app's full access (admin / supervisor / production_planner /
--     basic, via the existing public.is_role() helper), and
--   * narrow self-service policies for linked employees.
--
-- ⚠ IMPORTANT — cross-app impact:
--   These tables previously had RLS DISABLED, meaning ANY key
--   (including anon with no session) could read/write them. After this
--   migration, the admin app MUST run with authentication enabled
--   (NEXT_PUBLIC_AUTH_ENABLED=true) so its users carry a profile role.
--   Anonymous access to these three tables stops working by design.
--
-- Uses existing helpers from prior migrations:
--   public.is_role(text[])  (20260526000000)
--
-- Idempotent: policies are dropped-if-exists before creation.
-- =================================================================


-- =================================================================
-- Helper: today's date in the plant timezone.
-- Single source of truth for "today" inside SQL policies. Keep in sync
-- with PLANT_TIMEZONE in the employee app (America/Vancouver).
-- =================================================================
CREATE OR REPLACE FUNCTION public.plant_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'America/Vancouver')::date;
$$;


-- =================================================================
-- Helper: the employee id linked to the current auth user (or NULL).
-- SECURITY DEFINER so policies on employee_daily_statuses can resolve
-- it without recursing into the employees policies.
-- =================================================================
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid();
$$;


-- =================================================================
-- employees
-- =================================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Staff (admin app users) keep full access.
DROP POLICY IF EXISTS employees_staff_all ON public.employees;
CREATE POLICY employees_staff_all ON public.employees
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));

-- A linked employee may read ONLY their own row (the app selects just
-- id + full_name). No insert/update/delete — linking is done with the
-- service role, which bypasses RLS.
DROP POLICY IF EXISTS employees_self_select ON public.employees;
CREATE POLICY employees_self_select ON public.employees
  FOR SELECT
  USING (auth_user_id = auth.uid());


-- =================================================================
-- status_configs
-- =================================================================
ALTER TABLE public.status_configs ENABLE ROW LEVEL SECURITY;

-- Staff keep full access (the admin board also edits these rows).
DROP POLICY IF EXISTS status_configs_staff_all ON public.status_configs;
CREATE POLICY status_configs_staff_all ON public.status_configs
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));

-- Any authenticated user may read the status catalogue (needed before
-- linking completes, and it contains nothing sensitive).
DROP POLICY IF EXISTS status_configs_authenticated_select ON public.status_configs;
CREATE POLICY status_configs_authenticated_select ON public.status_configs
  FOR SELECT
  TO authenticated
  USING (true);


-- =================================================================
-- employee_daily_statuses
-- =================================================================
ALTER TABLE public.employee_daily_statuses ENABLE ROW LEVEL SECURITY;

-- Staff keep full access (the Daily Lineup board reads and writes).
DROP POLICY IF EXISTS eds_staff_all ON public.employee_daily_statuses;
CREATE POLICY eds_staff_all ON public.employee_daily_statuses
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));

-- Employee: read own rows only.
DROP POLICY IF EXISTS eds_self_select ON public.employee_daily_statuses;
CREATE POLICY eds_self_select ON public.employee_daily_statuses
  FOR SELECT
  USING (employee_id = public.current_employee_id());

-- Employee: insert own status for TODAY (plant date) only. A tampered
-- request with another employee_id or another date fails WITH CHECK.
DROP POLICY IF EXISTS eds_self_insert_today ON public.employee_daily_statuses;
CREATE POLICY eds_self_insert_today ON public.employee_daily_statuses
  FOR INSERT
  WITH CHECK (
    employee_id = public.current_employee_id()
    AND work_date = public.plant_today()
  );

-- Employee: update own live row only. Since 20260520000001 the table is a
-- date-independent live board (UNIQUE(employee_id) — ONE row per employee,
-- work_date is just the last-updated stamp), so USING must not filter on
-- work_date: the row an employee updates today still carries yesterday's
-- stamp. WITH CHECK still pins the RESULT to their own row stamped with
-- today's plant date, so the row cannot be re-pointed at another employee
-- or back/future-dated.
DROP POLICY IF EXISTS eds_self_update_today ON public.employee_daily_statuses;
CREATE POLICY eds_self_update_today ON public.employee_daily_statuses
  FOR UPDATE
  USING (
    employee_id = public.current_employee_id()
  )
  WITH CHECK (
    employee_id = public.current_employee_id()
    AND work_date = public.plant_today()
  );

-- No DELETE policy for employees: they cannot remove statuses.
