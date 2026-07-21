-- =================================================================
-- Migration: primal_allocations
--
-- Operator-entered stock allocations on the Primal Calculation
-- Availability Chart. Each row reserves a quantity of one production
-- group's stock (pieces) for a target date — carved out of that work
-- date's Available Stock so it isn't double-sold.
--
-- Unlike primal_ending_stock (one derived row per group), an allocation
-- is a RAW operator input: many rows may exist per (work_date, group),
-- each with its own target date and optional label. The Availability
-- Chart sums them per group and subtracts the total from Available Stock
-- (and therefore Ending Stock — so a reservation stays out of the
-- carry-over pool the next day inherits).
--
-- One work_date is the date the stock is deducted from (the date being
-- viewed); target_date is where the reserved stock is destined.
--
-- Notes:
--   * RLS is intentionally NOT enabled in this phase (mirrors
--     primal_ending_stock / hog_intake).
--   * `id` is client-generated (crypto.randomUUID) so the row's state
--     key is known before the insert round-trips.
--   * All statements are idempotent.
-- =================================================================

CREATE TABLE IF NOT EXISTS primal_allocations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date    date        NOT NULL,
  group_name   text        NOT NULL,
  qty_pcs      integer     NOT NULL DEFAULT 0,
  target_date  date        NOT NULL,
  label        text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Reuse the shared set_updated_at() trigger from the initial schema so
-- updated_at advances on every upsert that touches an existing row.
DROP TRIGGER IF EXISTS trg_primal_allocations_updated_at ON primal_allocations;
CREATE TRIGGER trg_primal_allocations_updated_at
BEFORE UPDATE ON primal_allocations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- The chart loads every allocation for the viewed work date, so an index
-- on work_date serves the per-date fetch directly.
CREATE INDEX IF NOT EXISTS idx_primal_allocations_work_date
  ON primal_allocations (work_date);
