"use client";

import { SUPABASE_ENABLED } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { PRIMAL_GROUPS, type PrimalAllocation, type PrimalGroupKey } from "./types";

// -------------------------------------------------------------------
// Supabase persistence for the Availability Chart's stock allocations.
//
// Stored one row per allocation in `primal_allocations`. Unlike the
// derived Ending Stock (one row per group), each allocation is a RAW
// operator input with its own id, quantity, target date and label — many
// may exist for the same (work_date, group). The chart sums them per
// group and subtracts the total from Available Stock.
//
// Resilient-by-design: when Supabase isn't configured these are no-ops
// (fetch returns empty, writes do nothing) so the screen still renders —
// allocations simply won't persist. Real query failures throw so callers
// can surface them.
// -------------------------------------------------------------------

const GROUP_KEYS = new Set<string>(PRIMAL_GROUPS.map((g) => g.key));

type AllocationRow = {
  id: string;
  group_name: string;
  qty_pcs: number;
  target_date: string;
  label: string | null;
};

function rowToAllocation(row: AllocationRow): PrimalAllocation | null {
  if (!GROUP_KEYS.has(row.group_name)) return null;
  return {
    id: row.id,
    group: row.group_name as PrimalGroupKey,
    qtyPcs: Number.isFinite(row.qty_pcs) ? Math.max(0, Math.floor(row.qty_pcs)) : 0,
    targetDate: row.target_date,
    label: row.label ?? "",
  };
}

function mapRows(data: unknown): PrimalAllocation[] {
  return ((data ?? []) as AllocationRow[])
    .map(rowToAllocation)
    .filter((a): a is PrimalAllocation => a !== null);
}

// Every allocation entered ON a work date (the editable set deducted from it),
// oldest first.
export async function fetchAllocationsForDate(
  date: string,
): Promise<PrimalAllocation[]> {
  if (!SUPABASE_ENABLED) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("primal_allocations")
    .select("id, group_name, qty_pcs, target_date, label")
    .eq("work_date", date)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return mapRows(data);
}

// Every allocation TARGETING a date — the incoming reservations that surface as
// that date's "Remaining Products" (regardless of which work date they were
// entered on).
export async function fetchAllocationsForTargetDate(
  targetDate: string,
): Promise<PrimalAllocation[]> {
  if (!SUPABASE_ENABLED) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("primal_allocations")
    .select("id, group_name, qty_pcs, target_date, label")
    .eq("target_date", targetDate)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return mapRows(data);
}

// Insert or update one allocation. Keyed by its client-generated id, so the
// same call handles both a freshly added row and an edit to an existing one.
export async function saveAllocation(
  date: string,
  allocation: PrimalAllocation,
): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  const supabase = createClient();
  const { error } = await supabase.from("primal_allocations").upsert(
    {
      id: allocation.id,
      work_date: date,
      group_name: allocation.group,
      qty_pcs: Math.max(0, Math.floor(allocation.qtyPcs)),
      target_date: allocation.targetDate,
      label: allocation.label,
    },
    { onConflict: "id", ignoreDuplicates: false },
  );
  if (error) throw new Error(error.message);
}

// Remove one allocation by id.
export async function deleteAllocation(id: string): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  const supabase = createClient();
  const { error } = await supabase.from("primal_allocations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
