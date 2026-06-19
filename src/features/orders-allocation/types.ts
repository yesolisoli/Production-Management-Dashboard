// Orders & Allocation — domain types.
//
// The product vocabulary is NOT redefined here: cut orders and allocation-sheet
// lines are keyed by the SAME Primal production groups that Hog Intake → Primal
// Calc already drive (Butts / Legs / Loins / Ribs / Picnic). This keeps a single
// product source of truth so availability can be compared per group.
//
// Only RAW input (cut_orders + instructions) is ever persisted. Everything the
// screen shows as a total, estimated time, or sheet line is DERIVED in
// calculations.ts and never stored as independent state.

import {
  PRIMAL_GROUPS,
  type PrimalGroup,
  type PrimalGroupKey,
} from "@/features/primal-calculation/types";

// Seconds of cut time per piece (Est. cut time = pieces × 18s).
export const SECONDS_PER_PIECE = 18;

// Quick-add buttons next to the Pieces stepper.
export const PIECE_QUICK_ADDS = [50, 100, 200] as const;

// A cut order is sent to one of two physical locations.
export const CUT_LOCATIONS = [
  { value: "main", label: "Main Line" },
  { value: "overflow", label: "Overflow Room" },
] as const;
export type CutLocation = (typeof CUT_LOCATIONS)[number]["value"];

// Floor-instruction "Rule type" — drives the colour coding on the sheet.
//   dont     = Red    ("DO NOT")
//   do       = Yellow ("DO THIS / HIGH PRIORITY")
//   standard = White  ("STANDARD")
//   note     = Gray   ("GENERAL NOTE")
export const PRIORITIES = [
  { value: "dont", label: "DO NOT" },
  { value: "do", label: "DO THIS / HIGH PRIORITY" },
  { value: "standard", label: "STANDARD" },
  { value: "note", label: "GENERAL NOTE" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["value"];

// Products are the Primal production groups (single source of truth).
export type AllocationProduct = PrimalGroupKey;
export const ALLOCATION_PRODUCTS: readonly PrimalGroup[] = PRIMAL_GROUPS;
export const DEFAULT_PRODUCT: AllocationProduct = PRIMAL_GROUPS[0].key;

// -------------------------------------------------------------------
// Raw input entities — the ONLY values that get persisted (localStorage draft).
// -------------------------------------------------------------------

export type CutOrder = {
  id: string; // stable id (crypto.randomUUID())
  product: AllocationProduct;
  pieces: number; // non-negative integer
  location: CutLocation;
  note: string; // free text, e.g. "B'less boxed vac - SYSCO"
};

export type AllocationInstruction = {
  id: string; // stable id
  category: AllocationProduct;
  qty: number; // optional — 0 means unspecified (shown as "-")
  instruction: string; // free text, e.g. "B'LESS SHORT — BOX THE REST"
  customer: string; // free text, e.g. "SYSCO VIC MON"
  priority: Priority;
};

// One day's draft = the unit of local persistence, keyed by date.
export type AllocationDraft = {
  date: string; // "YYYY-MM-DD"
  cut_orders: CutOrder[];
  instructions: AllocationInstruction[];
};

// -------------------------------------------------------------------
// Factories / predicates
// -------------------------------------------------------------------

export function emptyAllocationDraft(date: string): AllocationDraft {
  return { date, cut_orders: [], instructions: [] };
}

export function isEmptyAllocationDraft(draft: AllocationDraft): boolean {
  return draft.cut_orders.length === 0 && draft.instructions.length === 0;
}

// Uppercase display label for a product key, e.g. "Butts" -> "BUTTS".
export function productLabel(key: string): string {
  const group = PRIMAL_GROUPS.find((g) => g.key === key);
  return (group?.label ?? key).toUpperCase();
}

// Per-product badge colour — single source of truth, a light tint for
// light surfaces (cut orders table). Low-saturation on purpose so the floor
// screen stays calm.
const PRODUCT_BADGE_CLASSES: Record<string, string> = {
  Butts: "bg-amber-100 text-amber-800",
  Legs: "bg-sky-100 text-sky-800",
  Loins: "bg-violet-100 text-violet-800",
  Ribs: "bg-emerald-100 text-emerald-800",
  Picnic: "bg-slate-200 text-slate-700",
};

// Light-surface badge classes for a product key.
export function productBadgeClass(key: string): string {
  return PRODUCT_BADGE_CLASSES[key] ?? "bg-slate-100 text-slate-700";
}

// Solid per-product dot colour — derived from the same palette as the badges,
// used to mark a product at a glance (dropdown options, legends).
const PRODUCT_DOT_CLASSES: Record<string, string> = {
  Butts: "bg-amber-500",
  Legs: "bg-sky-500",
  Loins: "bg-violet-500",
  Ribs: "bg-emerald-500",
  Picnic: "bg-slate-400",
};

// Solid dot class for a product key.
export function productDotClass(key: string): string {
  return PRODUCT_DOT_CLASSES[key] ?? "bg-slate-400";
}

export function locationLabel(value: CutLocation): string {
  return CUT_LOCATIONS.find((l) => l.value === value)?.label ?? value;
}

export function priorityLabel(value: Priority): string {
  return PRIORITIES.find((p) => p.value === value)?.label ?? value;
}

// Solid per-priority dot colour — matches the sheet legend
// (Red = DO NOT · Yellow = DO THIS · White = STANDARD · Gray = GENERAL NOTE).
const PRIORITY_DOT_CLASSES: Record<Priority, string> = {
  dont: "bg-red-500",
  do: "bg-amber-400",
  standard: "bg-slate-300",
  note: "bg-slate-400",
};

// Solid dot class for a priority value.
export function priorityDotClass(value: Priority): string {
  return PRIORITY_DOT_CLASSES[value];
}
