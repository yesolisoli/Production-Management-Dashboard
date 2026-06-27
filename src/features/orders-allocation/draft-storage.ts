// Local persistence for the Orders & Allocation draft.
//
// localStorage only — one entry per date so a day's work survives a browser
// refresh (the chosen scope for this screen; no Supabase yet). Keeping this
// isolated means a future DB-backed save can replace just these functions
// without touching the hook or UI (mirrors hog-intake / primal draft storage).

import {
  CUT_PHASES,
  DEFAULT_CUT_PHASE,
  DEFAULT_PRODUCT,
  DEFAULT_UNIT,
  defaultHogBreakCalc,
  defaultProductionMeta,
  HOG_TYPES,
  PRIORITIES,
  PRODUCTION_ROOMS,
  UNITS,
  type AllocationDraft,
  type AllocationInstruction,
  type AllocationProduct,
  type CutPhase,
  type HogBreakCalc,
  type HogType,
  type Priority,
  type ProductionMeta,
  type ProductionRoom,
  type RouteAssignment,
  type Unit,
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

// A product / area key is free text (a Primal group OR an extra / custom area),
// so any non-empty string is preserved; only missing / non-string values fall
// back to the default. Label / colour helpers degrade gracefully for unknown
// keys, and non-Primal keys are simply skipped by the group reconciliation.
function coerceProduct(raw: unknown): AllocationProduct {
  return typeof raw === "string" && raw.trim() ? raw : DEFAULT_PRODUCT;
}

function coerceRoom(raw: unknown): ProductionRoom {
  return PRODUCTION_ROOMS.some((r) => r.value === raw)
    ? (raw as ProductionRoom)
    : PRODUCTION_ROOMS[0].value;
}

function coercePriority(raw: unknown): Priority {
  return PRIORITIES.some((p) => p.value === raw)
    ? (raw as Priority)
    : "standard";
}

// Older drafts predate the qty-unit field — they fall back to pieces (the unit
// the qty number always meant before cases were selectable).
function coerceUnit(raw: unknown): Unit {
  return UNITS.some((u) => u.value === raw) ? (raw as Unit) : DEFAULT_UNIT;
}

// Older drafts predate the hog-break split — they fall back to the default
// phase so an existing day's plan stays intact after the upgrade.
function coercePhase(raw: unknown): CutPhase {
  return CUT_PHASES.some((p) => p.value === raw)
    ? (raw as CutPhase)
    : DEFAULT_CUT_PHASE;
}

// A line's delivery-route split. Non-array / corrupt values read back as empty
// (older drafts predate routes); each entry's route label is trimmed and qty
// clamped to a non-negative int.
function coerceRoutes(raw: unknown): RouteAssignment[] {
  if (!Array.isArray(raw)) return [];
  const out: RouteAssignment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    out.push({ route: asString(o.route).trim(), qty: asNonNegativeInt(o.qty) });
  }
  return out;
}

// The morning hog-break calculator. Missing / corrupt fields fall back to the
// defaults (counts to 0, rates to their per-type default, start / buffer to
// their constants), so older drafts that predate the calculator read back as an
// untouched calc.
function coerceHogBreakCalc(raw: unknown): HogBreakCalc {
  const base = defaultHogBreakCalc();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const counts = (o.counts ?? {}) as Record<string, unknown>;
  const secPerHead = (o.secPerHead ?? {}) as Record<string, unknown>;
  const out: HogBreakCalc = {
    counts: {} as Record<HogType, number>,
    secPerHead: {} as Record<HogType, number>,
    start: typeof o.start === "string" && o.start.trim() ? o.start : base.start,
    bufferMin:
      typeof o.bufferMin === "number"
        ? asNonNegativeInt(o.bufferMin)
        : base.bufferMin,
    mainRoomBufferMin:
      typeof o.mainRoomBufferMin === "number"
        ? asNonNegativeInt(o.mainRoomBufferMin)
        : base.mainRoomBufferMin,
    secondlineOffsetMin:
      typeof o.secondlineOffsetMin === "number"
        ? asNonNegativeInt(o.secondlineOffsetMin)
        : base.secondlineOffsetMin,
  };
  for (const t of HOG_TYPES) {
    out.counts[t.value] = asNonNegativeInt(counts[t.value]);
    out.secPerHead[t.value] =
      typeof secPerHead[t.value] === "number"
        ? asNonNegativeInt(secPerHead[t.value])
        : base.secPerHead[t.value];
  }
  return out;
}

function coerceProductionMeta(raw: unknown): ProductionMeta {
  if (!raw || typeof raw !== "object") return defaultProductionMeta();
  const o = raw as Record<string, unknown>;
  return {
    phase: coercePhase(o.phase),
    room: coerceRoom(o.room),
    start: asString(o.start),
    secPerPc: asNonNegativeInt(o.secPerPc),
    cutters: asNonNegativeInt(o.cutters),
    routes: coerceRoutes(o.routes),
    routeUnit: coerceUnit(o.routeUnit),
  };
}

function coerceInstruction(raw: unknown): AllocationInstruction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
    category: coerceProduct(o.category),
    qty: asNonNegativeInt(o.qty),
    unit: coerceUnit(o.unit),
    instruction: asString(o.instruction),
    customer: asString(o.customer),
    priority: coercePriority(o.priority),
  };
}

// The persisted overlay is a map keyed by SKU; unknown / corrupt entries fall
// back to default meta. Older drafts (which stored a `cut_orders` array) have no
// `production_meta`, so they read back as an empty overlay — harmless, the rows
// re-derive from Primal.
function coerceProductionMetaMap(
  raw: unknown,
): Record<string, ProductionMeta> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, ProductionMeta> = {};
  for (const [sku, value] of Object.entries(raw as Record<string, unknown>)) {
    if (sku) out[sku] = coerceProductionMeta(value);
  }
  return out;
}

// Route Printing actuals: route number (string) → printed time (string). Older
// drafts predate this field, so a missing / corrupt value reads back as empty.
// Only non-empty string values are kept.
function coerceRoutePrints(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [route, value] of Object.entries(raw as Record<string, unknown>)) {
    const time = asString(value);
    if (route && time.trim()) out[route] = time;
  }
  return out;
}

// Route Printing notes: route number (string) → free-text note (string). Older
// drafts predate this field, so a missing / corrupt value reads back as empty.
// Only non-empty string values are kept (mirrors coerceRoutePrints).
function coerceRouteNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [route, value] of Object.entries(raw as Record<string, unknown>)) {
    const note = asString(value);
    if (route && note.trim()) out[route] = note;
  }
  return out;
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
      hog_break: coerceHogBreakCalc(parsed.hog_break),
      production_meta: coerceProductionMetaMap(parsed.production_meta),
      instructions: coerceInstructions(parsed.instructions),
      route_prints: coerceRoutePrints(parsed.route_prints),
      route_notes: coerceRouteNotes(parsed.route_notes),
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

// ------------------------------------------------------------------
// Cleared-date registry
//
// An empty draft has no stored key (clearDraft removes it), so absence alone
// can't tell "never opened" (→ seed the standing template) from "opened and
// explicitly cleared" (→ leave blank). This small set of dates the operator
// cleared on purpose makes that distinction durable, so a cleared day stays
// empty across refreshes instead of re-seeding. A date is dropped from the set
// once it has real saved content again (a saved draft takes precedence anyway).
// ------------------------------------------------------------------

const CLEARED_DATES_KEY = "orders-allocation.cleared-dates";

function readClearedDates(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CLEARED_DATES_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((d): d is string => typeof d === "string"));
  } catch {
    return new Set();
  }
}

function writeClearedDates(dates: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLEARED_DATES_KEY, JSON.stringify([...dates]));
  } catch {
    // ignore quota / access errors
  }
}

export function isDateCleared(date: string): boolean {
  return readClearedDates().has(date);
}

export function markDateCleared(date: string): void {
  const dates = readClearedDates();
  if (dates.has(date)) return;
  dates.add(date);
  writeClearedDates(dates);
}

export function unmarkDateCleared(date: string): void {
  const dates = readClearedDates();
  if (!dates.delete(date)) return;
  writeClearedDates(dates);
}
