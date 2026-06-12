// Local-calendar date helpers.

// Today's date as YYYY-MM-DD in the LOCAL timezone (getFullYear/getMonth/
// getDate, not the UTC accessors), so the value tracks the operator's workday
// rather than shifting at UTC midnight. Shared by the Hog Intake and Primal
// Calculation state hooks.
export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
