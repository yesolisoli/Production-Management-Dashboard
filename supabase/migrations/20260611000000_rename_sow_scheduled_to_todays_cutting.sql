-- =================================================================
-- Migration: rename_sow_scheduled_to_todays_cutting
--
-- Renames the hog_intake_records.sow_scheduled input column to
-- todays_cutting. The figure is unchanged — it's the day's count
-- slated for processing — but the UI label moved from "Scheduled For
-- Today" to "Today's Cutting", so the column and its check constraint
-- follow suit to avoid drift between schema and app.
--
-- Idempotent:
--   * If sow_scheduled still exists, it is renamed to todays_cutting.
--   * If todays_cutting already exists (fresh/local), the rename is a
--     no-op and the column is ensured.
--   * The NOT NULL / DEFAULT 0 and the non-negative CHECK are
--     reinstalled under the new name.
-- =================================================================

-- Rename only when the old column is present and the new one is not, so
-- the migration is safe to re-run (Postgres has no RENAME COLUMN IF EXISTS).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hog_intake_records' AND column_name = 'sow_scheduled'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hog_intake_records' AND column_name = 'todays_cutting'
  ) THEN
    ALTER TABLE hog_intake_records RENAME COLUMN sow_scheduled TO todays_cutting;
  END IF;
END $$;

ALTER TABLE hog_intake_records
  ADD COLUMN IF NOT EXISTS todays_cutting integer NOT NULL DEFAULT 0;

-- Swap the old constraint for one named after the new column.
ALTER TABLE hog_intake_records DROP CONSTRAINT IF EXISTS chk_hog_intake_sow_scheduled_nonneg;
ALTER TABLE hog_intake_records DROP CONSTRAINT IF EXISTS chk_hog_intake_todays_cutting_nonneg;
ALTER TABLE hog_intake_records
  ADD CONSTRAINT chk_hog_intake_todays_cutting_nonneg CHECK (todays_cutting >= 0);
