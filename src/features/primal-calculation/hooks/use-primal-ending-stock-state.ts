"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { HogIntakeRecord } from "@/features/hog-intake/types";
import { buildAvailabilityRows } from "../calculations";
import {
  fetchPreviousEndingStock,
  saveEndingStockForDate,
} from "../ending-stock-source";
import {
  emptyEndingStockByGroup,
  type CustomerOrdersForDate,
  type CustomRowsForDate,
  type EndingStockByGroup,
  type PrimalGroupKey,
  type ProductOrdersForDate,
} from "../types";

type UsePrimalEndingStockStateArgs = {
  date: string;
  hasHydrated: MutableRefObject<boolean>;
  // Inputs the calculated Ending Stock derives from. Owned by other hooks /
  // the orchestrator; passed in so this stays a pure consumer of them.
  intake: HogIntakeRecord;
  intakeStatusKind: "loading" | "ready" | "missing" | "error";
  orders: ProductOrdersForDate;
  customerOrders: CustomerOrdersForDate;
  customRows: CustomRowsForDate;
};

// The day-to-day Ending Stock carry-over chain. Owns the Opening Stock carried
// in from the previous work date and the debounced auto-persist of the
// recalculated Ending Stock, plus the explicit per-group / full saves the
// orchestrator composes into Save / Save All.
export function usePrimalEndingStockState({
  date,
  hasHydrated,
  intake,
  intakeStatusKind,
  orders,
  customerOrders,
  customRows,
}: UsePrimalEndingStockStateArgs) {
  // Opening stock carried in per group — the previous saved date's ending
  // stock, fetched from Supabase on every date change.
  const [openingStock, setOpeningStock] =
    useState<EndingStockByGroup>(emptyEndingStockByGroup);
  // True once the carry-in for the current date has finished loading. The
  // auto-persist effect waits for this so it never writes today's ending stock
  // using the previous date's stale opening value during the fetch.
  const [openingStockLoaded, setOpeningStockLoaded] = useState(false);

  const activeOpeningStockToken = useRef(0);
  // Debounce timer for auto-persisting the recalculated Ending Stock.
  const endingStockSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Carry the previous work date's saved Ending Stock in as this date's Opening
  // Stock. Async (Supabase) and token-guarded so a rapid date change can't let
  // a slow earlier fetch overwrite a newer one.
  const loadForDate = useCallback(async (nextDate: string) => {
    const token = ++activeOpeningStockToken.current;
    setOpeningStockLoaded(false);
    try {
      const previous = await fetchPreviousEndingStock(nextDate);
      if (token !== activeOpeningStockToken.current) return; // stale
      setOpeningStock(previous);
    } catch {
      if (token !== activeOpeningStockToken.current) return;
      setOpeningStock(emptyEndingStockByGroup());
    } finally {
      if (token === activeOpeningStockToken.current) setOpeningStockLoaded(true);
    }
  }, []);

  // Per-group calculated Ending Stock (pieces) — the Availability Chart's
  // endingStock, derived from today's orders + intake + customer orders + the
  // opening-stock carry-in.
  const computeEndingStockByGroup = useCallback((): EndingStockByGroup => {
    const rows = buildAvailabilityRows(
      orders,
      intake.hog_counts,
      customerOrders,
      openingStock,
      customRows,
    );
    const out = emptyEndingStockByGroup();
    for (const row of rows) out[row.group] = row.endingStock;
    return out;
  }, [orders, intake, customerOrders, openingStock, customRows]);

  // Auto-persist the recalculated Ending Stock (debounced) so the carry-over
  // chain is always current. Gated on hydration + the carry-in having loaded +
  // intake settled so it never writes a value derived from a stale Opening
  // Stock or not-yet-loaded hog counts during a date change's async fetch.
  useEffect(() => {
    if (!hasHydrated.current || !openingStockLoaded) return;
    if (intakeStatusKind === "loading") return;
    const byGroup = computeEndingStockByGroup();
    if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
    endingStockSaveTimer.current = setTimeout(() => {
      void saveEndingStockForDate(date, byGroup).catch(() => {
        // Best-effort: a transient persist failure shouldn't block editing;
        // the next recalculation retries.
      });
    }, 600);
    return () => {
      if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
    };
  }, [
    date,
    computeEndingStockByGroup,
    openingStockLoaded,
    intakeStatusKind,
    hasHydrated,
  ]);

  // Drop any pending debounced save (used when the date changes).
  const cancelPendingSave = useCallback(() => {
    if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
  }, []);

  // Commit one group's calculated Ending Stock (used by per-group Save).
  const persistGroup = useCallback(
    async (nextDate: string, groupKey: PrimalGroupKey) => {
      if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
      await saveEndingStockForDate(nextDate, {
        [groupKey]: computeEndingStockByGroup()[groupKey],
      });
    },
    [computeEndingStockByGroup],
  );

  // Commit every group's calculated Ending Stock (used by Save All).
  const persistAll = useCallback(
    async (nextDate: string) => {
      if (endingStockSaveTimer.current) clearTimeout(endingStockSaveTimer.current);
      await saveEndingStockForDate(nextDate, computeEndingStockByGroup());
    },
    [computeEndingStockByGroup],
  );

  return {
    openingStock,
    openingStockLoaded,
    loadForDate,
    computeEndingStockByGroup,
    cancelPendingSave,
    persistGroup,
    persistAll,
  };
}
