"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildProductionRows } from "../calculations";
import {
  loadPrimalDemand,
  type PrimalDemandSnapshot,
} from "../primal-demand-source";
import type { ProductionRow } from "../types";

export type PrimalDemandStatus = "loading" | "ready" | "missing" | "error";

// Read-only Primal demand for a date (the source/reference for this screen).
//
// Loads the demand snapshot (see primal-demand-source — the single swap point
// for a future Sign Off snapshot) and exposes the production-sheet rows derived
// from that demand. NOTE: the demand the screen acts on is `salesOrders` per
// group, never availableStock — availableStock/endingStock/shortage are
// reference only (surfaced via the snapshot's availability rows).
export function usePrimalDemand(date: string) {
  const [snapshot, setSnapshot] = useState<PrimalDemandSnapshot | null>(null);
  const [status, setStatus] = useState<PrimalDemandStatus>("loading");
  const token = useRef(0);

  const load = useCallback((forDate: string) => {
    const my = ++token.current;
    setStatus("loading");
    void (async () => {
      try {
        const next = await loadPrimalDemand(forDate);
        if (my !== token.current) return;
        setSnapshot(next);
        setStatus(next.hasIntake ? "ready" : "missing");
      } catch {
        if (my !== token.current) return;
        setSnapshot(null);
        setStatus("error");
      }
    })();
  }, []);

  useEffect(() => {
    // Intended date→demand sync (reads the Primal source for the date), not an
    // avoidable render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date);
  }, [date, load]);

  const productionRows = useMemo<ProductionRow[]>(
    () => (snapshot ? buildProductionRows(snapshot) : []),
    [snapshot],
  );

  return { snapshot, status, productionRows };
}
