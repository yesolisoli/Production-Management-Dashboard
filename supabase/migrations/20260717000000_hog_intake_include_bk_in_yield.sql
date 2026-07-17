-- =================================================================
-- Migration: hog_intake_include_bk_in_yield
--
-- Adds the hog_intake_records.include_bk_in_yield input flag. BK is
-- normally a non-primal hog type (Primal Calc yields off JP + RWA
-- only), but some days its hogs are cut for primal. When this flag is
-- true the day's BK count is folded into the yield pool. It is an
-- operator-set per-day override, entered from the Farm Delivery
-- Records BK row.
--
-- Idempotent: the column is added only if missing, defaulting to
-- false so every existing row reads as "BK excluded" (unchanged
-- behaviour).
-- =================================================================

ALTER TABLE hog_intake_records
  ADD COLUMN IF NOT EXISTS include_bk_in_yield boolean NOT NULL DEFAULT false;
