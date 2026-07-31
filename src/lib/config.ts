// Centralized environment flag parsing. Consumers must import the exported
// constants below instead of reading process.env themselves.

/**
 * Parse NEXT_PUBLIC_AUTH_ENABLED with fail-closed production semantics.
 *
 * Accepted values: "true" | "false" (anything else is a configuration error).
 *
 * Production (NODE_ENV === "production"):
 *   - Missing or empty → throws at startup/build. Auth is never silently
 *     disabled because of a missing or misspelled variable.
 *   - "true" → auth enabled; "false" → auth explicitly disabled.
 *
 * Development / test:
 *   - Missing or empty → auth disabled (prototype workflow preserved).
 *   - Invalid values still throw so typos are caught early.
 *
 * Note: NEXT_PUBLIC_* vars are inlined at build time, so the literal
 * `process.env.NEXT_PUBLIC_AUTH_ENABLED` access must be kept as-is.
 */
function parseAuthEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_AUTH_ENABLED;

  if (raw === "true") return true;
  if (raw === "false") return false;

  if (raw === undefined || raw === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        'NEXT_PUBLIC_AUTH_ENABLED must be explicitly set to "true" or "false" in production. ' +
          "Refusing to start rather than silently disabling authentication.",
      );
    }
    return false;
  }

  throw new Error(
    `Invalid NEXT_PUBLIC_AUTH_ENABLED value "${raw}". Expected "true" or "false".`,
  );
}

export const AUTH_ENABLED = parseAuthEnabled();

export const SUPABASE_ENABLED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
