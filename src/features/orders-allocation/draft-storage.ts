// Local persistence for the Orders & Allocation draft.
//
// localStorage only — one entry per date so a day's work survives a browser
// refresh (the chosen scope for this screen; no Supabase yet). Keeping this
// isolated means a future DB-backed save can replace just these functions
// without touching the hook or UI (mirrors hog-intake / primal draft storage).

import {
  ALLOCATION_PRODUCTS,
  CUT_LOCATIONS,
  DEFAULT_PRODUCT,
  PRIORITIES,
  type AllocationDraft,
  type AllocationInstruction,
  type AllocationProduct,
  type CutLocation,
  type CutOrder,
  type Priority,
} from "./types";

const DRAFT_KEY_PREFIX = "orders-allocation.draft.";

function draftKey(date: string): string {
  return `${DRAFT_KEY_PREFIX}${date}`;
}

function asNonNegativeInt(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

function asString(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

function coerceProduct(raw: unknown): AllocationProduct {
  return ALLOCATION_PRODUCTS.some((g: { key: string }) => g.key === raw)
    ? (raw as AllocationProduct)
    : DEFAULT_PRODUCT;
}

function coerceLocation(raw: unknown): CutLocation {
  return CUT_LOCATIONS.some((l) => l.value === raw)
    ? (raw as CutLocation)
    : CUT_LOCATIONS[0].value;
}

function coercePriority(raw: unknown): Priority {
  return PRIORITIES.some((p) => p.value === raw)
    ? (raw as Priority)
    : "standard";
}

function coerceCutOrder(raw: unknown): CutOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
    product: coerceProduct(o.product),
    pieces: asNonNegativeInt(o.pieces),
    location: coerceLocation(o.location),
    note: asString(o.note),
  };
}

function coerceInstruction(raw: unknown): AllocationInstruction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
    category: coerceProduct(o.category),
    qty: asNonNegativeInt(o.qty),
    instruction: asString(o.instruction),
    customer: asString(o.customer),
    priority: coercePriority(o.priority),
  };
}

function coerceCutOrders(raw: unknown): CutOrder[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceCutOrder).filter((r): r is CutOrder => r !== null);
}

function coerceInstructions(raw: unknown): AllocationInstruction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(coerceInstruction)
    .filter((r): r is AllocationInstruction => r !== null);
}

export function readDraft(date: string): AllocationDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      date,
      cut_orders: coerceCutOrders(parsed.cut_orders),
      instructions: coerceInstructions(parsed.instructions),
    };
  } catch {
    return null;
  }
}

export function writeDraft(date: string, draft: AllocationDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(date), JSON.stringify(draft));
  } catch {
    // ignore quota / access errors
  }
}

export function clearDraft(date: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(date));
  } catch {
    // ignore
  }
}
