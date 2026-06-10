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

// Subset of HOG_TYPES that contribute to yield_total (Primal Calc).
// BK / Sow / Round / Suckling / Customer are intentionally excluded — they are
// tracked but never count toward the yield total.
export const YIELD_HOG_TYPES = ["JP", "RWA"] as const;
export type YieldHogType = (typeof YIELD_HOG_TYPES)[number];

// Hog types whose grid counts roll up from Farm Delivery Records (read-only).
// Only the Primal Calc hogs (JP / RWA) are tracked per-farm with tattoos, so
// deliveries are their single entry point. Every other type (BK / Sow / Round /
// Suckling / Customer) is entered manually on its own card.
export const FARM_DERIVED_HOG_TYPES = ["JP", "RWA"] as const;
export type FarmDerivedHogType = (typeof FARM_DERIVED_HOG_TYPES)[number];

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
  // Loins (pieces) already sitting in the cooler, carried into tomorrow's
  // availability. Added on top of expected production from today's yield.
  cooler_overstock: number;
};

// Persisted shape — only raw inputs. Computed values are never stored.
export type HogIntakeRecord = {
  date: string; // YYYY-MM-DD
  hog_counts: HogCounts;
  side_orders: number;
  held_over: number;
  deaths_on_arrival: number;
  boars_count: number;
  // Sow Processing — a separate operational track. Total Sow Available lives
  // in hog_counts.Sow; sow_scheduled is how many of those are slated for
  // processing today. Persisted (hog_intake_records.sow_scheduled) and shown
  // as the Sow figure in the Primal Calculation banner.
  sow_scheduled: number;
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
    sow_scheduled: 0,
    notes: "",
    farm_records: [],
    next_day: { hog_count: 0, side_orders: 0, cooler_overstock: 0 },
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
    record.sow_scheduled === 0 &&
    record.notes.trim() === "" &&
    record.farm_records.length === 0 &&
    record.next_day.hog_count === 0 &&
    record.next_day.side_orders === 0 &&
    record.next_day.cooler_overstock === 0
  );
}
