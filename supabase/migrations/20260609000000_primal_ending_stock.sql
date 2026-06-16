-- =================================================================
-- Migration: primal_ending_stock
--
-- Per work date, per production group calculated "Ending Stock" (pieces)
-- from the Primal Calculation Availability Chart.
--
-- The carry-over chain: on every recalculation the computed Ending Stock is
-- upserted here; opening the next work date loads the most recent PRIOR
-- date's values as that day's "Opening Stock". Storing the derived snapshot
-- lets the chain survive refresh and stay shared across devices/users,
-- matching how hog_intake_records persists.
--
-- One row per (work_date, group_name). Only the five production GROUP keys
-- are written (Butts, Legs, Loins, Ribs, Picnic) — Ending Stock is a
-- group-level figure because production comes from whole hogs, not per SKU.
--
-- Notes:
--   * RLS is intentionally NOT enabled in this phase (mirrors hog_intake).
--   * All statements are idempotent.
-- =================================================================

CREATE TABLE IF NOT EXISTS primal_ending_stock (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date     date        NOT NULL,
  group_name    text        NOT NULL,
  ending_stock  integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_date, group_name)
);

-- Reuse the shared set_updated_at() trigger from the initial schema so
-- updated_at advances on every upsert that touches an existing row.
DROP TRIGGER IF EXISTS trg_primal_ending_stock_updated_at ON primal_ending_stock;
CREATE TRIGGER trg_primal_ending_stock_updated_at
BEFORE UPDATE ON primal_ending_stock
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- The carry-over lookup is "latest work_date strictly before X" — a
-- descending index on work_date serves it directly.
CREATE INDEX IF NOT EXISTS idx_primal_ending_stock_work_date
  ON primal_ending_stock (work_date DESC);
