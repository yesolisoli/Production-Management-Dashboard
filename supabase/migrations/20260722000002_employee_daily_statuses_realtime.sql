-- Broadcast employee_daily_statuses changes over Supabase Realtime so the
-- Daily Lineup board can refetch when the employee app writes a status.
-- Realtime postgres_changes respects RLS: only clients whose role passes the
-- eds_* SELECT policies (staff, or the employee's own row) receive events.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'employee_daily_statuses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_daily_statuses;
  END IF;
END $$;
