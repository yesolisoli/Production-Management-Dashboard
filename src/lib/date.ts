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

// The calendar day immediately before `date` (YYYY-MM-DD), as YYYY-MM-DD.
// Built from the local-calendar components so month/year rollovers are handled
// correctly and the result never shifts across a timezone boundary.
export function previousDateString(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const prev = new Date(y, m - 1, d);
  prev.setDate(prev.getDate() - 1);
  const py = prev.getFullYear();
  const pm = String(prev.getMonth() + 1).padStart(2, "0");
  const pd = String(prev.getDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}`;
}
