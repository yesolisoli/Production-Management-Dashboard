// Unit tests for the Availability derivation (deriveGroupAvailability).
// Run with:  npx tsx --test src/features/orders-allocation/calculations.availability.test.ts
//
// No test framework is configured in this project, so these use Node's built-in
// test runner (node:test) executed through tsx (already a devDependency). The
// module under test is pure (no I/O), so it imports cleanly here.
import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveGroupAvailability } from "./calculations";
import type { AllocationInstruction } from "./types";
import type { GroupAvailability } from "@/features/primal-calculation/types";

// Minimal GroupAvailability factory — only the fields the selector reads
// (group, label, endingStock) matter; the rest are filled to satisfy the type.
function group(
  key: GroupAvailability["group"],
  endingStock: number,
  label = key,
): GroupAvailability {
  return {
    group: key,
    label,
    categories: [],
    expectedProduction: 0,
    openingStock: 0,
    specialCustomerOrders: 0,
    allocated: 0,
    remainingProducts: 0,
    availableStock: endingStock,
    salesOrders: 0,
    endingStock,
    shortage: 0,
    status: "OK",
  };
}

let seq = 0;
function ins(
  category: string,
  qty: number,
  unit: AllocationInstruction["unit"] = "piece",
): AllocationInstruction {
  return {
    id: `ins-${seq++}`,
    category,
    qty,
    unit,
    instruction: "",
    customer: "",
    priority: "standard",
  };
}

test("Starting Availability equals Primal Ending Stock for the group", () => {
  const [butts] = deriveGroupAvailability([group("Butts", 100)], []);
  assert.equal(butts.startingAvailability, 100);
  assert.equal(butts.allocatedPcs, 0);
  assert.equal(butts.remaining, 100);
  assert.equal(butts.over, false);
});

test("a piece allocation decreases Remaining Availability", () => {
  const [butts] = deriveGroupAvailability(
    [group("Butts", 100)],
    [ins("Butts", 72)],
  );
  assert.equal(butts.allocatedPcs, 72);
  assert.equal(butts.remaining, 28); // 100 - 72, matches the business example
});

test("multiple rows on the same group are summed", () => {
  const [butts] = deriveGroupAvailability(
    [group("Butts", 100)],
    [ins("Butts", 30), ins("Butts", 20), ins("Butts", 10)],
  );
  assert.equal(butts.allocatedPcs, 60);
  assert.equal(butts.remaining, 40);
});

test("allocations only affect their own group (keyed by PrimalGroupKey)", () => {
  const [butts, legs] = deriveGroupAvailability(
    [group("Butts", 100), group("Legs", 50)],
    [ins("Butts", 40), ins("Legs", 10)],
  );
  assert.equal(butts.remaining, 60);
  assert.equal(legs.remaining, 40);
});

test("zero Ending Stock is handled", () => {
  const [butts] = deriveGroupAvailability(
    [group("Butts", 0)],
    [ins("Butts", 5)],
  );
  assert.equal(butts.startingAvailability, 0);
  assert.equal(butts.remaining, -5);
  assert.equal(butts.over, true);
});

test("over-allocation is flagged, value is not clamped", () => {
  const [butts] = deriveGroupAvailability(
    [group("Butts", 100)],
    [ins("Butts", 130)],
  );
  assert.equal(butts.remaining, -30); // preserved negative, not clamped to 0
  assert.equal(butts.over, true);
});

test("case-unit rows are surfaced separately, not subtracted", () => {
  const [butts] = deriveGroupAvailability(
    [group("Butts", 100)],
    [ins("Butts", 10, "case"), ins("Butts", 5)],
  );
  assert.equal(butts.allocatedPcs, 5); // only the piece row counts
  assert.equal(butts.remaining, 95);
  assert.equal(butts.pendingCaseQty, 10);
  assert.equal(butts.pendingCaseRows, 1);
});

test("zero-qty (unspecified) rows are ignored", () => {
  const [butts] = deriveGroupAvailability(
    [group("Butts", 100)],
    [ins("Butts", 0), ins("Butts", 0, "case")],
  );
  assert.equal(butts.allocatedPcs, 0);
  assert.equal(butts.pendingCaseRows, 0);
  assert.equal(butts.remaining, 100);
});

test("instructions on non-Primal areas do not appear and do not affect stock", () => {
  const rows = deriveGroupAvailability(
    [group("Butts", 100)],
    [ins("Jowls", 40), ins("Butts", 10)],
  );
  assert.equal(rows.length, 1); // no phantom Jowls row
  assert.equal(rows[0].group, "Butts");
  assert.equal(rows[0].remaining, 90);
});

test("empty availability (missing Primal data) yields no rows, no crash", () => {
  assert.deepEqual(deriveGroupAvailability([], [ins("Butts", 10)]), []);
});
