// Route Printing Schedule — merges the two paper sheets the floor keeps by hand
// (the day's "Route Printed Times" actuals and the weekday "Production
// Deadlines" reference) into a single computed schedule: per route, the target
// deadline vs the actual printed time, their difference, and an on-time status.
//
// Pure data + derivation (no I/O, no React). The deadline table is keyed by
// weekday so the schedule follows the planner's selected date; the printed-time
// actuals only exist for the day they were captured, so they apply only when the
// planner is on that date (every other day reads as "Not Printed").

// Weekday keys for the deadline reference. Mon–Fri only — the plant does not run
// the printing schedule on weekends, so those days have no deadlines.
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";

// Status of a route's print against its deadline.
//   on_time     — printed on or before the deadline (difference <= 0)
//   late        — printed after the deadline (difference > 0)
//   not_printed — no printed time captured for this route yet
export type RoutePrintStatus = "on_time" | "late" | "not_printed";

// Production Deadlines reference (target print time per route, per weekday).
// Transcribed from the floor's "Production Deadlines" sheet. Keyed by route
// number → "h:mm AM/PM". Friday's anomalous "14S 7:00 AM" entry is omitted (the
// 14 route uses its 14F 9:00 AM deadline).
const DEADLINES: Record<Weekday, Record<number, string>> = {
  mon: {
    10: "6:00 AM",
    6: "9:00 AM",
    8: "9:00 AM",
    14: "9:00 AM",
    1: "9:15 AM",
    2: "10:00 AM",
    3: "10:00 AM",
    4: "10:00 AM",
    5: "10:00 AM",
    11: "1:30 PM",
  },
  tue: {
    1: "8:00 AM",
    2: "8:00 AM",
    10: "8:15 AM",
    8: "9:00 AM",
    14: "9:00 AM",
    3: "9:15 AM",
    4: "9:30 AM",
    5: "10:00 AM",
    6: "10:00 AM",
    7: "11:30 AM",
    12: "3:00 PM",
  },
  wed: {
    10: "6:00 AM",
    3: "9:00 AM",
    8: "9:00 AM",
    14: "9:00 AM",
    1: "9:15 AM",
    2: "10:00 AM",
    4: "10:00 AM",
    5: "10:00 AM",
    6: "10:00 AM",
    9: "12:30 PM",
  },
  thu: {
    1: "8:00 AM",
    2: "8:00 AM",
    8: "9:00 AM",
    14: "9:00 AM",
    3: "9:15 AM",
    4: "9:30 AM",
    5: "10:00 AM",
    6: "10:00 AM",
    7: "11:30 AM",
    12: "3:00 PM",
  },
  fri: {
    14: "9:00 AM",
    1: "9:15 AM",
    3: "9:15 AM",
    4: "9:15 AM",
    6: "9:15 AM",
    2: "10:00 AM",
    5: "10:00 AM",
    8: "10:00 AM",
    9: "12:30 PM",
  },
};

// The day the "Route Printed Times" actuals below were captured. Printed times
// only make sense for this date; any other planner date has no actuals.
export const PRINTED_TIMES_DATE = "2026-06-24"; // Wed, 24-Jun-26

// "Route Printed Times" actuals for PRINTED_TIMES_DATE — route number → the
// clock time the route's labels were printed. These are the SEED for that day's
// editable printed times; once seeded they live in the draft like any other
// entered value (the operator can correct them).
const PRINTED_TIMES: Record<number, string> = {
  1: "9:09 AM",
  2: "9:11 AM",
  3: "8:30 AM",
  4: "8:06 AM",
  5: "9:20 AM",
  6: "9:28 AM",
  10: "6:26 AM",
  14: "8:33 AM",
};

// Seed printed times for a fresh draft: the captured actuals on PRINTED_TIMES_DATE,
// empty on every other day (those start blank for the operator to fill in). Keyed
// by route number as a string to match the persisted draft shape.
export function defaultRoutePrints(date: string): Record<string, string> {
  if (date !== PRINTED_TIMES_DATE) return {};
  return Object.fromEntries(
    Object.entries(PRINTED_TIMES).map(([route, time]) => [route, time]),
  );
}

// Free-text notes that ride along with a route (off-cuts, special pulls), keyed
// by route number. These SEED the editable per-route notes on PRINTED_TIMES_DATE;
// once seeded they live in the draft like the printed times (the operator can
// edit them).
const PRINTED_NOTES: Record<number, string> = {
  10: "B'LESS PICNIC, S'LESS JOWLS, LEGS - TOTE, B'LESS LEG HOCK OFF DTR",
};

// Seed notes for a fresh draft: the captured notes on PRINTED_TIMES_DATE, empty
// on every other day. Keyed by route number as a string to match the persisted
// draft shape (mirrors defaultRoutePrints).
export function defaultRouteNotes(date: string): Record<string, string> {
  if (date !== PRINTED_TIMES_DATE) return {};
  return Object.fromEntries(
    Object.entries(PRINTED_NOTES).map(([route, note]) => [route, note]),
  );
}

// One merged schedule row: a route, its deadline, what actually happened, and
// the derived comparison. printedTime/diffMinutes are null when the route has
// not been printed for the date.
export type RoutePrintingRow = {
  route: number;
  deadline: string; // "h:mm AM/PM"
  printedTime: string | null; // "h:mm AM/PM" or null
  diffMinutes: number | null; // actual − target, in minutes (null if not printed)
  status: RoutePrintStatus;
  note: string | null;
};

// Map a "YYYY-MM-DD" date to its weekday key (UTC parse to dodge timezone drift,
// matching how the planner keys everything by the raw date string). Returns null
// for Sat/Sun, which have no printing schedule.
export function weekdayForDate(date: string): Weekday | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const day = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
  return (
    [null, "mon", "tue", "wed", "thu", "fri", null] as (Weekday | null)[]
  )[day];
}

// Parse "h:mm AM/PM" (or 24-hour "H:MM") to minutes since midnight; null if
// unparseable. Tolerates the data's mixed spacing (e.g. "7:00AM").
function toMinutes(time: string): number | null {
  const match = time
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

// Convert a stored printed time ("h:mm AM/PM", or 24-hour "HH:MM") to the
// 24-hour "HH:MM" value a native <input type="time"> expects. Returns "" when
// the value doesn't parse, so the picker shows empty.
export function toTimeInputValue(stored: string): string {
  const min = toMinutes(stored);
  if (min === null) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

// Normalise any stored/typed clock time to the floor's canonical display
// format: zero-padded 12-hour "hh:mm AM/PM" (e.g. "04:20 AM"). Accepts the
// floor's "h:mm AM/PM", 24-hour "HH:MM", and the loose spacing the data uses,
// so it doubles as the single display formatter for deadlines and printed
// times. Returns "" for a blank/cleared input.
export function fromTimeInputValue(value: string): string {
  const min = toMinutes(value);
  if (min === null) return "";
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const meridiem = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${meridiem}`;
}

// Format a signed minute difference like the floor sheet: "+1h 09m", "-9m",
// "-1h 49m", "0m". Minutes are zero-padded only when an hour part is shown.
export function formatDiff(minutes: number): string {
  if (minutes === 0) return "0m";
  const sign = minutes > 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0
    ? `${sign}${h}h ${String(m).padStart(2, "0")}m`
    : `${sign}${m}m`;
}

// Display the planner date as the floor sheet writes it: "24-Jun-26". Built from
// the raw string parts (no Date) to stay timezone-proof.
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export function formatSheetDate(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const [, y, m, d] = match;
  return `${d}-${MONTHS[Number(m) - 1] ?? m}-${y.slice(2)}`;
}

// Tally for the summary footer.
export type RoutePrintingSummary = {
  late: number;
  onTime: number;
  notPrinted: number;
};

// Build the merged schedule for a planner date: every route with a deadline that
// weekday, joined to its operator-entered printed time (`prints`, keyed by route
// number as a string). A printed time only counts once it parses as a clock time
// — partial/garbled input reads as Not Printed until valid. Rows are ordered
// printed-first, then by route number, matching how the floor reads the combined
// sheet. Returns no rows on weekends (no schedule).
export function buildRoutePrinting(
  date: string,
  prints: Record<string, string>,
  notes: Record<string, string> = {},
): {
  rows: RoutePrintingRow[];
  summary: RoutePrintingSummary;
} {
  const weekday = weekdayForDate(date);
  if (!weekday) return { rows: [], summary: { late: 0, onTime: 0, notPrinted: 0 } };

  const deadlines = DEADLINES[weekday];

  const rows: RoutePrintingRow[] = Object.entries(deadlines).map(
    ([routeKey, deadline]) => {
      const route = Number(routeKey);
      const raw = prints[routeKey]?.trim();
      const printedMin = raw ? toMinutes(raw) : null;
      // Only a parseable time counts as printed.
      const printedTime = printedMin !== null ? raw! : null;

      let diffMinutes: number | null = null;
      let status: RoutePrintStatus = "not_printed";
      if (printedTime) {
        const deadlineMin = toMinutes(deadline);
        if (deadlineMin !== null) {
          diffMinutes = printedMin! - deadlineMin;
          status = diffMinutes > 0 ? "late" : "on_time";
        }
      }

      // Notes are operator-owned free text, independent of whether the route has
      // been printed yet. An empty note reads back as null.
      const note = notes[routeKey]?.trim() ? notes[routeKey] : null;

      return {
        route,
        deadline,
        printedTime,
        diffMinutes,
        status,
        note,
      };
    },
  );

  rows.sort((a, b) => {
    const aPrinted = a.printedTime ? 0 : 1;
    const bPrinted = b.printedTime ? 0 : 1;
    return aPrinted - bPrinted || a.route - b.route;
  });

  const summary = rows.reduce<RoutePrintingSummary>(
    (acc, row) => {
      if (row.status === "late") acc.late += 1;
      else if (row.status === "on_time") acc.onTime += 1;
      else acc.notPrinted += 1;
      return acc;
    },
    { late: 0, onTime: 0, notPrinted: 0 },
  );

  return { rows, summary };
}
