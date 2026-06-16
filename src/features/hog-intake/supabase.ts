"use client";

import { createClient } from "@/lib/supabase/client";
import {
  emptyHogCounts,
  HOG_TYPES,
  type FarmRecord,
  type HogIntakeRecord,
  type HogType,
} from "./types";

type HogIntakeRow = {
  intake_date: string;
  hog_counts: unknown;
  side_orders: number;
  held_over: number;
  deaths_on_arrival: number;
  boars_count: number;
  todays_cutting: number;
  notes: string | null;
  farm_records: unknown;
  next_day: unknown;
  updated_at: string;
  updated_by: string | null;
};

function coerceCounts(raw: unknown) {
  const out = emptyHogCounts();
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const key of HOG_TYPES) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return out;
}

function coerceNextDay(raw: unknown) {
  const fallback = { hog_count: 0, side_orders: 0, cooler_overstock: 0 };
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  return {
    hog_count:
      typeof obj.hog_count === "number" && obj.hog_count >= 0
        ? obj.hog_count
        : 0,
    side_orders:
      typeof obj.side_orders === "number" && obj.side_orders >= 0
        ? obj.side_orders
        : 0,
    cooler_overstock:
      typeof obj.cooler_overstock === "number" && obj.cooler_overstock >= 0
        ? obj.cooler_overstock
        : 0,
  };
}

function coerceFarmRecords(raw: unknown): FarmRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): FarmRecord | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const type: HogType | "" =
        HOG_TYPES.find((t) => t === r.type) ?? "";
      return {
        id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
        farm: typeof r.farm === "string" ? r.farm : "",
        type,
        tattoo: typeof r.tattoo === "string" ? r.tattoo : "",
        count:
          typeof r.count === "number" && r.count >= 0 ? r.count : 0,
      };
    })
    .filter((row): row is FarmRecord => row !== null);
}

function rowToRecord(row: HogIntakeRow): HogIntakeRecord {
  return {
    date: row.intake_date,
    hog_counts: coerceCounts(row.hog_counts),
    side_orders: row.side_orders,
    held_over: row.held_over,
    deaths_on_arrival: row.deaths_on_arrival,
    boars_count: row.boars_count,
    todays_cutting: row.todays_cutting,
    notes: row.notes ?? "",
    farm_records: coerceFarmRecords(row.farm_records),
    next_day: coerceNextDay(row.next_day),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

export async function fetchHogIntakeByDate(
  date: string,
): Promise<HogIntakeRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hog_intake_records")
    .select(
      "intake_date, hog_counts, side_orders, held_over, deaths_on_arrival, boars_count, todays_cutting, notes, farm_records, next_day, updated_at, updated_by",
    )
    .eq("intake_date", date)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToRecord(data as HogIntakeRow);
}

// Upsert input fields only. Computed totals (total_hogs, for_cutting,
// yield_total, projected_for_cutting) are intentionally NOT sent — they
// are recomputed from inputs everywhere they're displayed.
export async function upsertHogIntakeRecord(
  record: HogIntakeRecord,
  userId: string | null,
): Promise<HogIntakeRecord> {
  const supabase = createClient();

  const payload = {
    intake_date: record.date,
    hog_counts: record.hog_counts,
    side_orders: record.side_orders,
    held_over: record.held_over,
    deaths_on_arrival: record.deaths_on_arrival,
    boars_count: record.boars_count,
    todays_cutting: record.todays_cutting,
    notes: record.notes,
    farm_records: record.farm_records,
    next_day: record.next_day,
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from("hog_intake_records")
    .upsert(payload, { onConflict: "intake_date", ignoreDuplicates: false })
    .select(
      "intake_date, hog_counts, side_orders, held_over, deaths_on_arrival, boars_count, todays_cutting, notes, farm_records, next_day, updated_at, updated_by",
    )
    .single();

  if (error) throw new Error(error.message);
  return rowToRecord(data as HogIntakeRow);
}
