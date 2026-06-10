-- =================================================================
-- Migration: hog_intake_sow_scheduled
--
-- Adds the sow_scheduled input column to hog_intake_records. Until now
-- the "Scheduled For Today" Sow figure was draft-only and reset to 0 on
-- every server load; persisting it lets the Primal Calculation banner's
-- Sow value survive refresh and stay shared across devices/users, the
-- same way the rest of the intake inputs do.
--
-- Notes:
--   * RLS is intentionally NOT enabled in this phase (mirrors the table).
--   * All statements are idempotent.
-- =================================================================

ALTER TABLE hog_intake_records
  ADD COLUMN IF NOT EXISTS sow_scheduled integer NOT NULL DEFAULT 0;

ALTER TABLE hog_intake_records DROP CONSTRAINT IF EXISTS chk_hog_intake_sow_scheduled_nonneg;
ALTER TABLE hog_intake_records
  ADD CONSTRAINT chk_hog_intake_sow_scheduled_nonneg CHECK (sow_scheduled >= 0);
