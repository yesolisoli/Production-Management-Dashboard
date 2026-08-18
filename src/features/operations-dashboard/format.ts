export function personLabel(count: number): string {
  return count === 1 ? "person" : "people";
}

// "Aug 14" — parsed from local components (not `new Date(string)`) so the
// label can't shift a day across timezones. Same approach as history-client.
export function formatDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
