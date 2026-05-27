import { TVDisplayPageClient } from "@/features/assignment-board/components/tv-display-page-client";
import { canAccessRouteForCurrentUser } from "@/lib/route-guard";

export const metadata = {
  title: "TV Display · Assignment Board",
};

export default async function TVDisplayPage() {
  const canAccessAssignmentBoard = await canAccessRouteForCurrentUser(
    "assignment-board",
  );

  return (
    <TVDisplayPageClient canAccessAssignmentBoard={canAccessAssignmentBoard} />
  );
}
