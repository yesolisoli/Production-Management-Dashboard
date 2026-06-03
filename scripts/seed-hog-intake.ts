import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Load .env.local before any code reads process.env.
loadEnv({ path: resolve(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

import { buildHogIntakeMockRecords } from "../src/features/hog-intake/mock-data";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Seeds ONLY hog_intake_records — does not touch assignment-board tables,
// so existing daily-lineup data is left untouched. Upserts on intake_date
// so re-running is idempotent and never deletes other dates.
async function main() {
  const supabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const rows = buildHogIntakeMockRecords().map((record) => ({
    intake_date: record.date,
    hog_counts: record.hog_counts,
    side_orders: record.side_orders,
    held_over: record.held_over,
    deaths_on_arrival: record.deaths_on_arrival,
    boars_count: record.boars_count,
    notes: record.notes,
    farm_records: record.farm_records,
    next_day: record.next_day,
    updated_by: null,
  }));

  const { error } = await supabase
    .from("hog_intake_records")
    .upsert(rows, { onConflict: "intake_date", ignoreDuplicates: false });

  if (error) throw new Error(`upsert hog_intake_records: ${error.message}`);

  console.log(`[seed:hog-intake] upserted ${rows.length} rows`);
  console.log(`[seed:hog-intake] dates: ${rows.map((r) => r.intake_date).join(", ")}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[seed:hog-intake] failed: ${message}`);
  process.exit(1);
});
