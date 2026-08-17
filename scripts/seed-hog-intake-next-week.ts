import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Load .env.local before any code reads process.env.
loadEnv({ path: resolve(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

import type { HogIntakeRecord } from "../src/features/hog-intake/types";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// The Monday of next week, relative to "now", as YYYY-MM-DD. Computing it from
// the current date keeps the seed pointing at the upcoming work week instead of
// a fixed date that drifts stale.
function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilNextMonday);
  return d;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Next week's Mon–Fri dates.
function weekdayDates(): string[] {
  const monday = nextMonday();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateString(d);
  });
}

// Per-weekday raw inputs. Shaped like the real operator entries so Primal Calc /
// Availability downstream have believable numbers to work with.
function buildNextWeekRecords(): HogIntakeRecord[] {
  const [mon, tue, wed, thu, fri] = weekdayDates();

  return [
    {
      date: mon,
      // total = 52 + 40 + 26 + 20 + 30 + 12 + 22 = 202
      hog_counts: { JP: 52, RWA: 40, BK: 26, Sow: 20, Round: 30, Suckling: 12, Customer: 22 },
      side_orders: 20,
      held_over: 4,
      deaths_on_arrival: 1,
      boars_count: 3,
      todays_cutting: 10,
      include_bk_in_yield: false,
      notes: "Monday start — all farms confirmed for the week.",
      farm_records: [
        { id: "fr-mon-1", farm: "ABC Farm", type: "JP", tattoo: "3001", count: 28, delivery_time: "06:15" },
        { id: "fr-mon-2", farm: "Green Valley Farm", type: "RWA", tattoo: "3002", count: 22, delivery_time: "07:00" },
        { id: "fr-mon-3", farm: "Sunrise Farm", type: "BK", tattoo: "3003", count: 16, delivery_time: "07:45" },
        { id: "fr-mon-4", farm: "Happy Field Farm", type: "Sow", tattoo: "3004", count: 12, delivery_time: "08:30" },
      ],
      next_day: { hog_count: 205, side_orders: 18, cooler_overstock: 0 },
    },
    {
      date: tue,
      // total = 55 + 38 + 28 + 18 + 28 + 10 + 24 = 201
      hog_counts: { JP: 55, RWA: 38, BK: 28, Sow: 18, Round: 28, Suckling: 10, Customer: 24 },
      side_orders: 18,
      held_over: 5,
      deaths_on_arrival: 0,
      boars_count: 2,
      todays_cutting: 11,
      include_bk_in_yield: false,
      notes: "",
      farm_records: [
        { id: "fr-tue-1", farm: "ABC Farm", type: "JP", tattoo: "3101", count: 30, delivery_time: "06:20" },
        { id: "fr-tue-2", farm: "Green Valley Farm", type: "RWA", tattoo: "3102", count: 20, delivery_time: "07:05" },
        { id: "fr-tue-3", farm: "Sunrise Farm", type: "BK", tattoo: "3103", count: 18, delivery_time: "07:50" },
      ],
      next_day: { hog_count: 210, side_orders: 17, cooler_overstock: 0 },
    },
    {
      date: wed,
      // total = 50 + 42 + 24 + 22 + 32 + 12 + 20 = 202
      hog_counts: { JP: 50, RWA: 42, BK: 24, Sow: 22, Round: 32, Suckling: 12, Customer: 20 },
      side_orders: 22,
      held_over: 6,
      deaths_on_arrival: 1,
      boars_count: 3,
      todays_cutting: 12,
      include_bk_in_yield: false,
      notes: "Midweek — strong RWA run expected.",
      farm_records: [
        { id: "fr-wed-1", farm: "ABC Farm", type: "JP", tattoo: "3201", count: 26, delivery_time: "06:10" },
        { id: "fr-wed-2", farm: "Green Valley Farm", type: "RWA", tattoo: "3202", count: 24, delivery_time: "06:55" },
        { id: "fr-wed-3", farm: "Sunrise Farm", type: "BK", tattoo: "3203", count: 14, delivery_time: "07:40" },
        { id: "fr-wed-4", farm: "Happy Field Farm", type: "Sow", tattoo: "3204", count: 14, delivery_time: "08:25" },
      ],
      next_day: { hog_count: 200, side_orders: 16, cooler_overstock: 0 },
    },
    {
      date: thu,
      // total = 53 + 39 + 27 + 19 + 30 + 11 + 23 = 202
      hog_counts: { JP: 53, RWA: 39, BK: 27, Sow: 19, Round: 30, Suckling: 11, Customer: 23 },
      side_orders: 19,
      held_over: 4,
      deaths_on_arrival: 0,
      boars_count: 4,
      todays_cutting: 10,
      include_bk_in_yield: false,
      notes: "",
      farm_records: [
        { id: "fr-thu-1", farm: "ABC Farm", type: "JP", tattoo: "3301", count: 29, delivery_time: "06:15" },
        { id: "fr-thu-2", farm: "Green Valley Farm", type: "RWA", tattoo: "3302", count: 21, delivery_time: "07:00" },
        { id: "fr-thu-3", farm: "Sunrise Farm", type: "BK", tattoo: "3303", count: 17, delivery_time: "07:45" },
      ],
      next_day: { hog_count: 208, side_orders: 18, cooler_overstock: 0 },
    },
    {
      date: fri,
      // total = 56 + 41 + 25 + 21 + 31 + 10 + 22 = 206
      hog_counts: { JP: 56, RWA: 41, BK: 25, Sow: 21, Round: 31, Suckling: 10, Customer: 22 },
      side_orders: 21,
      held_over: 3,
      deaths_on_arrival: 1,
      boars_count: 3,
      todays_cutting: 12,
      include_bk_in_yield: false,
      notes: "End of week — clearing held-over stock.",
      farm_records: [
        { id: "fr-fri-1", farm: "ABC Farm", type: "JP", tattoo: "3401", count: 31, delivery_time: "06:10" },
        { id: "fr-fri-2", farm: "Green Valley Farm", type: "RWA", tattoo: "3402", count: 23, delivery_time: "06:55" },
        { id: "fr-fri-3", farm: "Sunrise Farm", type: "BK", tattoo: "3403", count: 15, delivery_time: "07:40" },
        { id: "fr-fri-4", farm: "Happy Field Farm", type: "Sow", tattoo: "3404", count: 13, delivery_time: "08:20" },
      ],
      next_day: { hog_count: 215, side_orders: 19, cooler_overstock: 0 },
    },
  ];
}

// Seeds ONLY hog_intake_records for next week's Mon–Fri. Upserts on intake_date
// so re-running is idempotent and never touches other dates or other tables.
async function main() {
  const supabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const rows = buildNextWeekRecords().map((record) => ({
    intake_date: record.date,
    hog_counts: record.hog_counts,
    side_orders: record.side_orders,
    held_over: record.held_over,
    deaths_on_arrival: record.deaths_on_arrival,
    boars_count: record.boars_count,
    todays_cutting: record.todays_cutting,
    include_bk_in_yield: record.include_bk_in_yield,
    notes: record.notes,
    farm_records: record.farm_records,
    next_day: record.next_day,
    updated_by: null,
  }));

  const { error } = await supabase
    .from("hog_intake_records")
    .upsert(rows, { onConflict: "intake_date", ignoreDuplicates: false });

  if (error) throw new Error(`upsert hog_intake_records: ${error.message}`);

  console.log(`[seed:hog-intake:next-week] upserted ${rows.length} rows`);
  console.log(`[seed:hog-intake:next-week] dates: ${rows.map((r) => r.intake_date).join(", ")}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[seed:hog-intake:next-week] failed: ${message}`);
  process.exit(1);
});
