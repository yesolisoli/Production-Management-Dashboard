-- =================================================================
-- Migration: work_area_target_override
--
-- Adds an admin-editable target headcount override to work_areas,
-- replacing the localStorage-based Daily Lineup target overrides.
-- NULL means "use the default target" (static config / home-roster
-- fallback resolved in the app).
-- =================================================================

ALTER TABLE public.work_areas
  ADD COLUMN IF NOT EXISTS target_override integer
  CONSTRAINT work_areas_target_override_nonnegative CHECK (target_override >= 0);

-- Broadcast work_areas changes over Supabase Realtime so the Daily
-- Lineup / TV displays pick up target edits without a refresh.
-- Follows the same guarded pattern as employee_daily_statuses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'work_areas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_areas;
  END IF;
END $$;
