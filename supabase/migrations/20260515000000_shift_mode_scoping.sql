-- =================================================================
-- Scope work_area_shifts by mode_code
-- =================================================================
-- Shifts previously had identity (work_area_id, code). Work areas with
-- multiple mode_views (e.g. hog_break / after_hog_break) shared a single
-- shift list, so editing a shift in one mode affected the other.
--
-- Identity becomes (work_area_id, mode_code, code). For work areas that
-- already have mode_views, every existing shift is duplicated per mode so
-- both modes start with independent copies of the prior data.

ALTER TABLE work_area_shifts
  ADD COLUMN mode_code text NOT NULL DEFAULT 'normal';

-- Allow temporary duplicates during the backfill.
ALTER TABLE work_area_shifts
  DROP CONSTRAINT uq_work_area_shifts_code;

-- Duplicate every existing shift row into each non-normal mode of its work area.
INSERT INTO work_area_shifts (work_area_id, code, label, time_range, display_order, mode_code)
SELECT
  s.work_area_id,
  s.code,
  s.label,
  s.time_range,
  s.display_order,
  mv.mode_code
FROM work_area_shifts s
JOIN work_area_mode_views mv ON mv.work_area_id = s.work_area_id
WHERE s.mode_code = 'normal'
  AND mv.mode_code <> 'normal';

-- Drop the original 'normal' rows for work areas that now have per-mode copies.
DELETE FROM work_area_shifts s
WHERE s.mode_code = 'normal'
  AND EXISTS (
    SELECT 1
    FROM work_area_mode_views mv
    WHERE mv.work_area_id = s.work_area_id
  );

-- Re-establish uniqueness on the new (work_area_id, mode_code, code) tuple.
ALTER TABLE work_area_shifts
  ADD CONSTRAINT uq_work_area_shifts_code UNIQUE (work_area_id, mode_code, code);

CREATE INDEX idx_work_area_shifts_work_area_mode
  ON work_area_shifts (work_area_id, mode_code, display_order);
