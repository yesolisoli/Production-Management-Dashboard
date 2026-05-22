import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { HistoryClient } from "@/features/assignment-board/components/history-client";

export default function HistoryPage() {
  return (
    <div className="flex h-full min-h-full flex-col">
      <AppHeader
        eyebrow="Archive"
        title="Shift History"
        actions={
          <Link
            href="/assignment-board"
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
          >
            <LayoutGrid size={16} />
            Admin View
          </Link>
        }
      />
      <div className="min-h-0 flex-1 p-6">
        <HistoryClient />
      </div>
    </div>
  );
}
