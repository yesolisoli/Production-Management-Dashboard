import { LayoutGrid } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { HeaderActionButton } from "@/components/layout/header-action-button";
import { HistoryClient } from "@/features/assignment-board/components/history-client";
import {
  canAccessRouteForCurrentUser,
  requireRouteAccess,
} from "@/lib/route-guard";

export default async function HistoryPage() {
  await requireRouteAccess("history");
  const canAccessAssignmentBoard = await canAccessRouteForCurrentUser(
    "assignment-board",
  );

  return (
    <div className="flex h-full min-h-full flex-col">
      <AppHeader
        eyebrow="Archive"
        title="Shift History"
        actions={
          canAccessAssignmentBoard ? (
            <HeaderActionButton
              href="/assignment-board"
              title="Admin View"
              icon={LayoutGrid}
              label="Admin View"
            />
          ) : null
        }
      />
      <div className="min-h-0 flex-1 p-3 sm:p-6">
        <HistoryClient />
      </div>
    </div>
  );
}
