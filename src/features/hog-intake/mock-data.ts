import type { HogIntakeRecord } from "./types";

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Generates a rolling window of recent intake records. Dates are computed
// relative to "now" so the seed is always current — avoids stale fixed
// dates that drift away from the operator's actual workday.
export function buildHogIntakeMockRecords(): HogIntakeRecord[] {
  return [
    {
      date: dateDaysAgo(4),
      // total = 50 + 40 + 25 + 20 + 30 + 12 + 23 = 200
      hog_counts: { JP: 50, RWA: 40, BK: 25, Sow: 20, Round: 30, Suckling: 12, Customer: 23 },
      side_orders: 20,
      held_over: 5,
      deaths_on_arrival: 1,
      boars_count: 3,
      todays_cutting: 10,
      notes: "Two RWA loads arrived late.",
      farm_records: [
        { id: "fr-d4-1", farm: "ABC Farm", type: "JP", tattoo: "1234", count: 25 },
        { id: "fr-d4-2", farm: "Green Valley Farm", type: "RWA", tattoo: "5678", count: 18 },
        { id: "fr-d4-3", farm: "Sunrise Farm", type: "BK", tattoo: "9101", count: 12 },
        { id: "fr-d4-4", farm: "Happy Field Farm", type: "Sow", tattoo: "2468", count: 10 },
        { id: "fr-d4-5", farm: "Golden Farm", type: "Round", tattoo: "1122", count: 20 },
      ],
      next_day: { hog_count: 220, side_orders: 18, cooler_overstock: 0 },
    },
    {
      date: dateDaysAgo(3),
      // total = 55 + 35 + 30 + 18 + 28 + 10 + 24 = 200
      hog_counts: { JP: 55, RWA: 35, BK: 30, Sow: 18, Round: 28, Suckling: 10, Customer: 24 },
      side_orders: 18,
      held_over: 4,
      deaths_on_arrival: 1,
      boars_count: 2,
      todays_cutting: 9,
      notes: "",
      farm_records: [
        { id: "fr-d3-1", farm: "ABC Farm", type: "JP", tattoo: "1245", count: 30 },
        { id: "fr-d3-2", farm: "Green Valley Farm", type: "RWA", tattoo: "5690", count: 15 },
        { id: "fr-d3-3", farm: "Sunrise Farm", type: "BK", tattoo: "9120", count: 18 },
        { id: "fr-d3-4", farm: "Hilltop Farm", type: "Customer", tattoo: "3355", count: 14 },
      ],
      next_day: { hog_count: 210, side_orders: 16, cooler_overstock: 0 },
    },
    {
      date: dateDaysAgo(2),
      // total = 48 + 42 + 26 + 22 + 30 + 12 + 20 = 200
      hog_counts: { JP: 48, RWA: 42, BK: 26, Sow: 22, Round: 30, Suckling: 12, Customer: 20 },
      side_orders: 22,
      held_over: 7,
      deaths_on_arrival: 0,
      boars_count: 3,
      todays_cutting: 11,
      notes: "Boars count higher than usual — flagged for next sort.",
      farm_records: [
        { id: "fr-d2-1", farm: "ABC Farm", type: "JP", tattoo: "1256", count: 28 },
        { id: "fr-d2-2", farm: "Green Valley Farm", type: "RWA", tattoo: "5701", count: 20 },
        { id: "fr-d2-3", farm: "Sunrise Farm", type: "BK", tattoo: "9133", count: 18 },
        { id: "fr-d2-4", farm: "Happy Field Farm", type: "Sow", tattoo: "2480", count: 14 },
      ],
      next_day: { hog_count: 195, side_orders: 15, cooler_overstock: 0 },
    },
    {
      date: dateDaysAgo(1),
      // total = 52 + 40 + 25 + 18 + 30 + 12 + 23 = 200
      hog_counts: { JP: 52, RWA: 40, BK: 25, Sow: 18, Round: 30, Suckling: 12, Customer: 23 },
      side_orders: 20,
      held_over: 3,
      deaths_on_arrival: 1,
      boars_count: 4,
      todays_cutting: 9,
      notes: "Sunrise Farm delivered a partial load — short by ~3.",
      farm_records: [
        { id: "fr-d1-1", farm: "ABC Farm", type: "JP", tattoo: "1267", count: 30 },
        { id: "fr-d1-2", farm: "Green Valley Farm", type: "RWA", tattoo: "5712", count: 22 },
        { id: "fr-d1-3", farm: "Sunrise Farm", type: "BK", tattoo: "9144", count: 15 },
        { id: "fr-d1-4", farm: "Happy Field Farm", type: "Sow", tattoo: "2491", count: 12 },
        { id: "fr-d1-5", farm: "Golden Farm", type: "Round", tattoo: "1133", count: 20 },
        { id: "fr-d1-6", farm: "Hilltop Farm", type: "Customer", tattoo: "3366", count: 16 },
      ],
      next_day: { hog_count: 205, side_orders: 19, cooler_overstock: 0 },
    },
    {
      date: dateDaysAgo(0),
      // total = 50 + 42 + 24 + 20 + 32 + 12 + 22 = 202
      hog_counts: { JP: 50, RWA: 42, BK: 24, Sow: 20, Round: 32, Suckling: 12, Customer: 22 },
      side_orders: 18,
      held_over: 6,
      deaths_on_arrival: 1,
      boars_count: 2,
      todays_cutting: 10,
      notes: "Watch for incoming late delivery from Green Valley.",
      farm_records: [
        { id: "fr-d0-1", farm: "ABC Farm", type: "JP", tattoo: "1278", count: 28 },
        { id: "fr-d0-2", farm: "Green Valley Farm", type: "RWA", tattoo: "5723", count: 22 },
        { id: "fr-d0-3", farm: "Sunrise Farm", type: "BK", tattoo: "9155", count: 14 },
        { id: "fr-d0-4", farm: "Happy Field Farm", type: "Sow", tattoo: "2502", count: 12 },
      ],
      next_day: { hog_count: 210, side_orders: 17, cooler_overstock: 0 },
    },
  ];
}
