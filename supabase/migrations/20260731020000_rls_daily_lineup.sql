-- =================================================================
-- Migration: rls_daily_lineup
-- Security phase 2: RLS across the Daily Lineup domain. Scope is
-- deliberately limited to the assignment-board / daily-lineup / TV
-- tables; production planning, hog intake, primal, and orders tables
-- are untouched (phase 3).
--
-- Access model (mirrors src/lib/permissions.ts ROLE_ROUTES):
--   * Writes come only from the assignment-board route, which is
--     admin + supervisor ("OPS" below).
--   * Reads are needed by every staff role that can open daily-lineup,
--     history, or tv-display: admin, supervisor, production_planner,
--     basic ("STAFF" below). pending has no Daily Lineup routes and
--     gets no staff access.
--   * Snapshot capture (assignment_board_snapshots INSERT) runs on BOTH
--     the admin board and the TV display client. The TV is an
--     authenticated session (the proxy gates /tv-display) that may be
--     signed in as any non-pending role, so INSERT is granted to STAFF
--     — matching what the UI already does today. Snapshots have no
--     UPDATE/DELETE policies at all: append-only from clients.
--   * Employee self-service policies from 20260722000001 are kept
--     verbatim (employees_self_select, eds_self_*,
--     status_configs_authenticated_select). Only the four overly-broad
--     <t>_staff_all policies (which let basic / production_planner
--     write) are narrowed to match the UI matrix.
--
-- TV display: authenticated (see above) — no anonymous access is
-- granted anywhere. With NEXT_PUBLIC_AUTH_ENABLED=false (anon key) the
-- Daily Lineup domain is unreadable by design, extending the stance
-- taken in 20260722000001.
--
-- Realtime: postgres_changes respects RLS SELECT policies, so staff
-- keep receiving employee_daily_statuses and work_areas events; linked
-- employees still receive their own status events via eds_self_select.
--
-- Uses existing helpers only:
--   public.is_role(text[])           (20260526000000)
--   public.current_employee_id()     (20260722000001, kept in place)
--
-- Idempotent: policies are dropped-if-exists before creation.
-- =================================================================


-- =================================================================
-- Plain board tables: STAFF read, OPS full write.
-- work_areas, work_area_mode_views, work_area_shifts, stations,
-- station_assignments, employee_qualified_work_areas.
-- (employee_qualified_work_areas is not in the headline list but is
-- fetched and written by the same board flows; leaving it open would
-- let any client tamper with qualifications.)
-- =================================================================

ALTER TABLE public.work_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_areas_staff_write ON public.work_areas;
CREATE POLICY work_areas_staff_write ON public.work_areas
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS work_areas_staff_select ON public.work_areas;
CREATE POLICY work_areas_staff_select ON public.work_areas
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


ALTER TABLE public.work_area_mode_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wamv_staff_write ON public.work_area_mode_views;
CREATE POLICY wamv_staff_write ON public.work_area_mode_views
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS wamv_staff_select ON public.work_area_mode_views;
CREATE POLICY wamv_staff_select ON public.work_area_mode_views
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


ALTER TABLE public.work_area_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS was_staff_write ON public.work_area_shifts;
CREATE POLICY was_staff_write ON public.work_area_shifts
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS was_staff_select ON public.work_area_shifts;
CREATE POLICY was_staff_select ON public.work_area_shifts
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stations_staff_write ON public.stations;
CREATE POLICY stations_staff_write ON public.stations
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS stations_staff_select ON public.stations;
CREATE POLICY stations_staff_select ON public.stations
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


ALTER TABLE public.station_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_staff_write ON public.station_assignments;
CREATE POLICY sa_staff_write ON public.station_assignments
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS sa_staff_select ON public.station_assignments;
CREATE POLICY sa_staff_select ON public.station_assignments
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


ALTER TABLE public.employee_qualified_work_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eqwa_staff_write ON public.employee_qualified_work_areas;
CREATE POLICY eqwa_staff_write ON public.employee_qualified_work_areas
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS eqwa_staff_select ON public.employee_qualified_work_areas;
CREATE POLICY eqwa_staff_select ON public.employee_qualified_work_areas
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


-- =================================================================
-- employees — narrow the phase-1 self-service-era staff policy.
-- Self-service policy employees_self_select is intentionally kept.
-- =================================================================

DROP POLICY IF EXISTS employees_staff_all ON public.employees;

DROP POLICY IF EXISTS employees_staff_write ON public.employees;
CREATE POLICY employees_staff_write ON public.employees
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS employees_staff_select ON public.employees;
CREATE POLICY employees_staff_select ON public.employees
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


-- =================================================================
-- employee_daily_statuses — narrow staff writes; keep every
-- self-service policy (eds_self_select / insert_today / update_today).
-- =================================================================

DROP POLICY IF EXISTS eds_staff_all ON public.employee_daily_statuses;

DROP POLICY IF EXISTS eds_staff_write ON public.employee_daily_statuses;
CREATE POLICY eds_staff_write ON public.employee_daily_statuses
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS eds_staff_select ON public.employee_daily_statuses;
CREATE POLICY eds_staff_select ON public.employee_daily_statuses
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


-- =================================================================
-- status_configs — narrow staff writes; keep
-- status_configs_authenticated_select (it already grants SELECT to all
-- authenticated users, which covers staff and linked employees alike).
-- =================================================================

DROP POLICY IF EXISTS status_configs_staff_all ON public.status_configs;

DROP POLICY IF EXISTS status_configs_staff_write ON public.status_configs;
CREATE POLICY status_configs_staff_write ON public.status_configs
  FOR ALL
  USING (public.is_role(ARRAY['admin','supervisor']))
  WITH CHECK (public.is_role(ARRAY['admin','supervisor']));


-- =================================================================
-- assignment_board_snapshots — STAFF read + STAFF insert (both the
-- admin board and the TV display run end-of-day capture). No client
-- UPDATE/DELETE policies: the archive is append-only.
-- =================================================================

ALTER TABLE public.assignment_board_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snapshots_staff_select ON public.assignment_board_snapshots;
CREATE POLICY snapshots_staff_select ON public.assignment_board_snapshots
  FOR SELECT
  USING (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));

DROP POLICY IF EXISTS snapshots_staff_insert ON public.assignment_board_snapshots;
CREATE POLICY snapshots_staff_insert ON public.assignment_board_snapshots
  FOR INSERT
  WITH CHECK (public.is_role(ARRAY['admin','supervisor','production_planner','basic']));


-- =================================================================
-- user_work_areas — unused scaffolding (no app reads or writes it).
-- RLS on with NO policies: deny-all for clients until a future phase
-- actually uses it. The service role still bypasses RLS.
-- =================================================================

ALTER TABLE public.user_work_areas ENABLE ROW LEVEL SECURITY;
