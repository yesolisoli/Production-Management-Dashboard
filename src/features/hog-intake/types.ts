// Canonical hog type keys. Order here is the display order in the UI.
export const HOG_TYPES = [
  "JP",
  "RWA",
  "BK",
  "Sow",
  "Round",
  "Suckling",
  "Customer",
] as const;

export type HogType = (typeof HOG_TYPES)[number];

// Subset of HOG_TYPES that contribute to yield_total.
// Round / Suckling / Customer are intentionally excluded.
export const YIELD_HOG_TYPES = ["JP", "RWA", "BK", "Sow"] as const;
export type YieldHogType = (typeof YIELD_HOG_TYPES)[number];

export type HogCounts = Record<HogType, number>;

export type FarmRecord = {
  id: string;
  farm: string;
  type: HogType | "";
  tattoo: string;
  count: number;
};

export type NextDay = {
  hog_count: number;
  side_orders: number;
};

// Persisted shape — only raw inputs. Computed values are never stored.
export type HogIntakeRecord = {
  date: string; // YYYY-MM-DD
  hog_counts: HogCounts;
  side_orders: number;
  held_over: number;
  deaths_on_arrival: number;
  boars_count: number;
  notes: string;
  farm_records: FarmRecord[];
  next_day: NextDay;
  updated_at?: string;
  updated_by?: string | null;
};

export function emptyHogCounts(): HogCounts {
  return {
    JP: 0,
    RWA: 0,
    BK: 0,
    Sow: 0,
    Round: 0,
    Suckling: 0,
    Customer: 0,
  };
}

export function emptyHogIntakeRecord(date: string): HogIntakeRecord {
  return {
    date,
    hog_counts: emptyHogCounts(),
    side_orders: 0,
    held_over: 0,
    deaths_on_arrival: 0,
    boars_count: 0,
    notes: "",
    farm_records: [],
    next_day: { hog_count: 0, side_orders: 0 },
  };
}

// True when the record carries no operator input — every count/field is at
// its default. Used so an empty local draft never shadows a real DB record
// (e.g. a date opened before data existed leaves a blank draft behind).
export function isEmptyHogIntakeRecord(record: HogIntakeRecord): boolean {
  return (
    HOG_TYPES.every((type) => record.hog_counts[type] === 0) &&
    record.side_orders === 0 &&
    record.held_over === 0 &&
    record.deaths_on_arrival === 0 &&
    record.boars_count === 0 &&
    record.notes.trim() === "" &&
    record.farm_records.length === 0 &&
    record.next_day.hog_count === 0 &&
    record.next_day.side_orders === 0
  );
}
