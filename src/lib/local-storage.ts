// Shared per-date draft-store factory for localStorage.
//
// This module extracts the boilerplate that the feature draft stores
// (hog-intake, primal-calculation, orders-allocation) already repeat verbatim:
// the SSR guard (`typeof window === "undefined"`), the try/catch that swallows
// quota / access errors, and the read → JSON.parse → coerce → clear shape.
//
// It intentionally makes NO behavioural decisions of its own — coercion,
// defaults, and null-vs-empty semantics stay in each feature's `coerce`
// callback.

// ------------------------------------------------------------------
// Per-date draft store factory
//
// Builds the read/write/clear trio that hog-intake, primal, and
// orders-allocation each hand-roll around a `${prefix}${date}` key. The
// read path parses and coerces inside a SINGLE try/catch so the exact
// current behaviour is preserved:
//
//   * SSR / no window            → readDraft returns null; write/clear no-op
//   * missing key (`!raw`)       → readDraft returns null (before parsing)
//   * JSON.parse throws          → caught → readDraft returns null
//   * coerce throws (e.g. property access on a parsed `null`) → caught → null
//   * otherwise                  → returns whatever `coerce` returns
//
// The caller's `coerce` owns ALL shape decisions, including whether a
// successfully-parsed value maps to a default object or to `null`.
// ------------------------------------------------------------------

export type DateDraftStore<T> = {
  readDraft: (date: string) => T | null;
  writeDraft: (date: string, value: T) => void;
  clearDraft: (date: string) => void;
};

export function createDateDraftStore<T>(
  prefix: string,
  coerce: (raw: unknown, date: string) => T | null,
): DateDraftStore<T> {
  const draftKey = (date: string): string => `${prefix}${date}`;

  return {
    readDraft(date: string): T | null {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(draftKey(date));
        if (!raw) return null;
        return coerce(JSON.parse(raw), date);
      } catch {
        return null;
      }
    },

    writeDraft(date: string, value: T): void {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(draftKey(date), JSON.stringify(value));
      } catch {
        // ignore quota / access errors
      }
    },

    clearDraft(date: string): void {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(draftKey(date));
      } catch {
        // ignore
      }
    },
  };
}
