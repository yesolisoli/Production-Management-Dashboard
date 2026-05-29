-- =================================================================
-- Migration: hog_intake_records
--
-- One row per intake_date capturing the raw inputs operators enter
-- on the Hog Intake screen. Computed values (total_hogs, for_cutting,
-- yield_total, projected_for_cutting) are NEVER stored — they are
-- recomputed from inputs in the UI and in downstream modules.
--
-- Notes:
--   * RLS is intentionally NOT enabled in this phase.
--   * All statements are written to be idempotent.
-- =================================================================


CREATE TABLE IF NOT EXISTS hog_intake_records (
  intake_date       date        PRIMARY KEY,
  hog_counts        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  side_orders       integer     NOT NULL DEFAULT 0,
  held_over         integer     NOT NULL DEFAULT 0,
  deaths_on_arrival integer     NOT NULL DEFAULT 0,
  boars_count       integer     NOT NULL DEFAULT 0,
  notes             text        NOT NULL DEFAULT '',
  farm_records      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  next_day          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid        REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Non-negative input constraints (idempotent: drop-if-exists then add).
ALTER TABLE hog_intake_records DROP CONSTRAINT IF EXISTS chk_hog_intake_side_orders_nonneg;
ALTER TABLE hog_intake_records DROP CONSTRAINT IF EXISTS chk_hog_intake_held_over_nonneg;
ALTER TABLE hog_intake_records DROP CONSTRAINT IF EXISTS chk_hog_intake_doa_nonneg;
ALTER TABLE hog_intake_records DROP CONSTRAINT IF EXISTS chk_hog_intake_boars_nonneg;

ALTER TABLE hog_intake_records
  ADD CONSTRAINT chk_hog_intake_side_orders_nonneg CHECK (side_orders >= 0),
  ADD CONSTRAINT chk_hog_intake_held_over_nonneg CHECK (held_over >= 0),
  ADD CONSTRAINT chk_hog_intake_doa_nonneg CHECK (deaths_on_arrival >= 0),
  ADD CONSTRAINT chk_hog_intake_boars_nonneg CHECK (boars_count >= 0);

-- Reuse the shared set_updated_at() trigger from the initial schema.
DROP TRIGGER IF EXISTS trg_hog_intake_records_updated_at ON hog_intake_records;
CREATE TRIGGER trg_hog_intake_records_updated_at
BEFORE UPDATE ON hog_intake_records
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_hog_intake_records_intake_date
  ON hog_intake_records (intake_date DESC);
