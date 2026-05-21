-- =================================================================
-- Date-independent live board
-- =================================================================
-- Removes the date dimension from live assignment + status tables.
-- The live board now represents current state only; historical
-- tracking is handled exclusively by assignment_board_snapshots.
--
-- Reversibility:
--   *_legacy backup tables retain every row that existed before the
--   migration. To roll back, restore from those tables and recreate
--   the original work_date-scoped unique constraints.

-- ------------------------------------------------------------------
-- 1. Backup live tables (idempotent; safe to re-run)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS station_assignments_legacy
  AS SELECT * FROM station_assignments WITH NO DATA;
INSERT INTO station_assignments_legacy
  SELECT * FROM station_assignments
  ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS employee_daily_statuses_legacy
  AS SELECT * FROM employee_daily_statuses WITH NO DATA;
INSERT INTO employee_daily_statuses_legacy
  SELECT * FROM employee_daily_statuses
  ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------
-- 2. Defensive dedup against the new (date-less) uniqueness keys.
--    In current data all rows share a single work_date so this is a
--    no-op, but it makes the migration safe if multiple dates exist.
-- ------------------------------------------------------------------
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, station_id, shift_code, mode_code
      ORDER BY work_date DESC, updated_at DESC
    ) AS rn
  FROM station_assignments
  WHERE station_id IS NOT NULL
)
DELETE FROM station_assignments
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, work_area_id
      ORDER BY work_date DESC, updated_at DESC
    ) AS rn
  FROM station_assignments
  WHERE station_id IS NULL
)
DELETE FROM station_assignments
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id
      ORDER BY work_date DESC, created_at DESC
    ) AS rn
  FROM employee_daily_statuses
)
DELETE FROM employee_daily_statuses
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ------------------------------------------------------------------
-- 3. Drop work_date-scoped constraints / indexes
-- ------------------------------------------------------------------
DROP INDEX IF EXISTS uq_station_assignments_real;
DROP INDEX IF EXISTS uq_station_assignments_dept_only;
DROP INDEX IF EXISTS idx_station_assignments_work_date;
DROP INDEX IF EXISTS idx_station_assignments_employee_date;
DROP INDEX IF EXISTS idx_station_assignments_station_date;
DROP INDEX IF EXISTS idx_employee_daily_statuses_work_date;

ALTER TABLE employee_daily_statuses
  DROP CONSTRAINT IF EXISTS uq_employee_daily_status;

-- ------------------------------------------------------------------
-- 4. Recreate uniqueness without work_date
-- ------------------------------------------------------------------
CREATE UNIQUE INDEX uq_station_assignments_real
  ON station_assignments (employee_id, station_id, shift_code, mode_code)
  WHERE station_id IS NOT NULL;

CREATE UNIQUE INDEX uq_station_assignments_dept_only
  ON station_assignments (employee_id, work_area_id)
  WHERE station_id IS NULL;

ALTER TABLE employee_daily_statuses
  ADD CONSTRAINT uq_employee_daily_status UNIQUE (employee_id);

-- ------------------------------------------------------------------
-- 5. Normalize daily-status PKs to be employee-scoped instead of
--    (employee, date)-scoped. Safe because the column is internal.
-- ------------------------------------------------------------------
UPDATE employee_daily_statuses
   SET id = 'status_' || employee_id
 WHERE id <> 'status_' || employee_id;

-- ------------------------------------------------------------------
-- 6. Auto-populate work_date so the column can stay during the code
--    transition without callers needing to supply it. Drop the
--    column in a follow-up migration once the live board has run
--    cleanly on this schema.
-- ------------------------------------------------------------------
ALTER TABLE station_assignments     ALTER COLUMN work_date SET DEFAULT current_date;
ALTER TABLE employee_daily_statuses ALTER COLUMN work_date SET DEFAULT current_date;
