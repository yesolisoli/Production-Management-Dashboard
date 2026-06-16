"use client";

import { useCallback, useRef, useState } from "react";
import { casesToPieces, clampNonNegativeInt } from "../calculations";
import {
  readCustomCustomersForDate,
  readCustomGroupsForDate,
  readCustomRowsForDate,
  saveCustomCustomersForDate,
  saveCustomGroupsForDate,
  saveCustomRowsForDate,
} from "../primal-storage";
import {
  CASE_TO_PCS,
  emptyCustomSpec,
  emptyProductOrder,
  PRIMAL_CATEGORIES,
  PRIMAL_GROUPS,
  type CustomCustomersForDate,
  type CustomGroupsForDate,
  type CustomRowsForDate,
  type OrderField,
  type ProductOrder,
  type ProductSpec,
} from "../types";

// The operator-added entities for the selected date: custom customers (extra
// rows in the customer matrix), custom availability groups, and ad-hoc Sales
// Orders rows. All three are auto-persisted per date and are grouped here
// because removing a custom group also removes its Sales Orders rows.
//
// Cross-store cleanup that reaches customer orders (dropping a removed
// customer's row or a removed group's column) is composed in the orchestrator;
// `removeCustomCustomer` / `removeCustomGroup` here only touch this slice.
export function usePrimalCustomGroupsState({ date }: { date: string }) {
  const [customCustomers, setCustomCustomers] =
    useState<CustomCustomersForDate>([]);
  const [customGroups, setCustomGroups] = useState<CustomGroupsForDate>([]);
  const [customRows, setCustomRows] = useState<CustomRowsForDate>([]);

  // Monotonic suffixes so two rows added in the same millisecond get distinct ids.
  const customRowSeq = useRef(0);
  const customCustomerSeq = useRef(0);
  const customGroupSeq = useRef(0);

  const loadForDate = useCallback((nextDate: string) => {
    setCustomCustomers(readCustomCustomersForDate(nextDate));
    setCustomGroups(readCustomGroupsForDate(nextDate));
    setCustomRows(readCustomRowsForDate(nextDate));
  }, []);

  // ------------------------ Custom customers ------------------------
  const addCustomCustomer = useCallback(() => {
    setCustomCustomers((prev) => {
      const id = `cust-${Date.now()}-${customCustomerSeq.current++}`;
      const next: CustomCustomersForDate = [...prev, { id, name: "" }];
      saveCustomCustomersForDate(date, next);
      return next;
    });
  }, [date]);

  const renameCustomCustomer = useCallback(
    (id: string, name: string) => {
      setCustomCustomers((prev) => {
        const next = prev.map((row) =>
          row.id === id ? { ...row, name } : row,
        );
        saveCustomCustomersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  const removeCustomCustomer = useCallback(
    (id: string) => {
      setCustomCustomers((prev) => {
        const next = prev.filter((row) => row.id !== id);
        saveCustomCustomersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // ------------------------- Custom groups --------------------------
  const addCustomGroup = useCallback(() => {
    setCustomGroups((prev) => {
      const id = `group-${Date.now()}-${customGroupSeq.current++}`;
      const next: CustomGroupsForDate = [...prev, { id, label: "" }];
      saveCustomGroupsForDate(date, next);
      return next;
    });
  }, [date]);

  const renameCustomGroup = useCallback(
    (id: string, label: string) => {
      setCustomGroups((prev) => {
        const next = prev.map((row) =>
          row.id === id ? { ...row, label } : row,
        );
        saveCustomGroupsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  const removeCustomGroup = useCallback(
    (id: string) => {
      setCustomGroups((prev) => {
        const next = prev.filter((row) => row.id !== id);
        saveCustomGroupsForDate(date, next);
        return next;
      });
      // Drop the group's Sales Orders rows so they stop pooling once removed.
      setCustomRows((prev) => {
        if (!prev.some((row) => row.groupKey === id)) return prev;
        const next = prev.filter((row) => row.groupKey !== id);
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // -------------------------- Custom rows ---------------------------
  const addCustomRow = useCallback(
    (groupKey: string) => {
      const catalogGroup = PRIMAL_GROUPS.find((g) => g.key === groupKey);
      setCustomRows((prev) => {
        const id = `custom-${Date.now()}-${customRowSeq.current++}`;
        const row: CustomRowsForDate[number] = catalogGroup
          ? {
              id,
              spec: emptyCustomSpec(catalogGroup.categories[0]),
              order: emptyProductOrder(),
            }
          : {
              id,
              spec: emptyCustomSpec(PRIMAL_CATEGORIES[0]),
              order: emptyProductOrder(),
              groupKey,
            };
        const next: CustomRowsForDate = [...prev, row];
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  const updateCustomRowSpec = useCallback(
    (id: string, patch: Partial<ProductSpec>) => {
      setCustomRows((prev) => {
        const next = prev.map((row) => {
          if (row.id !== id) return row;
          const spec: ProductSpec = { ...row.spec, ...patch };
          if (patch.casePack !== undefined) {
            const parsed = parseInt(patch.casePack, 10);
            spec.piecesPerCase = parsed > 0 ? parsed : 1;
          }
          const order =
            patch.casePack !== undefined
              ? { ...row.order, today_pcs: casesToPieces(spec, row.order.today_cases) }
              : row.order;
          return { ...row, spec, order };
        });
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  const setCustomRowField = useCallback(
    (id: string, field: OrderField, value: number) => {
      const clamped = clampNonNegativeInt(value);
      setCustomRows((prev) => {
        const next = prev.map((row) => {
          if (row.id !== id) return row;
          const order: ProductOrder = { ...row.order, [field]: clamped };
          const pcsField = CASE_TO_PCS[field];
          if (pcsField) order[pcsField] = casesToPieces(row.spec, clamped);
          return { ...row, order };
        });
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  const removeCustomRow = useCallback(
    (id: string) => {
      setCustomRows((prev) => {
        const next = prev.filter((row) => row.id !== id);
        saveCustomRowsForDate(date, next);
        return next;
      });
    },
    [date],
  );

  return {
    customCustomers,
    customGroups,
    customRows,
    loadForDate,
    addCustomCustomer,
    renameCustomCustomer,
    removeCustomCustomer,
    addCustomGroup,
    renameCustomGroup,
    removeCustomGroup,
    addCustomRow,
    updateCustomRowSpec,
    setCustomRowField,
    removeCustomRow,
  };
}
