"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";

export function DailyLineupHeaderActions() {
  return (
    <Link
      href="/assignment-board"
      title="Admin View"
      className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 text-sm font-medium text-white hover:bg-slate-700 sm:w-auto sm:px-4"
    >
      <Settings2 size={16} />
      <span className="hidden sm:inline">Admin View</span>
    </Link>
  );
}
