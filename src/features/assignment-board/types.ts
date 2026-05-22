export type ShiftCode = string;

export type ModeCode =
  | "normal"
  | "hog_break"
  | "after_hog_break"
  | "break_1"
  | "lunch"
  | "break_2";

export const DEFAULT_MODE_CODE: ModeCode = "normal";

export type EmployeeStatus = string;

export type ShiftInfo = {
  code: ShiftCode;
  label: string;
  time_range: string;
};

/**
 * Shifts are scoped by (work_area_id, mode_code). Work areas without modes
 * store their shifts under DEFAULT_MODE_CODE ("normal").
 */
export type WorkAreaShiftMap = Record<string, Record<ModeCode, ShiftInfo[]>>;

export type WorkAreaModeView = {
  mode_code: ModeCode;
  label: string;
  time_range?: string;
};

export type Employee = {
  id: string;
  employee_code: string | null;
  full_name: string;
  /** Primary/home work area id */
  homeDepartmentId: string | null;
  /** All work area ids this employee is qualified for (includes homeDepartmentId) */
  qualifiedDepartmentIds: string[];

  active: boolean;
  gender?: "M" | "F";
  level?: 1 | 2 | 3;
  temporary?: boolean;
};

export type WorkArea = {
  id: string;
  name: string;
  color_hex: string | null;
  display_order: number;
  mode_views?: WorkAreaModeView[];
};

export type Station = {
  id: string;
  work_area_id: string;
  name: string;
  required_headcount: number;
  display_order: number;
  mode_code?: ModeCode;
  protected?: boolean;
  group?: string;
  gender_restriction?: "M" | "F";
  defaultEmployeeId?: string;
};

export type EmployeeDailyStatus = {
  id: string;
  employee_id: string;
  work_date: string;
  shift_code: ShiftCode;
  mode_code: ModeCode;
  status: EmployeeStatus;
  reason: string | null;
};

export type StationAssignment = {
  id: string;
  employee_id: string;
  /** null = active in department but not yet assigned to a real station */
  station_id: string | null;
  /** populated when station_id is null; identifies the work area for dept-only assignments */
  work_area_id: string | null;
  work_date: string;
  shift_code: ShiftCode;
  mode_code: ModeCode;
};
