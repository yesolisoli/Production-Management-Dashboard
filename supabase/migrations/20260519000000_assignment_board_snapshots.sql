-- =================================================================
-- assignment_board_snapshots
-- =================================================================
-- Frozen, self-contained JSON copy of the assignment board taken
-- once per work_date after shift end + grace period. History page
-- reads these rows; live board never reads or writes them.

CREATE TABLE assignment_board_snapshots (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date   date        NOT NULL UNIQUE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  snapshot    jsonb       NOT NULL
);

CREATE INDEX idx_assignment_board_snapshots_work_date
  ON assignment_board_snapshots (work_date DESC);
