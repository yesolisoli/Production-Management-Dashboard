import { createDateDraftStore } from "@/lib/local-storage";
import {
  emptyHogCounts,
  FARM_RECORD_TYPES,
  HOG_TYPES,
  type HogIntakeRecord,
} from "./types";

const DRAFT_KEY_PREFIX = "hog-intake.draft.";

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
    cooler_overstock:
      typeof nextRaw.cooler_overstock === "number" &&
      nextRaw.cooler_overstock >= 0
        ? nextRaw.cooler_overstock
        : 0,
  };

  const farm_records = Array.isArray(r.farm_records)
    ? r.farm_records
        .map((row): HogIntakeRecord["farm_records"][number] | null => {
          if (!row || typeof row !== "object") return null;
          const f = row as Record<string, unknown>;
          const type = FARM_RECORD_TYPES.find((t) => t === f.type) ?? "";
          return {
            id: typeof f.id === "string" ? f.id : crypto.randomUUID(),
            farm: typeof f.farm === "string" ? f.farm : "",
            type,
            tattoo: typeof f.tattoo === "string" ? f.tattoo : "",
            count:
              typeof f.count === "number" && f.count >= 0
                ? f.count
                : 0,
            delivery_time:
              typeof f.delivery_time === "string" ? f.delivery_time : "",
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
    todays_cutting: num("todays_cutting"),
    include_bk_in_yield: r.include_bk_in_yield === true,
    notes: typeof r.notes === "string" ? r.notes : "",
    farm_records,
    next_day,
  };
}

const store = createDateDraftStore<HogIntakeRecord>(DRAFT_KEY_PREFIX, coerceDraft);

export const readDraft = store.readDraft;
export const writeDraft = store.writeDraft;
export const clearDraft = store.clearDraft;
