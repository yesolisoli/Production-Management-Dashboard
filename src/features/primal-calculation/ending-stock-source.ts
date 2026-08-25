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
  return (await fetchSavedEndingStockForDate(date)) ?? emptyEndingStockByGroup();
}

// Presence-aware variant: null when the date has NO saved rows at all —
// distinct from "saved and all zeros". Lets read-only consumers (the
// Operations dashboard) tell an unrecorded day apart from a zero-stock day.
export async function fetchSavedEndingStockForDate(
  date: string,
): Promise<EndingStockByGroup | null> {
  if (!SUPABASE_ENABLED) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("primal_ending_stock")
    .select("group_name, ending_stock")
    .eq("work_date", date);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EndingStockRow[];
  if (rows.length === 0) return null;
  return rowsToByGroup(rows);
}

// The most recent work date STRICTLY before `beforeDate` with saved Ending
// Stock, or null when nothing precedes it. Skips gaps (weekends) by taking
// the latest prior date rather than calendar −1.
export async function fetchLatestEndingStockDateBefore(
  beforeDate: string,
): Promise<string | null> {
  if (!SUPABASE_ENABLED) return null;
  const supabase = createClient();
  const { data: prev, error } = await supabase
    .from("primal_ending_stock")
    .select("work_date")
    .lt("work_date", beforeDate)
    .order("work_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prev) return null;
  return (prev as { work_date: string }).work_date;
}

// The most recent `dateLimit` work dates with saved Ending Stock, up to and
// including `endDate`, each with its per-group values — newest first. When the
// result holds fewer than `dateLimit` dates, the caller has ALL saved dates in
// range (so "no earlier date" is a fact, not a window cutoff).
export async function fetchRecentSavedEndingStockThrough(
  endDate: string,
  dateLimit: number,
): Promise<Array<{ date: string; byGroup: EndingStockByGroup }>> {
  if (!SUPABASE_ENABLED) return [];
  const supabase = createClient();
  // Date discovery over raw rows (PostgREST has no DISTINCT). The row cap is
  // dateLimit × groups × 2 — generous slack for dates saved with only a
  // subset of groups.
  const { data: dateRows, error: dateError } = await supabase
    .from("primal_ending_stock")
    .select("work_date")
    .lte("work_date", endDate)
    .order("work_date", { ascending: false })
    .limit(dateLimit * PRIMAL_GROUPS.length * 2);
  if (dateError) throw new Error(dateError.message);
  const dates: string[] = [];
  for (const row of (dateRows ?? []) as { work_date: string }[]) {
    if (!dates.includes(row.work_date)) dates.push(row.work_date);
    if (dates.length === dateLimit) break;
  }
  if (dates.length === 0) return [];

  const { data, error } = await supabase
    .from("primal_ending_stock")
    .select("work_date, group_name, ending_stock")
    .in("work_date", dates);
  if (error) throw new Error(error.message);
  const rowsByDate = new Map<string, EndingStockRow[]>();
  for (const row of (data ?? []) as (EndingStockRow & { work_date: string })[]) {
    const list = rowsByDate.get(row.work_date) ?? [];
    list.push(row);
    rowsByDate.set(row.work_date, list);
  }
  return dates
    .filter((date) => rowsByDate.has(date))
    .map((date) => ({ date, byGroup: rowsToByGroup(rowsByDate.get(date)!) }));
}

// The carry-over source: the most recent saved work date STRICTLY before
// `beforeDate`, returned as that prior date's per-group Ending Stock. Returns
// zeros when nothing precedes it (the very first production date).
export async function fetchPreviousEndingStock(
  beforeDate: string,
): Promise<EndingStockByGroup> {
  const prevDate = await fetchLatestEndingStockDateBefore(beforeDate);
  if (!prevDate) return emptyEndingStockByGroup();
  return fetchEndingStockForDate(prevDate);
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

  // Skip no-op writes. The auto-persist re-saves the recalculated Ending Stock
  // on every recalculation, so re-upserting an identical value would still bump
  // `updated_at` and create a meaningless audit-log entry. Read the currently
  // stored values first and upsert only the groups that actually changed (or
  // have no stored row yet — `stored.get` is undefined, so those still insert).
  const { data: existing, error: readError } = await supabase
    .from("primal_ending_stock")
    .select("group_name, ending_stock")
    .eq("work_date", date)
    .in(
      "group_name",
      rows.map((r) => r.group_name),
    );
  if (readError) throw new Error(readError.message);
  const stored = new Map(
    ((existing ?? []) as EndingStockRow[]).map((r) => [
      r.group_name,
      r.ending_stock,
    ]),
  );
  const changed = rows.filter(
    (r) => stored.get(r.group_name) !== r.ending_stock,
  );
  if (changed.length === 0) return;

  const { error } = await supabase
    .from("primal_ending_stock")
    .upsert(changed, {
      onConflict: "work_date,group_name",
      ignoreDuplicates: false,
    });
  if (error) throw new Error(error.message);
}
