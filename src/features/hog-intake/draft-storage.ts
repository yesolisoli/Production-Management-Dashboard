import { emptyHogCounts, HOG_TYPES, type HogIntakeRecord } from "./types";

const DRAFT_KEY_PREFIX = "hog-intake.draft.";

function draftKey(date: string): string {
  return `${DRAFT_KEY_PREFIX}${date}`;
}

// Validate a parsed value enough to trust it as a HogIntakeRecord.
// Anything missing falls back to the empty-shape default so a partially
// corrupt draft still loads.
function coerceDraft(raw: unknown, date: string): HogIntakeRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const counts = (r.hog_counts && typeof r.hog_counts === "object"
    ? (r.hog_counts as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const hog_counts = emptyHogCounts();
  for (const key of HOG_TYPES) {
    const v = counts[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) hog_counts[key] = v;
  }

  const nextRaw = (r.next_day && typeof r.next_day === "object"
    ? (r.next_day as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const next_day = {
    hog_count:
      typeof nextRaw.hog_count === "number" && nextRaw.hog_count >= 0
        ? nextRaw.hog_count
        : 0,
    side_orders:
      typeof nextRaw.side_orders === "number" && nextRaw.side_orders >= 0
        ? nextRaw.side_orders
        : 0,
  };

  const farm_records = Array.isArray(r.farm_records)
    ? r.farm_records
        .map((row): HogIntakeRecord["farm_records"][number] | null => {
          if (!row || typeof row !== "object") return null;
          const f = row as Record<string, unknown>;
          const type = HOG_TYPES.find((t) => t === f.type) ?? "";
          return {
            id: typeof f.id === "string" ? f.id : crypto.randomUUID(),
            farm: typeof f.farm === "string" ? f.farm : "",
            type,
            tattoo: typeof f.tattoo === "string" ? f.tattoo : "",
            count:
              typeof f.count === "number" && f.count >= 0
                ? f.count
                : 0,
          };
        })
        .filter((row): row is HogIntakeRecord["farm_records"][number] => row !== null)
    : [];

  const num = (key: string): number => {
    const v = r[key];
    return typeof v === "number" && v >= 0 ? v : 0;
  };

  return {
    date,
    hog_counts,
    side_orders: num("side_orders"),
    held_over: num("held_over"),
    deaths_on_arrival: num("deaths_on_arrival"),
    boars_count: num("boars_count"),
    notes: typeof r.notes === "string" ? r.notes : "",
    farm_records,
    next_day,
  };
}

export function readDraft(date: string): HogIntakeRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(date));
    if (!raw) return null;
    return coerceDraft(JSON.parse(raw), date);
  } catch {
    return null;
  }
}

export function writeDraft(date: string, record: HogIntakeRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(date), JSON.stringify(record));
  } catch {
    // ignore quota / access errors
  }
}

export function clearDraft(date: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(date));
  } catch {
    // ignore
  }
}
