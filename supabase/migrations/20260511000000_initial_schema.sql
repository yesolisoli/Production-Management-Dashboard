-- =================================================================
-- Migration: 0001_initial_schema
-- =================================================================


-- =================================================================
-- shared trigger helpers
-- =================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =================================================================
-- work_areas
-- =================================================================
CREATE TABLE work_areas (
  id            text        PRIMARY KEY,
  name          text        NOT NULL,
  color_hex     text,
  display_order integer     NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_areas_display_order
  ON work_areas (display_order);


-- =================================================================
-- work_area_mode_views
-- =================================================================
CREATE TABLE work_area_mode_views (
  work_area_id  text        NOT NULL REFERENCES work_areas (id) ON DELETE CASCADE,
  mode_code     text        NOT NULL,
  label         text        NOT NULL,
  time_range    text,
  display_order integer     NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_work_area_mode_views UNIQUE (work_area_id, mode_code)
);

CREATE INDEX idx_work_area_mode_views_work_area
  ON work_area_mode_views (work_area_id, display_order);


-- =================================================================
-- work_area_shifts
-- =================================================================
CREATE TABLE work_area_shifts (
  work_area_id  text        NOT NULL REFERENCES work_areas (id) ON DELETE CASCADE,
  code          text        NOT NULL,
  label         text        NOT NULL,
  time_range    text        NOT NULL DEFAULT '',
  display_order integer     NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_work_area_shifts_code UNIQUE (work_area_id, code)
);

CREATE INDEX idx_work_area_shifts_work_area
  ON work_area_shifts (work_area_id, display_order);


-- =================================================================
-- status_configs
-- =================================================================
CREATE TABLE status_configs (
  code          text        PRIMARY KEY,
  label         text        NOT NULL,
  color_hex     text,
  unavailable   boolean     NOT NULL DEFAULT false,
  display_order integer     NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);


-- =================================================================
-- employees
-- =================================================================
CREATE TABLE employees (
  id                text        PRIMARY KEY,
  employee_code     text        UNIQUE,
  full_name         text        NOT NULL,
  home_work_area_id text        NOT NULL REFERENCES work_areas (id),
  active            boolean     NOT NULL DEFAULT true,
  gender            text        CHECK (gender IN ('M', 'F')),
  level             integer,
  temporary         boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_home_work_area
  ON employees (home_work_area_id);

CREATE INDEX idx_employees_active
  ON employees (active);


-- =================================================================
-- employee_qualified_work_areas
-- =================================================================
CREATE TABLE employee_qualified_work_areas (
  employee_id  text NOT NULL REFERENCES employees  (id) ON DELETE CASCADE,
  work_area_id text NOT NULL REFERENCES work_areas (id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, work_area_id)
);

CREATE INDEX idx_eqwa_work_area
  ON employee_qualified_work_areas (work_area_id);


-- =================================================================
-- stations
-- =================================================================
CREATE TABLE stations (
  id                  text        PRIMARY KEY,
  work_area_id        text        NOT NULL REFERENCES work_areas (id) ON DELETE CASCADE,
  name                text        NOT NULL,
  required_headcount  integer     NOT NULL DEFAULT 1 CHECK (required_headcount > 0),
  display_order       integer     NOT NULL,
  mode_code           text,
  gender_restriction  text        CHECK (gender_restriction IN ('M', 'F')),
  default_employee_id text        REFERENCES employees (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stations_work_area
  ON stations (work_area_id, display_order);

CREATE INDEX idx_stations_default_employee
  ON stations (default_employee_id);


-- =================================================================
-- employee_daily_statuses
-- =================================================================
CREATE TABLE employee_daily_statuses (
  id          text        PRIMARY KEY,
  employee_id text        NOT NULL REFERENCES employees      (id) ON DELETE CASCADE,
  work_date   date        NOT NULL,
  status_code text        NOT NULL REFERENCES status_configs (code)
                            ON UPDATE CASCADE
                            ON DELETE RESTRICT,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_daily_status UNIQUE (employee_id, work_date)
);

CREATE INDEX idx_employee_daily_statuses_work_date
  ON employee_daily_statuses (work_date);

CREATE INDEX idx_employee_daily_statuses_employee
  ON employee_daily_statuses (employee_id);


-- =================================================================
-- station_assignments
-- =================================================================
CREATE TABLE station_assignments (
  id           text        PRIMARY KEY,
  employee_id  text        NOT NULL REFERENCES employees  (id) ON DELETE CASCADE,
  station_id   text        REFERENCES stations            (id) ON DELETE CASCADE,
  work_area_id text        REFERENCES work_areas          (id) ON DELETE CASCADE,
  work_date    date        NOT NULL,
  shift_code   text,
  mode_code    text        NOT NULL DEFAULT 'normal',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_station_assignments_target_xor
    CHECK (
      (station_id IS NOT NULL AND work_area_id IS NULL) OR
      (station_id IS NULL AND work_area_id IS NOT NULL)
    )
);

CREATE INDEX idx_station_assignments_work_date
  ON station_assignments (work_date);

CREATE INDEX idx_station_assignments_employee_date
  ON station_assignments (employee_id, work_date);

CREATE INDEX idx_station_assignments_station_date
  ON station_assignments (station_id, work_date)
  WHERE station_id IS NOT NULL;

CREATE UNIQUE INDEX uq_station_assignments_real
  ON station_assignments (employee_id, station_id, shift_code, mode_code, work_date)
  WHERE station_id IS NOT NULL;

CREATE UNIQUE INDEX uq_station_assignments_dept_only
  ON station_assignments (employee_id, work_area_id, work_date)
  WHERE station_id IS NULL;


-- =================================================================
-- updated_at triggers
-- =================================================================
CREATE TRIGGER trg_work_areas_updated_at
BEFORE UPDATE ON work_areas
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stations_updated_at
BEFORE UPDATE ON stations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_status_configs_updated_at
BEFORE UPDATE ON status_configs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_station_assignments_updated_at
BEFORE UPDATE ON station_assignments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
