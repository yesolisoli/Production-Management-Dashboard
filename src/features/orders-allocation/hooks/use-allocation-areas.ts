"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ALLOCATION_PRODUCTS, type AllocationProduct } from "../types";
import {
  BUILT_IN_EXTRA_AREAS,
  normalizeAreaLabel,
  readCustomAreas,
  writeCustomAreas,
} from "../allocation-areas";

// Single source for the product / area vocabulary the dropdowns offer: the
// Primal groups, the built-in extra areas, then any operator-added customs
// (persisted globally in localStorage). The custom list loads after mount to
// avoid a hydration mismatch — built-ins and Primal groups always render.
export function useAllocationAreas() {
  const [customAreas, setCustomAreas] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomAreas(readCustomAreas());
  }, []);

  // Keys already claimed by Primal groups or built-in extras — customs can't
  // duplicate these (case-insensitive).
  const reserved = useMemo(() => {
    const set = new Set<string>();
    for (const group of ALLOCATION_PRODUCTS) set.add(group.key.toLowerCase());
    for (const area of BUILT_IN_EXTRA_AREAS) set.add(area.toLowerCase());
    return set;
  }, []);

  // The dropdown order: Primal groups (canonical), built-in extras, then
  // customs (in the order they were added).
  const areaKeys = useMemo(
    () => [
      ...ALLOCATION_PRODUCTS.map((group) => group.key),
      ...BUILT_IN_EXTRA_AREAS,
      ...customAreas.filter((key) => !reserved.has(key.toLowerCase())),
    ],
    [customAreas, reserved],
  );

  // Add a custom area from a free-text label. If it already exists (any group,
  // built-in, or custom; case-insensitive) returns that existing key instead of
  // duplicating. Returns null for blank input.
  const addArea = useCallback(
    (label: string): AllocationProduct | null => {
      const key = normalizeAreaLabel(label);
      if (!key) return null;
      const lower = key.toLowerCase();
      if (reserved.has(lower)) {
        return (
          [...ALLOCATION_PRODUCTS.map((g) => g.key), ...BUILT_IN_EXTRA_AREAS].find(
            (existing) => existing.toLowerCase() === lower,
          ) ?? key
        );
      }
      const existingCustom = customAreas.find(
        (existing) => existing.toLowerCase() === lower,
      );
      if (existingCustom) return existingCustom;
      const next = [...customAreas, key];
      setCustomAreas(next);
      writeCustomAreas(next);
      return key;
    },
    [customAreas, reserved],
  );

  return { areaKeys, addArea };
}
