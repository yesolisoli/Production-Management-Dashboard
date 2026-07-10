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

// Deletes every ROW from primal_ending_stock. The table itself (schema,
// columns, triggers, indexes) is left intact — only the data is removed.
async function main() {
  const supabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { count: before, error: countError } = await supabase
    .from("primal_ending_stock")
    .select("*", { count: "exact", head: true });
  if (countError) throw new Error(`count: ${countError.message}`);

  console.log(`[delete:primal-ending-stock] rows before: ${before ?? 0}`);
  if (!before) {
    console.log("[delete:primal-ending-stock] nothing to delete");
    return;
  }

  // Delete all rows. A filter is required, so match every non-null id.
  const { data, error } = await supabase
    .from("primal_ending_stock")
    .delete()
    .not("id", "is", null)
    .select("id");
  if (error) throw new Error(`delete: ${error.message}`);

  console.log(
    `[delete:primal-ending-stock] deleted ${(data ?? []).length} rows`,
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[delete:primal-ending-stock] failed: ${message}`);
  process.exit(1);
});
