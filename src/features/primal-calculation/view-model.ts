// -------------------------------------------------------------------
// Primal Calculation view model.
//
// Pure derivation layer: takes the RAW state the hook owns (intake record,
// orders, customer orders, custom groups/rows, opening stock) and produces
// every derived structure the page renders. No React, no storage, no I/O —
// the page wraps the single call in a useMemo; this module just computes.
//
// Extracted verbatim from PrimalCalculationPage so the component stays
// presentation-only. Behavior is identical to the previous inline useMemos.
// -------------------------------------------------------------------

import {
  deriveTotals,
  type HogIntakeTotals,
} from "@/features/hog-intake/calculations";
import type { HogCounts, HogIntakeRecord } from "@/features/hog-intake/types";
import {
  buildAvailabilityRows,
  buildCustomerAvailability,
  buildCustomGroupAvailability,
  categoryTotals,
  DEFAULT_MIN_COOLER_RESERVE,
  orderFor,
  sumAvailability,
  type OrderTotals,
} from "./calculations";
import { specsForCategory } from "./product-specs";
import {
  groupForCategory,
  PRIMAL_CATEGORIES,
  PRIMAL_GROUPS,
  type AvailabilityStatus,
  type AvailabilityTotals,
  type CustomerAvailabilityColumn,
  type CustomerOrdersForDate,
  type CustomGroupsForDate,
  type CustomOrderRow,
  type CustomRowsForDate,
  type EndingStockByGroup,
  type GroupAvailability,
  type PrimalCategory,
  type PrimalGroup,
  type PrimalGroupKey,
  type ProductOrdersForDate,
} from "./types";
import type {
  CategorySkuRow,
  GroupCategoryRows,
} from "./components/PrimalGroupSection";

// One catalog group's section view model: its per-category subgroups (rows +
// per-type totals), its manually added rows, the combined Today totals shown
// in the section header, and the group's derived Ending Stock + status.
export type GroupSectionData = {
  group: PrimalGroup;
  categoryRows: GroupCategoryRows[];
  customRows: CustomOrderRow[];
  groupTotals: OrderTotals;
  endingStock: number;
  status: AvailabilityStatus;
};

// One operator-added availability group's Sales Orders section: only its
// ad-hoc rows (a custom group has no catalog SKUs), plus its derived Ending
// Stock and status from the matching custom availability row.
export type CustomGroupSectionData = {
  group: PrimalGroup;
  rows: CustomOrderRow[];
  groupTotals: OrderTotals;
  endingStock: number;
  status: AvailabilityStatus;
};

export type PrimalViewModelInput = {
  intake: HogIntakeRecord;
  orders: ProductOrdersForDate;
  customerOrders: CustomerOrdersForDate;
  customGroups: CustomGroupsForDate;
  customRows: CustomRowsForDate;
  openingStock: EndingStockByGroup;
  // Minimum cooler reserve passed to the custom-group availability builder.
  // Defaults to the same constant the catalog rows use.
  minReserve?: number;
};

export type PrimalViewModel = {
  counts: HogCounts;
  intakeTotals: HogIntakeTotals;
  rowsByCategory: Record<PrimalCategory, CategorySkuRow[]>;
  categoryTotalsMap: Record<PrimalCategory, OrderTotals>;
  customRowsByGroup: Record<string, CustomOrderRow[]>;
  groupData: GroupSectionData[];
  availabilityRows: GroupAvailability[];
  availabilityTotals: AvailabilityTotals;
  customGroupRows: GroupAvailability[];
  endingStockByGroup: Record<PrimalGroupKey, number>;
  statusByGroup: Record<PrimalGroupKey, AvailabilityStatus>;
  customGroupData: CustomGroupSectionData[];
  customerColumns: CustomerAvailabilityColumn[];
};

export function derivePrimalViewModel(
  input: PrimalViewModelInput,
): PrimalViewModel {
  const {
    intake,
    orders,
    customerOrders,
    customGroups,
    customRows,
    openingStock,
    minReserve = DEFAULT_MIN_COOLER_RESERVE,
  } = input;

  const counts = intake.hog_counts;

  // Per-category order-entry rows (spec + its editable order).
  const rowsByCategory = {} as Record<PrimalCategory, CategorySkuRow[]>;
  for (const category of PRIMAL_CATEGORIES) {
    rowsByCategory[category] = specsForCategory(category).map((spec) => ({
      spec,
      order: orderFor(orders, spec.sku),
    }));
  }

  const categoryTotalsMap = {} as Record<PrimalCategory, OrderTotals>;
  for (const category of PRIMAL_CATEGORIES) {
    categoryTotalsMap[category] = categoryTotals(category, orders);
  }

  // Manually added rows, bucketed by their owning group. Catalog rows resolve
  // their group from the category; custom-group rows carry an explicit groupKey
  // (the custom group's id), so both catalog keys and custom ids appear here.
  const customRowsByGroup: Record<string, CustomOrderRow[]> = {};
  for (const group of PRIMAL_GROUPS) customRowsByGroup[group.key] = [];
  for (const row of customRows) {
    const key = row.groupKey ?? groupForCategory(row.spec.category).key;
    (customRowsByGroup[key] ??= []).push(row);
  }

  const intakeTotals = deriveTotals(intake);

  // Availability — derived from intake counts + today's orders + customer
  // orders + the opening-stock carry-in.
  const availabilityRows = buildAvailabilityRows(
    orders,
    counts,
    customerOrders,
    openingStock,
    customRows,
  );
  const availabilityTotals = sumAvailability(availabilityRows);

  // Operator-added availability groups — derived the same way as catalog rows
  // (Expected Production from the whole-hog pool), but keyed by their id they
  // also subtract their own Custom Orders + Sales Orders. Kept separate from
  // `availabilityRows` so the catalog-only paths (ending-stock carry-over,
  // cooler push) stay on the fixed primal set.
  const customGroupRows = buildCustomGroupAvailability(
    customGroups,
    counts,
    customerOrders,
    customRows,
    minReserve,
  );

  // Calculated Ending Stock per catalog group (pieces) — shown read-only in
  // each section and pushed to the cooler. Catalog-only: custom groups are
  // ephemeral per-date rows and never carry over.
  const endingStockByGroup = {} as Record<PrimalGroupKey, number>;
  for (const row of availabilityRows) endingStockByGroup[row.group] = row.endingStock;

  // Availability status per catalog group — drives each section header's
  // Ending Stock color. Derived from the same availability rows.
  const statusByGroup = {} as Record<PrimalGroupKey, AvailabilityStatus>;
  for (const row of availabilityRows) statusByGroup[row.group] = row.status;

  // Per-group view model: each group's per-category subgroups (rows + per-type
  // totals), the combined Today totals shown in the group header, and the
  // group's derived Ending Stock + status. Custom rows pool into the same group
  // totals as the catalog rows.
  const groupData: GroupSectionData[] = PRIMAL_GROUPS.map((group) => {
    const categoryRows: GroupCategoryRows[] = group.categories.map(
      (category) => ({
        category,
        rows: rowsByCategory[category],
        totals: categoryTotalsMap[category],
      }),
    );
    const groupCustomRows = customRowsByGroup[group.key];
    const groupTotals = groupCustomRows.reduce(
      (acc, r) => ({
        today_cases: acc.today_cases + r.order.today_cases,
        today_pcs: acc.today_pcs + r.order.today_pcs,
      }),
      categoryRows.reduce(
        (acc, c) => ({
          today_cases: acc.today_cases + c.totals.today_cases,
          today_pcs: acc.today_pcs + c.totals.today_pcs,
        }),
        { today_cases: 0, today_pcs: 0 },
      ),
    );
    return {
      group,
      categoryRows,
      customRows: groupCustomRows,
      groupTotals,
      endingStock: endingStockByGroup[group.key],
      status: statusByGroup[group.key],
    };
  });

  // Custom-group Sales Orders sections — one per operator-added group, holding
  // only its ad-hoc rows (a custom group has no catalog SKUs). Mirrors the
  // catalog groupData shape so it renders through the same PrimalGroupSection,
  // carrying each group's own derived Ending Stock from its availability row.
  const endingByKey = new Map<string, number>(
    customGroupRows.map((row) => [row.group, row.endingStock]),
  );
  const statusByKey = new Map<string, AvailabilityStatus>(
    customGroupRows.map((row) => [row.group, row.status]),
  );
  const customGroupData: CustomGroupSectionData[] = customGroups.map((g) => {
    const group: PrimalGroup = { key: g.id, label: g.label, categories: [] };
    const rows = customRowsByGroup[g.id] ?? [];
    const groupTotals = rows.reduce(
      (acc, r) => ({
        today_cases: acc.today_cases + r.order.today_cases,
        today_pcs: acc.today_pcs + r.order.today_pcs,
      }),
      { today_cases: 0, today_pcs: 0 },
    );
    return {
      group,
      rows,
      groupTotals,
      endingStock: endingByKey.get(g.id) ?? 0,
      status: statusByKey.get(g.id) ?? "OK",
    };
  });

  // Customer chart columns — one per group (catalog + custom), each group's
  // Available Stock minus the summed customer orders against it.
  const customerColumns = buildCustomerAvailability([
    ...availabilityRows,
    ...customGroupRows,
  ]);

  return {
    counts,
    intakeTotals,
    rowsByCategory,
    categoryTotalsMap,
    customRowsByGroup,
    groupData,
    availabilityRows,
    availabilityTotals,
    customGroupRows,
    endingStockByGroup,
    statusByGroup,
    customGroupData,
    customerColumns,
  };
}
