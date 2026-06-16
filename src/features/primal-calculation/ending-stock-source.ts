"use client";

import { SUPABASE_ENABLED } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import {
  emptyEndingStockByGroup,
  PRIMAL_GROUPS,
  type EndingStockByGroup,
  type PrimalGroupKey,
} from "./types";

// -------------------------------------------------------------------
// Supabase persistence for the Availability Chart's calculated Ending Stock
// (the day-to-day carry-over chain).
//
// Stored one row per (work_date, group_name) in `primal_ending_stock`. The
// derived Ending Stock is persisted on every recalculation so opening the
// next work date can load the previous date's values as its Opening Stock.
//
// Resilient-by-design: when Supabase isn't configured these are no-ops that
// return zeros, so the screen still renders (the carry-over simply won't
// persist). Real query failures throw so callers can surface them.
// -------------------------------------------------------------------

const GROUP_KEYS = new Set<string>(PRIMAL_GROUPS.map((g) => g.key));

type EndingStockRow = { group_name: string; ending_stock: number };

function rowsToByGroup(rows: EndingStockRow[]): EndingStockByGroup {
  const out = emptyEndingStockByGroup();
  for (const row of rows) {
    if (GROUP_KEYS.has(row.group_name) && Number.isFinite(row.ending_stock)) {
      out[row.group_name as PrimalGroupKey] = Math.floor(row.ending_stock);
    }
  }
  return out;
}

// All groups' Ending Stock saved for a specific date. Missing groups → 0.
export async function fetchEndingStockForDate(
  date: string,
): Promise<EndingStockByGroup> {
  if (!SUPABASE_ENABLED) return emptyEndingStockByGroup();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("primal_ending_stock")
    .select("group_name, ending_stock")
    .eq("work_date", date);
  if (error) throw new Error(error.message);
  return rowsToByGroup((data ?? []) as EndingStockRow[]);
}

// The carry-over source: the most recent saved work date STRICTLY before
// `beforeDate`, returned as that prior date's per-group Ending Stock. Returns
// zeros when nothing precedes it (the very first production date), and skips
// gaps (weekends) by taking the latest prior date rather than calendar −1.
export async function fetchPreviousEndingStock(
  beforeDate: string,
): Promise<EndingStockByGroup> {
  if (!SUPABASE_ENABLED) return emptyEndingStockByGroup();
  const supabase = createClient();
  const { data: prev, error } = await supabase
    .from("primal_ending_stock")
    .select("work_date")
    .lt("work_date", beforeDate)
    .order("work_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prev) return emptyEndingStockByGroup();
  return fetchEndingStockForDate((prev as { work_date: string }).work_date);
}

// Upsert the given groups' Ending Stock for a date. Accepts a partial map so a
// per-group Save writes just its own row without clobbering the others; the
// full-chart Save / auto-persist passes every group. No-op when no group is
// supplied or Supabase is disabled.
export async function saveEndingStockForDate(
  date: string,
  byGroup: Partial<EndingStockByGroup>,
): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  const rows = PRIMAL_GROUPS.filter(
    (g) => byGroup[g.key as PrimalGroupKey] !== undefined,
  ).map((g) => ({
    work_date: date,
    group_name: g.key,
    ending_stock: Math.floor(byGroup[g.key as PrimalGroupKey] as number),
  }));
  if (rows.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("primal_ending_stock")
    .upsert(rows, { onConflict: "work_date,group_name", ignoreDuplicates: false });
  if (error) throw new Error(error.message);
}
