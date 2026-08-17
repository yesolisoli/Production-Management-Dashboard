-- =================================================================
-- Migration: rls_primal_snapshots_if_exists
-- Companion to rls_production_planning.
--
-- primal_snapshots is a leftover from the reverted Orders & Allocation
-- V1 sign-off work: no migration creates it and no application code
-- reads or writes it (primal-demand-source.ts only mentions it in a
-- comment as a future design). It was created manually in at least one
-- environment and holds signed-off order/availability data, so where
-- it exists it must not stay world-readable.
--
-- Guarded: enables RLS (deny-all — zero policies) ONLY if the table
-- exists, so environments without the manual table apply cleanly.
-- The service role still bypasses RLS; when the sign-off feature lands
-- for real, its migration will add proper policies.
-- =================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'primal_snapshots'
  ) THEN
    EXECUTE 'ALTER TABLE public.primal_snapshots ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
