import type { Employee } from "@/features/assignment-board/types";

/**
 * Per-work-area operational staffing targets.
 *
 * This is the conceptual source of truth for "how many people should be
 * working in this department." It is intentionally decoupled from the
 * home roster size — `employee.homeDepartmentId` is only used for
 * grouping headcount (who counts toward this department), not for
 * deciding the target. A target can be lower or higher than the roster.
 *
 * Add or adjust entries here as ops defines targets per department:
 *   wa_meat: 25,
 *
 * This map is the default target source. Admin edits are stored in the
 * DB-backed `work_areas.target_override` column, which takes precedence
 * over these values in `resolveWorkAreaTarget`.
 */
export const WORK_AREA_TARGET_OVERRIDES: Record<string, number> = {
  // Seed-data targets chosen so the Daily Lineup demo surfaces every
  // LineupStatus (over / short / critical / on_track / full_crew) across the
  // five work areas. Adjust freely as ops updates the staffing goal.
  wa_loading: 37,     // assigned 35 → on_track   (deficit 2)
  wa_small: 37,       // assigned 37 → full_crew  (deficit 0)
  wa_processing: 38,  // assigned 32 → critical   (deficit 6)
  wa_meat: 70,        // assigned 73 → over       (+3)
  wa_packaging: 73,   // assigned 70 → short      (deficit 3)
};

/**
 * Resolve the operational staffing target for a work area.
 *
 * Precedence:
 *  1. DB-backed override (admin-edited via the Assignment Board target modal,
 *     stored in `work_areas.target_override`; null means no override).
 *  2. Static value in WORK_AREA_TARGET_OVERRIDES.
 *  3. Fallback: count of active employees whose homeDepartmentId matches
 *     this work area. Safety net only — not the real definition of "target."
 */
export function resolveWorkAreaTarget(
  workAreaId: string,
  employees: Employee[],
  targetOverride?: number | null,
): number {
  if (targetOverride != null) return targetOverride;
  const configured = WORK_AREA_TARGET_OVERRIDES[workAreaId];
  if (configured !== undefined) return configured;
  return employees.filter(
    (e) => e.active && e.homeDepartmentId === workAreaId,
  ).length;
}
