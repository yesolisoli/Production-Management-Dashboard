import { useMemo } from "react";
import { useAssignmentBoardData } from "@/features/assignment-board/hooks/use-assignment-board-data";
import { computeAllStats, computeSummary } from "../utils/compute-stats";
import { useTargetOverrides } from "./use-target-overrides";
import type { LineupSummary, WorkAreaStats } from "../types";

type UseDailyLineupResult = {
  workAreaStats: WorkAreaStats[];
  summary: LineupSummary;
  isHydrating: boolean;
  loadError: string | null;
};

export function useDailyLineup(): UseDailyLineupResult {
  const {
    workAreas,
    employees,
    statuses,
    statusConfigs,
    isHydrating,
    loadError,
  } = useAssignmentBoardData();

  const { overrides: targetOverrides } = useTargetOverrides();

  const workAreaStats = useMemo(
    () => computeAllStats({ workAreas, employees, statuses, statusConfigs, targetOverrides }),
    [workAreas, employees, statuses, statusConfigs, targetOverrides],
  );

  const summary = useMemo(() => computeSummary(workAreaStats), [workAreaStats]);

  return { workAreaStats, summary, isHydrating, loadError };
}
