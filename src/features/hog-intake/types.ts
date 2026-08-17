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

// Hog types whose grid counts roll up from Farm Delivery Records (read-only).
// JP / RWA / BK are tracked per-farm, so deliveries are their single entry
// point — their counts are summed from the rows, not typed in by hand. BK does
// NOT feed Primal Calc (see YIELD_HOG_TYPES); it is shown separately. Sow, Round,
// Suckling and Customer stay manual (their own cards).
export const FARM_DERIVED_HOG_TYPES = ["JP", "RWA", "BK"] as const;
export type FarmDerivedHogType = (typeof FARM_DERIVED_HOG_TYPES)[number];

// A Farm Delivery Records label for BK stock that is cut for primal: its count
// rolls up into JP (primal), never BK. Row-level only — not a canonical HogType
// and never a HogCounts key.
export const BK_JP_TYPE = "BK/JP";

// Types offered in the Farm Delivery Records dropdown. JP / RWA / BK roll up
// from the rows (FARM_DERIVED_HOG_TYPES); BK/JP is BK cut for primal, so its
// count folds into JP. Sow is selectable for labeling a delivery, but its count
// stays manual (the Sow card), so it is not summed here.
export const FARM_RECORD_TYPES = ["JP", "RWA", "BK", BK_JP_TYPE, "Sow"] as const;

// A Farm Delivery Records row type: any canonical HogType plus the BK/JP label.
export type FarmRecordType = HogType | typeof BK_JP_TYPE;

export type HogCounts = Record<HogType, number>;

export type FarmRecord = {
  id: string;
  farm: string;
  type: FarmRecordType | "";
  tattoo: string;
  count: number;
  // Local time the farm's load arrived, as "HH:MM". Optional — older records
  // predate this field and quick entries may leave it blank.
  delivery_time?: string;
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
  // in hog_counts.Sow; todays_cutting is how many of those are slated for
  // processing today ("Today's Cutting"). Persisted
  // (hog_intake_records.todays_cutting) and shown as the Sow figure in the
  // Primal Calculation banner.
  todays_cutting: number;
  // Optional per-day override: when true, the day's BK count is folded into the
  // Primal Calc yield pool alongside JP / RWA. BK is normally excluded (see
  // YIELD_HOG_TYPES); some days its hogs are cut for primal, so operators opt in
  // per day from the Farm Delivery Records BK row. Defaults to false.
  include_bk_in_yield: boolean;
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
    todays_cutting: 0,
    include_bk_in_yield: false,
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
    record.todays_cutting === 0 &&
    record.include_bk_in_yield === false &&
    record.notes.trim() === "" &&
    record.farm_records.length === 0 &&
    record.next_day.hog_count === 0 &&
    record.next_day.side_orders === 0 &&
    record.next_day.cooler_overstock === 0
  );
}
