import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AssignmentBoardClient } from "@/features/assignment-board/components/assignment-board-client";
import { AssignmentBoardHeaderActions } from "./header-actions";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function AssignmentBoardPage() {
  await requireRouteAccess("assignment-board");

  return (
    <div className="flex h-full min-h-full flex-col">
      <AppHeader
        eyebrow="Admin View"
        title="Daily Lineup"
        actions={<AssignmentBoardHeaderActions />}
      />

      <div className="min-h-0 flex-1 p-3 sm:p-6">
        <Suspense fallback={null}>
          <AssignmentBoardClient />
        </Suspense>
      </div>
    </div>
  );
}
