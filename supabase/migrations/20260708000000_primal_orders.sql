-- =================================================================
-- Migration: primal_orders
--
-- Server persistence for the COMMITTED per-SKU production orders that
-- the Primal Calculation screen previously kept only in the localStorage
-- key `primal-calc.orders`. One row per (work_date, sku) holding the two
-- raw input fields (today_cases, today_pcs).
--
-- Draft edits stay in localStorage (`primal-calc.draft.<date>`); only an
-- explicit Save writes here, mirroring how primal_ending_stock persists.
-- Saving is an UPSERT of just the saved SKU subset, so a per-group Save
-- never deletes or overwrites the other groups' rows.
--
-- Notes:
--   * RLS is intentionally NOT enabled in this phase (mirrors the sibling
--     tables hog_intake_records / primal_ending_stock). SEE the security
--     phase before real production exposure — the anon key can otherwise
--     read/write these rows.
--   * All statements are idempotent.
-- =================================================================

CREATE TABLE IF NOT EXISTS primal_orders (
  work_date    date        NOT NULL,
  sku          text        NOT NULL,
  today_cases  integer     NOT NULL DEFAULT 0,
  today_pcs    integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  PRIMARY KEY (work_date, sku)
);

-- Non-negative input constraints (idempotent: drop-if-exists then add).
ALTER TABLE primal_orders DROP CONSTRAINT IF EXISTS chk_primal_orders_cases_nonneg;
ALTER TABLE primal_orders DROP CONSTRAINT IF EXISTS chk_primal_orders_pcs_nonneg;
ALTER TABLE primal_orders
  ADD CONSTRAINT chk_primal_orders_cases_nonneg CHECK (today_cases >= 0),
  ADD CONSTRAINT chk_primal_orders_pcs_nonneg   CHECK (today_pcs   >= 0);

-- Reuse the shared set_updated_at() trigger from the initial schema so
-- updated_at advances on every upsert that touches an existing row.
DROP TRIGGER IF EXISTS trg_primal_orders_updated_at ON primal_orders;
CREATE TRIGGER trg_primal_orders_updated_at
BEFORE UPDATE ON primal_orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- No extra index: the only read is `WHERE work_date = $1`, already served
-- by the (work_date, sku) primary key's leading column.

-- ---------------------------------------------------------------------
-- RLS scaffold (COMMENTED OUT — enable in the security phase alongside
-- the other tables). Kept here as the intended shape; NOT activated so
-- current behavior (AUTH_ENABLED gating in the app only) is preserved.
-- ---------------------------------------------------------------------
-- ALTER TABLE primal_orders ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY primal_orders_read  ON primal_orders FOR SELECT
--   USING (is_role(ARRAY['admin', 'production_planner']));
-- CREATE POLICY primal_orders_write ON primal_orders FOR ALL
--   USING (is_role(ARRAY['admin', 'production_planner']))
--   WITH CHECK (is_role(ARRAY['admin', 'production_planner']));
