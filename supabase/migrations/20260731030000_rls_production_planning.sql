-- =================================================================
-- Migration: rls_production_planning
-- Security phase 3: RLS across the Production Planning domain.
-- Scope: the four tables actually used by Hog Intake, Primal
-- Calculation, Orders & Allocation, and Production Planner:
--   hog_intake_records, primal_orders, primal_ending_stock,
--   primal_allocations
-- (Drafts, vacuum-pack grouping, and product specs live in
-- localStorage / TS constants — no other planning tables exist.)
--
-- Access model (mirrors src/lib/permissions.ts ROLE_ROUTES): every
-- planning route is admin + production_planner only, so no other role
-- gets ANY access — supervisor/basic have no planning UI surface, and
-- pending/anonymous get nothing.
--
-- Operations are granted per actual app usage:
--   * All four tables: SELECT + INSERT + UPDATE for
--     admin/production_planner. The save flows are upserts
--     (ON CONFLICT DO UPDATE — needs INSERT WITH CHECK and UPDATE
--     USING/WITH CHECK; the ignoreDuplicates seed upsert needs INSERT
--     only), plus carry-forward SELECTs on prior dates.
--   * primal_allocations additionally: DELETE (the allocation editor
--     removes rows by id). The other three tables have NO client
--     DELETE policy — the app never deletes them, so the trail of
--     dated records is append/update-only from clients.
--
-- Audit logging: hog_intake_records, primal_orders, and
-- primal_ending_stock keep their record_audit_log() AFTER triggers
-- (SECURITY DEFINER, RLS-exempt owner). Authorized writes still audit;
-- unauthorized writes are rejected by RLS before any trigger fires.
-- NOTE (reported, intentionally not fixed in this phase):
-- primal_allocations has no audit trigger.
--
-- Uses existing helper only: public.is_role(text[]) (20260526000000).
-- Idempotent: policies are dropped-if-exists before creation.
-- =================================================================


-- =================================================================
-- hog_intake_records — read + upsert (no client DELETE)
-- =================================================================
ALTER TABLE public.hog_intake_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hog_intake_planner_select ON public.hog_intake_records;
CREATE POLICY hog_intake_planner_select ON public.hog_intake_records
  FOR SELECT
  USING (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS hog_intake_planner_insert ON public.hog_intake_records;
CREATE POLICY hog_intake_planner_insert ON public.hog_intake_records
  FOR INSERT
  WITH CHECK (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS hog_intake_planner_update ON public.hog_intake_records;
CREATE POLICY hog_intake_planner_update ON public.hog_intake_records
  FOR UPDATE
  USING (public.is_role(ARRAY['admin','production_planner']))
  WITH CHECK (public.is_role(ARRAY['admin','production_planner']));


-- =================================================================
-- primal_orders — read + upsert (no client DELETE)
-- =================================================================
ALTER TABLE public.primal_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS primal_orders_planner_select ON public.primal_orders;
CREATE POLICY primal_orders_planner_select ON public.primal_orders
  FOR SELECT
  USING (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS primal_orders_planner_insert ON public.primal_orders;
CREATE POLICY primal_orders_planner_insert ON public.primal_orders
  FOR INSERT
  WITH CHECK (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS primal_orders_planner_update ON public.primal_orders;
CREATE POLICY primal_orders_planner_update ON public.primal_orders
  FOR UPDATE
  USING (public.is_role(ARRAY['admin','production_planner']))
  WITH CHECK (public.is_role(ARRAY['admin','production_planner']));


-- =================================================================
-- primal_ending_stock — read + upsert incl. previous-day carry-forward
-- reads (no client DELETE)
-- =================================================================
ALTER TABLE public.primal_ending_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS primal_stock_planner_select ON public.primal_ending_stock;
CREATE POLICY primal_stock_planner_select ON public.primal_ending_stock
  FOR SELECT
  USING (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS primal_stock_planner_insert ON public.primal_ending_stock;
CREATE POLICY primal_stock_planner_insert ON public.primal_ending_stock
  FOR INSERT
  WITH CHECK (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS primal_stock_planner_update ON public.primal_ending_stock;
CREATE POLICY primal_stock_planner_update ON public.primal_ending_stock
  FOR UPDATE
  USING (public.is_role(ARRAY['admin','production_planner']))
  WITH CHECK (public.is_role(ARRAY['admin','production_planner']));


-- =================================================================
-- primal_allocations — read + upsert + delete (the allocation editor
-- removes rows by id)
-- =================================================================
ALTER TABLE public.primal_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS primal_alloc_planner_select ON public.primal_allocations;
CREATE POLICY primal_alloc_planner_select ON public.primal_allocations
  FOR SELECT
  USING (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS primal_alloc_planner_insert ON public.primal_allocations;
CREATE POLICY primal_alloc_planner_insert ON public.primal_allocations
  FOR INSERT
  WITH CHECK (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS primal_alloc_planner_update ON public.primal_allocations;
CREATE POLICY primal_alloc_planner_update ON public.primal_allocations
  FOR UPDATE
  USING (public.is_role(ARRAY['admin','production_planner']))
  WITH CHECK (public.is_role(ARRAY['admin','production_planner']));

DROP POLICY IF EXISTS primal_alloc_planner_delete ON public.primal_allocations;
CREATE POLICY primal_alloc_planner_delete ON public.primal_allocations
  FOR DELETE
  USING (public.is_role(ARRAY['admin','production_planner']));
