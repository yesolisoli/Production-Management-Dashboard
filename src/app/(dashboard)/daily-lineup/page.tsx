import { redirect } from "next/navigation";

// The read-only Daily Lineup overview is hidden — the menu goes straight
// to the admin assignment board. Keep the route so old links still land
// somewhere sensible.
export default function DailyLineupPage() {
  redirect("/assignment-board");
}
