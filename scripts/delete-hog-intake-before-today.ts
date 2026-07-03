import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Load .env.local before any code reads process.env.
loadEnv({ path: resolve(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Deletes hog_intake_records strictly BEFORE the given cutoff date (today),
// leaving today's record and any future records intact. Touches only the
// hog_intake_records table.
async function main() {
  const cutoff = process.argv[2];
  if (!cutoff || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
    throw new Error("Usage: tsx delete-hog-intake-before-today.ts YYYY-MM-DD");
  }

  const supabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase
    .from("hog_intake_records")
    .delete()
    .lt("intake_date", cutoff)
    .select("intake_date");

  if (error) throw new Error(`delete hog_intake_records: ${error.message}`);

  const dates = (data ?? []).map((r) => r.intake_date).sort();
  console.log(`[delete:hog-intake] deleted ${dates.length} rows before ${cutoff}`);
  console.log(`[delete:hog-intake] dates: ${dates.join(", ") || "(none)"}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[delete:hog-intake] failed: ${message}`);
  process.exit(1);
});
