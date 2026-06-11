"use client";

import { useCallback, useState } from "react";
import { clampNonNegativeInt } from "../calculations";
import {
  readCustomerOrdersForDate,
  saveCustomerOrdersForDate,
} from "../primal-storage";
import {
  emptyCustomerGroupOrders,
  type CustomerOrdersForDate,
  type PrimalGroupKey,
} from "../types";

// Per-date customer × group order matrix. Auto-persisted on every edit (no
// draft/commit split — the chart is informational). `dropCustomer` /
// `dropGroupColumn` are the cross-store cleanup the orchestrator calls when a
// custom customer or custom group is removed.
export function usePrimalCustomerOrdersState({ date }: { date: string }) {
  const [customerOrders, setCustomerOrders] = useState<CustomerOrdersForDate>(
    {},
  );

  const loadForDate = useCallback((nextDate: string) => {
    setCustomerOrders(readCustomerOrdersForDate(nextDate));
  }, []);

  // Set one customer's order for one group (pieces). Auto-persisted.
  const setCustomerOrder = useCallback(
    (customer: string, group: PrimalGroupKey, value: number) => {
      const clamped = clampNonNegativeInt(value);
      setCustomerOrders((prev) => {
        const current = prev[customer] ?? emptyCustomerGroupOrders();
        const next: CustomerOrdersForDate = {
          ...prev,
          [customer]: { ...current, [group]: clamped },
        };
        saveCustomerOrdersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // Drop a removed customer's entire row of orders so it stops counting.
  const dropCustomer = useCallback(
    (id: string) => {
      setCustomerOrders((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        saveCustomerOrdersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  // Drop a removed availability group's column across every customer.
  const dropGroupColumn = useCallback(
    (id: string) => {
      setCustomerOrders((prev) => {
        if (!Object.values(prev).some((perGroup) => id in perGroup)) {
          return prev;
        }
        const next: CustomerOrdersForDate = {};
        for (const [customer, perGroup] of Object.entries(prev)) {
          const copy = { ...perGroup };
          delete copy[id];
          next[customer] = copy;
        }
        saveCustomerOrdersForDate(date, next);
        return next;
      });
    },
    [date],
  );

  return {
    customerOrders,
    loadForDate,
    setCustomerOrder,
    dropCustomer,
    dropGroupColumn,
  };
}
