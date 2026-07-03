// Navigation save-guard. A screen with unsaved work registers an async `flush`
// here; the sidebar awaits it (letting a pending DB save finish) BEFORE it
// navigates away. This closes the race where leaving Hog Intake too quickly
// would let a downstream screen (Primal Calc reads DB-only) fetch before the
// save landed.
//
// Module-level singleton on purpose: only one editing screen is mounted at a
// time, so a single active flush is all we need — no provider/context wiring.
type FlushFn = () => Promise<void> | void;

let activeFlush: FlushFn | null = null;

// Register (or clear, with null) the current screen's flush. Call on mount and
// clear on unmount so a stale flush can't run after the screen is gone.
export function registerNavigationFlush(flush: FlushFn | null): void {
  activeFlush = flush;
}

// Run the active flush, swallowing errors: a failed save must not trap the user
// on the page — the source screen surfaces its own error state, and navigation
// proceeds regardless.
export async function runNavigationFlush(): Promise<void> {
  if (!activeFlush) return;
  try {
    await activeFlush();
  } catch {
    // ignore — see note above
  }
}
