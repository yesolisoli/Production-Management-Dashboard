// Extra (non-Primal) floor areas for Orders & Allocation.
//
// The five Primal production groups (Butts / Legs / Loins / Ribs / Picnic) stay
// the single product source of truth for anything that reconciles against
// Primal availability — see types.ts. These EXTRA areas are byproduct / offcut
// areas (jaws, fat heads, …) that only need a floor-instruction LABEL; they
// carry no Primal availability and never appear on the derived production sheet.
//
// Built-in defaults plus operator-added customs. Unlike the per-date draft, the
// area vocabulary is global config, so it lives under its own localStorage key
// (no date) and persists across days and refreshes. Kept isolated here so a
// future DB-backed store can replace just these functions.

// Catch-all area for floor-wide notes that aren't tied to a single product;
// like any area its lines still carry a rule-type colour. Called out as its own
// constant so the sheet can visually distinguish this block from product groups.
export const GENERAL_NOTE_AREA = "General Note";

// Always-available extra areas, shown after the Primal groups in the dropdown.
// These cover the byproduct / offcut lines that appear on the daily allocation
// sheet (jowls, fat, heads, blood, long feet, …) so their default instruction
// rows are first-class and editable, not orphan free-text categories.
export const BUILT_IN_EXTRA_AREAS = [
  "Jowls",
  "Fat",
  "Heads",
  "Masks",
  "Blood",
  "Long Feet",
  "Lungs",
  GENERAL_NOTE_AREA,
] as const;

const CUSTOM_AREAS_KEY = "orders-allocation.custom-areas";

// Trim + collapse internal whitespace. Returns "" for blank input.
export function normalizeAreaLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// Read the operator-added custom areas, normalized and de-duplicated
// (case-insensitive). Returns [] on any storage / parse error.
export function readCustomAreas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_AREAS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const key = normalizeAreaLabel(item);
      const lower = key.toLowerCase();
      if (!key || seen.has(lower)) continue;
      seen.add(lower);
      out.push(key);
    }
    return out;
  } catch {
    return [];
  }
}

export function writeCustomAreas(areas: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_AREAS_KEY, JSON.stringify(areas));
  } catch {
    // ignore quota / access errors
  }
}
