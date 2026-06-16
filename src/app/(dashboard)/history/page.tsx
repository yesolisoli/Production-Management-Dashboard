import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
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
            <Link
              href="/assignment-board"
              title="Admin View"
              className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 text-sm font-medium text-white hover:bg-slate-700 sm:w-auto sm:px-4"
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Admin View</span>
            </Link>
          ) : null
        }
      />
      <div className="min-h-0 flex-1 p-3 sm:p-6">
        <HistoryClient />
      </div>
    </div>
  );
}
