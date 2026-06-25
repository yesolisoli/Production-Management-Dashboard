// Orders & Allocation — domain types.
//
// The product vocabulary is NOT redefined here: cut orders and allocation-sheet
// lines are keyed by the SAME Primal production groups that Hog Intake → Primal
// Calc already drive (Butts / Legs / Loins / Ribs / Picnic). This keeps a single
// product source of truth so availability can be compared per group.
//
// Only RAW input (the per-SKU operational overlay + instructions) is ever
// persisted. The production-sheet rows themselves — SKU, name, ordered qty — are
// DERIVED from the Primal demand snapshot in calculations.ts, never stored.

import {
  PRIMAL_GROUPS,
  type PrimalGroup,
  type PrimalGroupKey,
} from "@/features/primal-calculation/types";

// A production-sheet row is cut in one of these physical rooms (ROOM column).
// Single source for the room picker; extend here to add rooms.
export const PRODUCTION_ROOMS = [
  { value: "main", label: "Main Room" },
  { value: "second", label: "Second Cutting Room" },
  { value: "overflow", label: "Overflow Room" },
] as const;
export type ProductionRoom = (typeof PRODUCTION_ROOMS)[number]["value"];

export function productionRoomLabel(value: ProductionRoom): string {
  return PRODUCTION_ROOMS.find((r) => r.value === value)?.label ?? value;
}

// The production day is split by the hog break. Each SKU is assigned to exactly
// one phase (stored in its ProductionMeta); the planner tabs filter the derived
// rows by that assignment (no parallel state system).
export const CUT_PHASES = [
  { value: "hog_break", label: "Hog Break" },
  { value: "after_hog_break", label: "After Hog Break" },
] as const;
export type CutPhase = (typeof CUT_PHASES)[number]["value"];
export const DEFAULT_CUT_PHASE: CutPhase = "hog_break";

export function cutPhaseLabel(value: CutPhase): string {
  return CUT_PHASES.find((p) => p.value === value)?.label ?? value;
}

// Hog-break calculator — the morning's kill counts drive how long the hog break
// runs, and therefore when the main room can start. Each hog type has a default
// SEC/HEAD rate (seconds of break work per head). The COUNT for most types is
// PULLED from the day's Hog Intake (via `intakeKeys` — the intake hog types that
// sum into this line); types with no `intakeKeys` are entered by hand. TOTAL
// MINUTES / break end / main-room start are all DERIVED (deriveHogBreak in
// calculations.ts) — only the rates, manual counts, start and buffer persist.
export const HOG_TYPES = [
  {
    value: "regular",
    label: "Regular Hog",
    defaultSecPerHead: 34,
    intakeKeys: ["JP", "RWA"],
  },
  { value: "sow", label: "Sow", defaultSecPerHead: 45, intakeKeys: ["Sow"] },
  {
    value: "sow_shoulder",
    label: "Sow Shoulder",
    defaultSecPerHead: 15,
    intakeKeys: [],
  },
] as const;
export type HogType = (typeof HOG_TYPES)[number]["value"];

// Default minutes between the hog break ending and the main room starting
// (clean-down / changeover buffer).
export const DEFAULT_MAIN_ROOM_BUFFER_MIN = 10;
// Default time the hog break begins each morning.
export const DEFAULT_HOG_BREAK_START = "05:00";

// Raw, persisted inputs for the hog-break calculator.
export type HogBreakCalc = {
  counts: Record<HogType, number>; // COUNT per hog type (entered each morning)
  secPerHead: Record<HogType, number>; // SEC/HEAD per hog type (break rate)
  start: string; // HOG BREAK START — free time text, e.g. "05:00"
  mainRoomBufferMin: number; // gap between break end and main-room start
};

export function defaultHogBreakCalc(): HogBreakCalc {
  const counts = {} as Record<HogType, number>;
  const secPerHead = {} as Record<HogType, number>;
  for (const t of HOG_TYPES) {
    counts[t.value] = 0;
    secPerHead[t.value] = t.defaultSecPerHead;
  }
  return {
    counts,
    secPerHead,
    start: DEFAULT_HOG_BREAK_START,
    mainRoomBufferMin: DEFAULT_MAIN_ROOM_BUFFER_MIN,
  };
}

// A hog-break calc is "untouched" when it still equals the default (no counts
// entered, default rate / start / buffer) — used so a day with only the empty
// calculator still counts as an empty draft.
export function isDefaultHogBreakCalc(calc: HogBreakCalc): boolean {
  const d = defaultHogBreakCalc();
  return (
    calc.start === d.start &&
    calc.mainRoomBufferMin === d.mainRoomBufferMin &&
    HOG_TYPES.every(
      (t) =>
        calc.counts[t.value] === d.counts[t.value] &&
        calc.secPerHead[t.value] === d.secPerHead[t.value],
    )
  );
}

// Floor-instruction "Rule type" — drives the colour coding on the sheet.
//   dont     = Red    ("DO NOT")
//   do       = Yellow ("DO THIS")
//   standard = White  ("STANDARD")
// "General Note" is no longer a rule type — it is a Product / Area (see
// allocation-areas.ts) so its lines can carry any of the rule types above.
export const PRIORITIES = [
  { value: "dont", label: "DO NOT" },
  { value: "do", label: "DO THIS" },
  { value: "standard", label: "STANDARD" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["value"];

// A product / area key. The five Primal production groups (ALLOCATION_PRODUCTS)
// remain the single source of truth for anything that reconciles against Primal
// availability. A key may ALSO be an extra, non-Primal floor area (see
// allocation-areas.ts) used purely as a cut-order / instruction LABEL — those
// never reconcile against Primal stock. So the key is a free string, not a
// closed union over the Primal groups.
export type AllocationProduct = string;
export const ALLOCATION_PRODUCTS: readonly PrimalGroup[] = PRIMAL_GROUPS;
export const DEFAULT_PRODUCT: AllocationProduct = PRIMAL_GROUPS[0].key;

// Canonical ordering for product / area keys: the Primal groups first (in
// PRIMAL_GROUPS order), then any extra / custom areas alphabetically. Used by
// the cut-plan filter tabs and the printed allocation sheet so groups list in a
// stable order regardless of the order rows were entered.
export function sortProductKeys(keys: readonly string[]): string[] {
  const order: string[] = PRIMAL_GROUPS.map((g) => g.key);
  const rank = (key: string) => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// -------------------------------------------------------------------
// Raw input entities — the ONLY values that get persisted (localStorage draft).
// -------------------------------------------------------------------

// One SKU-level production-sheet row, DERIVED from the Primal demand snapshot
// (never persisted — recomputed from Primal on every render). SKU / name / qty
// come straight from the catalog + the date's orders.
export type ProductionRow = {
  sku: string;
  name: string; // catalog product name, e.g. "PORK LOIN - VAC PAC"
  group: PrimalGroupKey; // Primal group (badge colour + product filter)
  qtyCases: number; // QTY C/S — ordered cases
  qtyPcs: number; // QTY PCS — ordered loose pieces
};

// The operator-entered overlay for a production row, keyed by SKU. This is the
// ONLY production-sheet data that is persisted; everything else on the row is
// derived from Primal. Defaults apply until the operator edits a row.
// One delivery-route assignment for a production line: which truck route a
// portion of the line ships on, and how many go on it. A line can split across
// several routes (e.g. "#9 (5) + #2 (2)").
export type RouteAssignment = {
  route: string; // truck route label, e.g. "9" or "PUW"
  qty: number; // how many go on this route
};

// FINISH is intentionally NOT here: it is DERIVED from start + secPerPc * pieces
// (see computeFinish in calculations.ts), never entered or persisted.
export type ProductionMeta = {
  phase: CutPhase; // which hog-break phase the SKU is cut in
  room: ProductionRoom; // ROOM
  start: string; // START — free time text, e.g. "6:00"
  secPerPc: number; // SEC/PC — net cutting seconds per piece
  cutters: number; // CUTTERS
  routes: RouteAssignment[]; // DELIVERY ROUTE — truck route split for the line
};

export function defaultProductionMeta(): ProductionMeta {
  return {
    phase: DEFAULT_CUT_PHASE,
    room: PRODUCTION_ROOMS[0].value,
    start: "",
    secPerPc: 0,
    cutters: 0,
    routes: [],
  };
}

export type AllocationInstruction = {
  id: string; // stable id
  category: AllocationProduct;
  qty: number; // optional — 0 means unspecified (shown as "-")
  instruction: string; // free text, e.g. "B'LESS SHORT — BOX THE REST"
  customer: string; // free text, e.g. "SYSCO VIC MON"
  priority: Priority;
};

// One day's draft = the unit of local persistence, keyed by date. The cut plan
// rows are DERIVED from Primal (not stored); only the per-SKU operational
// overlay (production_meta) and the morning-brief instructions are persisted.
export type AllocationDraft = {
  date: string; // "YYYY-MM-DD"
  hog_break: HogBreakCalc; // morning hog-break calculator inputs
  production_meta: Record<string /* sku */, ProductionMeta>;
  instructions: AllocationInstruction[];
};

// -------------------------------------------------------------------
// Factories / predicates
// -------------------------------------------------------------------

export function emptyAllocationDraft(date: string): AllocationDraft {
  return {
    date,
    hog_break: defaultHogBreakCalc(),
    production_meta: {},
    instructions: [],
  };
}

// Default morning-brief instruction lines, transcribed from the standing daily
// allocation sheet. Used to pre-fill the sheet for a date that has no saved
// draft yet so the floor opens to a populated template instead of a blank slate
// (the operator can edit, add, or clear any line). Ids are stable so re-seeding
// keeps row identity. Priority maps the sheet's colour code: do = yellow
// (DO THIS), dont = red (DO NOT), standard = white. Quantities that aren't a
// plain piece count (cases, kilos, totes) are kept in the instruction text since
// the qty field is a single piece number.
export function defaultAllocationInstructions(): AllocationInstruction[] {
  const rows: Omit<AllocationInstruction, "id">[] = [
    // BUTTS
    { category: "Butts", qty: 72, instruction: "BONELESS VAC PAC 2PC PER C/S", customer: "GFS", priority: "standard" },
    { category: "Butts", qty: 0, instruction: "BOX THE REST BONE IN APROX 10C/S", customer: "O/S", priority: "do" },
    // LOINS
    { category: "Loins", qty: 0, instruction: "17 C/S — BONE IN LOINS VAC PAC", customer: "ORDERS THRS / HERTEL FRI", priority: "standard" },
    { category: "Loins", qty: 15, instruction: "DTS", customer: "TOMORROW ORDERS", priority: "standard" },
    { category: "Loins", qty: 30, instruction: "LONG S'LESS FRENCH RACKS", customer: "CIOFFIS FRI", priority: "standard" },
    { category: "Loins", qty: 0, instruction: "24 C/S — BONELESS SHORT VAC PAC", customer: "HERTEL", priority: "standard" },
    { category: "Loins", qty: 0, instruction: "40 C/S — BLUE WRAP ALL DAMAGED", customer: "", priority: "standard" },
    { category: "Loins", qty: 0, instruction: "B'LESS SHORT APROX 240 PC", customer: "O/S", priority: "do" },
    // LEGS
    { category: "Legs", qty: 0, instruction: "BONE IN TOTE APROX 1.6 TOTE", customer: "", priority: "do" },
    // PICNIC
    { category: "Picnic", qty: 0, instruction: "FILL STAPELTON LAST", customer: "", priority: "do" },
    // RIBONS / RIBS / SPARERIBS
    { category: "Ribs", qty: 0, instruction: "BOX ALL SPARERIBS APROX 8C/S", customer: "", priority: "do" },
    // JOWLS
    { category: "Jowls", qty: 0, instruction: "5 C/S + 75 KG — S'LESS JOWLS", customer: "TODAY ORDERS", priority: "standard" },
    { category: "Jowls", qty: 0, instruction: "18 C/S + 55 KG — R/ON JOWLS (FILL FIVE BUTCHERS LAST)", customer: "TODAY ORDERS", priority: "standard" },
    { category: "Jowls", qty: 0, instruction: "BOX THE REST R/ON", customer: "R/ON", priority: "do" },
    // FAT
    { category: "Fat", qty: 0, instruction: "BOX ALL BACK FAT", customer: "O/S", priority: "do" },
    { category: "Fat", qty: 0, instruction: "SAVE ALL BUTT FAT SLAB", customer: "O/S", priority: "do" },
    { category: "Fat", qty: 0, instruction: "100 KG — RIND TODAY ORDERS", customer: "O/S", priority: "do" },
    { category: "Fat", qty: 0, instruction: "SAVE ALL LOIN FAT PC", customer: "O/S", priority: "do" },
    { category: "Fat", qty: 0, instruction: "DO NOT SAVE LEG FAT", customer: "", priority: "dont" },
    { category: "Fat", qty: 0, instruction: "DO NOT SAVE BUTT FAT PC", customer: "", priority: "dont" },
    // HEADS
    { category: "Heads", qty: 120, instruction: "HEADS", customer: "", priority: "do" },
    // MASKS
    { category: "Masks", qty: 0, instruction: "MASKS TODAY ORDERS", customer: "", priority: "do" },
    // BLOOD
    { category: "Blood", qty: 10, instruction: "LIANG", customer: "", priority: "do" },
    { category: "Blood", qty: 12, instruction: "ANTI", customer: "", priority: "do" },
    { category: "Blood", qty: 2, instruction: "SALT", customer: "", priority: "do" },
    // LONG FEET
    { category: "Long Feet", qty: 160, instruction: "10 C/S FOR O/S", customer: "", priority: "do" },
  ];
  return rows.map((row, i) => ({ ...row, id: `default-instruction-${i + 1}` }));
}

// A draft pre-filled with the standing allocation-sheet instructions — the
// fallback for a date with no saved draft, so the screen opens populated. The
// hog-break calc and production overlay stay at their defaults (those derive
// from Primal / are entered per day).
export function seededAllocationDraft(date: string): AllocationDraft {
  return {
    ...emptyAllocationDraft(date),
    instructions: defaultAllocationInstructions(),
  };
}

export function isEmptyAllocationDraft(draft: AllocationDraft): boolean {
  return (
    isDefaultHogBreakCalc(draft.hog_break) &&
    Object.keys(draft.production_meta).length === 0 &&
    draft.instructions.length === 0
  );
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
  Picnic: "bg-pink-100 text-pink-800",
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
  Picnic: "bg-pink-500",
};

// Solid dot class for a product key.
export function productDotClass(key: string): string {
  return PRODUCT_DOT_CLASSES[key] ?? "bg-slate-400";
}

// Per-product text colour — same palette as the badge/dot, for colouring a
// product's name on a light surface (e.g. the sheet's group identity column).
const PRODUCT_TEXT_CLASSES: Record<string, string> = {
  Butts: "text-amber-700",
  Legs: "text-sky-700",
  Loins: "text-violet-700",
  Ribs: "text-emerald-700",
  Picnic: "text-pink-700",
};

// Text colour class for a product key.
export function productTextClass(key: string): string {
  return PRODUCT_TEXT_CLASSES[key] ?? "text-slate-700";
}

export function priorityLabel(value: Priority): string {
  return PRIORITIES.find((p) => p.value === value)?.label ?? value;
}

// Solid per-priority dot colour — matches the sheet legend
// (Red = DO NOT · Yellow = DO THIS · White = STANDARD).
const PRIORITY_DOT_CLASSES: Record<Priority, string> = {
  dont: "bg-red-500",
  do: "bg-amber-400",
  standard: "bg-slate-300",
};

// Solid dot class for a priority value.
export function priorityDotClass(value: Priority): string {
  return PRIORITY_DOT_CLASSES[value];
}
