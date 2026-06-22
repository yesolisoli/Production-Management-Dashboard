// Pure derivation for Orders & Allocation (no I/O, no state).
//
// Everything here is recomputed from the raw draft on every render — none of
// these values are persisted. Mirrors the Primal Calculation convention where
// the view-model is derived in one place and the components just render it.

import { casesToPieces } from "@/features/primal-calculation/calculations";
import {
  PRODUCT_SPEC_BY_SKU,
} from "@/features/primal-calculation/product-specs";
import {
  groupForCategory,
  PRIMAL_GROUPS,
  type GroupAvailability,
  type PrimalGroupKey,
} from "@/features/primal-calculation/types";
import type { PrimalDemandSnapshot } from "./primal-demand-source";
import {
  SECONDS_PER_PIECE,
  type AllocationInstruction,
  type AllocationProduct,
  type CutOrder,
} from "./types";

// Estimated cut time, in seconds, for a piece count (pieces × 18s).
export function cutSeconds(pieces: number): number {
  return Math.max(0, Math.round(pieces)) * SECONDS_PER_PIECE;
}

// Human label for a duration in seconds, e.g. 1800 -> "30 min".
export function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

// Pieces ordered per Primal group — used to compare cut orders against the
// availability that Hog Intake → Primal Calc produced. Every group is present
// (zeros included) so the strip can render a complete row set. Cut orders for
// extra, non-Primal areas (see allocation-areas.ts) carry no Primal
// availability, so their pieces are intentionally excluded here.
export function piecesByGroup(
  orders: CutOrder[],
): Record<PrimalGroupKey, number> {
  const out = {} as Record<PrimalGroupKey, number>;
  for (const group of PRIMAL_GROUPS) out[group.key] = 0;
  for (const order of orders) {
    if (order.product in out) {
      out[order.product as PrimalGroupKey] += order.pieces;
    }
  }
  return out;
}

export type InstructionsSummary = {
  count: number;
};

export function deriveInstructionsSummary(
  instructions: AllocationInstruction[],
): InstructionsSummary {
  return { count: instructions.length };
}

// -------------------------------------------------------------------
// Primal demand → cut orders.
//
// The pieces a group demands is `salesOrders` (catalog/SKU orders), NOT
// availableStock. When per-SKU detail exists we split that demand into one
// labelled row per SKU (note = SKU name); otherwise we fall back to a single
// group-level row sized to the group's salesOrders. customer_orders are special
// reservations already netted out of availableStock by Primal, so they are
// reference only and never seeded here (seeding them would double-count).
// -------------------------------------------------------------------

// Total demand pieces for one SKU order (reuses Primal's case→piece conversion).
function skuOrderPieces(sku: string, today_cases: number, today_pcs: number): number {
  const spec = PRODUCT_SPEC_BY_SKU[sku];
  if (!spec) return Math.max(0, Math.round(today_pcs));
  return Math.max(0, Math.round(today_pcs)) + casesToPieces(spec, today_cases);
}

export function buildSuggestedCutOrders(
  snapshot: PrimalDemandSnapshot,
): Omit<CutOrder, "id">[] {
  const availabilityByGroup = new Map<PrimalGroupKey, GroupAvailability>(
    snapshot.availability.map((row) => [row.group, row]),
  );

  // Group the raw SKU orders by their production group, keeping the per-SKU
  // breakdown so each becomes its own labelled row.
  const skuRowsByGroup = new Map<
    PrimalGroupKey,
    { note: string; pieces: number }[]
  >();
  for (const [sku, order] of Object.entries(snapshot.skuOrders)) {
    const spec = PRODUCT_SPEC_BY_SKU[sku];
    if (!spec) continue;
    const pieces = skuOrderPieces(sku, order.today_cases, order.today_pcs);
    if (pieces <= 0) continue;
    const groupKey = groupForCategory(spec.category).key as PrimalGroupKey;
    const list = skuRowsByGroup.get(groupKey) ?? [];
    list.push({ note: spec.name, pieces });
    skuRowsByGroup.set(groupKey, list);
  }

  const suggestions: Omit<CutOrder, "id">[] = [];
  for (const group of PRIMAL_GROUPS) {
    const groupKey = group.key as PrimalGroupKey;
    const skuRows = skuRowsByGroup.get(groupKey);
    if (skuRows && skuRows.length > 0) {
      for (const row of skuRows) {
        suggestions.push({
          product: groupKey as AllocationProduct,
          pieces: row.pieces,
          location: "main",
          note: row.note,
        });
      }
      continue;
    }
    // Fallback: one row sized to the group's total demand (salesOrders).
    const demand = availabilityByGroup.get(groupKey)?.salesOrders ?? 0;
    if (demand > 0) {
      suggestions.push({
        product: groupKey as AllocationProduct,
        pieces: demand,
        location: "main",
        note: "",
      });
    }
  }
  return suggestions;
}

// Per-group reconciliation of Primal demand against the cut orders entered.
//   ordered      = salesOrders (Primal demand for the group)
//   allocated    = pieces summed across cut-order rows for the group
//   remaining    = ordered − allocated (still to turn into cut orders)
//   availableStock / endingStock / shortage = Primal reference numbers
//   overCapacity = allocated exceeds availableStock (capacity warning)
//   shortageWarning = Primal already reports shortage for the group
export type GroupReconcile = {
  group: PrimalGroupKey;
  ordered: number;
  allocated: number;
  remaining: number;
  availableStock: number;
  endingStock: number;
  shortage: number;
  overCapacity: boolean;
  shortageWarning: boolean;
};

export function reconcileByGroup(
  availability: GroupAvailability[],
  cutOrders: CutOrder[],
): GroupReconcile[] {
  const allocated = piecesByGroup(cutOrders);
  return availability.map((row) => {
    const allocatedPieces = allocated[row.group] ?? 0;
    return {
      group: row.group,
      ordered: row.salesOrders,
      allocated: allocatedPieces,
      remaining: row.salesOrders - allocatedPieces,
      availableStock: row.availableStock,
      endingStock: row.endingStock,
      shortage: row.shortage,
      overCapacity: allocatedPieces > row.availableStock,
      shortageWarning: row.shortage > 0,
    };
  });
}
