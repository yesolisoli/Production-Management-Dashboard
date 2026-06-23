"use client";

import {
  emptyHogIntakeRecord,
  type HogCounts,
} from "@/features/hog-intake/types";
import { fetchPreviousEndingStock } from "@/features/primal-calculation/ending-stock-source";
import { loadHogIntakeForDate } from "@/features/primal-calculation/intake-source";
import {
  readCommittedForDate,
  readCustomerOrdersForDate,
  readCustomGroupsForDate,
  readCustomRowsForDate,
} from "@/features/primal-calculation/primal-storage";
import {
  emptyEndingStockByGroup,
  type CustomerOrdersForDate,
  type GroupAvailability,
  type ProductOrdersForDate,
} from "@/features/primal-calculation/types";
import { derivePrimalViewModel } from "@/features/primal-calculation/view-model";

// -------------------------------------------------------------------
// The Primal DEMAND snapshot that Orders & Allocation consumes.
//
// This is the SINGLE source-of-truth boundary between Primal and this screen.
// Today it reuses Primal's own derivation (derivePrimalViewModel — no formula
// duplication) over the date's Primal inputs to produce the same demand numbers
// the Primal screen shows. The returned shape intentionally mirrors a future
// Supabase `primal_snapshots` row (availability result + raw sku/customer
// orders), so when the Sign Off snapshot lands ONLY this file changes — every
// consumer already depends on PrimalDemandSnapshot, not on how it is read.
//
// IMPORTANT semantics (see Orders & Allocation calculations): the demand to
// turn into cut orders is `salesOrders` per group (catalog/SKU orders), NOT
// `availableStock`. availableStock / endingStock / shortage are reference only.
// -------------------------------------------------------------------

export type PrimalDemandSnapshot = {
  date: string;
  // Per-group derived result: salesOrders (demand), availableStock,
  // endingStock, shortage, status. Reference + demand source.
  availability: GroupAvailability[];
  // Raw catalog orders keyed by SKU — used to split a group's demand into
  // labelled cut-order rows. These aggregate into `salesOrders`.
  skuOrders: ProductOrdersForDate;
  // Raw special-customer reservations (reference only — already netted out of
  // availableStock by Primal; not converted to cut orders to avoid double count).
  customerOrders: CustomerOrdersForDate;
  // Whether a real Hog Intake record backed the numbers for this date.
  hasIntake: boolean;
  // The day's Hog Intake counts per hog type (JP / RWA / Sow / ...). Reference
  // for downstream timing (e.g. the hog-break calculator), zeroed when no intake
  // record backs the date.
  hogCounts: HogCounts;
};

function emptySnapshot(
  date: string,
  skuOrders: ProductOrdersForDate,
  customerOrders: CustomerOrdersForDate,
  availability: GroupAvailability[],
  hasIntake: boolean,
  hogCounts: HogCounts,
): PrimalDemandSnapshot {
  return { date, availability, skuOrders, customerOrders, hasIntake, hogCounts };
}

export async function loadPrimalDemand(
  date: string,
): Promise<PrimalDemandSnapshot> {
  // Local-first inputs (synchronous): the order / customer source data.
  const skuOrders = readCommittedForDate(date);
  const customerOrders = readCustomerOrdersForDate(date);
  const customGroups = readCustomGroupsForDate(date);
  const customRows = readCustomRowsForDate(date);

  let hasIntake = false;
  let hogCounts: HogCounts = emptyHogIntakeRecord(date).hog_counts;
  let vm;
  try {
    const [intake, openingStock] = await Promise.all([
      loadHogIntakeForDate(date),
      fetchPreviousEndingStock(date),
    ]);
    hasIntake = Boolean(intake);
    if (intake) hogCounts = intake.hog_counts;
    vm = derivePrimalViewModel({
      intake: intake ?? emptyHogIntakeRecord(date),
      orders: skuOrders,
      customerOrders,
      customGroups,
      customRows,
      openingStock: openingStock ?? emptyEndingStockByGroup(),
    });
  } catch {
    // Supabase off / query failed — still derive demand from local orders so the
    // screen works (expected production falls back to zero ⇒ availability is a
    // reference of zero, but salesOrders demand still comes through).
    vm = derivePrimalViewModel({
      intake: emptyHogIntakeRecord(date),
      orders: skuOrders,
      customerOrders,
      customGroups,
      customRows,
      openingStock: emptyEndingStockByGroup(),
    });
  }

  return emptySnapshot(
    date,
    skuOrders,
    customerOrders,
    vm.availabilityRows,
    hasIntake,
    hogCounts,
  );
}
