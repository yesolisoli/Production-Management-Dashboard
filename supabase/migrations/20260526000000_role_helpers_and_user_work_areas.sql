-- =================================================================
-- Migration: role_helpers_and_user_work_areas
-- Phase 4A: foundation for RLS. NO policies, NO RLS enable yet.
--
-- Adds:
--   * public.is_role(text[]) — helper used by future RLS policies
--   * public.user_work_areas — forward-compatible scaffolding for
--     department-scoped supervisor restrictions (no app reads it
--     today; no policies reference it yet)
--
-- Intentionally NOT in this migration:
--   * CREATE POLICY of any kind
--   * ENABLE ROW LEVEL SECURITY on any table
--   * Changes to chk_profiles_role (no kiosk role)
--
-- All statements are idempotent.
-- =================================================================


-- =================================================================
-- is_role
-- True when the current authenticated user's role is in the supplied
-- list. Wraps public.user_role() from the Phase 1 profiles migration.
-- STABLE + SECURITY DEFINER so it can be called from RLS policies
-- without recursing into profiles policies; search_path pinned.
-- =================================================================
CREATE OR REPLACE FUNCTION public.is_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_role() = ANY(roles);
$$;


-- =================================================================
-- user_work_areas
-- Maps auth users to the work areas they are scoped to. Reserved
-- for future department-specific supervisor restrictions. RLS is
-- intentionally not enabled here; no app code reads or writes it.
-- =================================================================
CREATE TABLE IF NOT EXISTS public.user_work_areas (
  user_id      uuid        NOT NULL REFERENCES auth.users (id)      ON DELETE CASCADE,
  work_area_id text        NOT NULL REFERENCES public.work_areas (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_area_id)
);

CREATE INDEX IF NOT EXISTS idx_user_work_areas_work_area
  ON public.user_work_areas (work_area_id);
