export type LineupStatus =
  | "over"
  | "critical"
  | "short"
  | "on_track"
  | "full_crew";

export type WorkAreaStats = {
  workAreaId: string;
  workAreaName: string;
  workAreaColorHex: string | null;
  required: number;
  assigned: number;
  absent: number;
  vacation: number;
  lightDuty: number;
  overTarget: number;
  status: LineupStatus;
};

export type LineupSummary = {
  totalAssigned: number;
  totalTarget: number;
  lightDuty: number;
  totalAbsent: number;
  onVacation: number;
  deptsShort: number;
  deptsCritical: number;
  deptsOver: number;
  deptsOnTrack: number;
  deptsFullCrew: number;
};
