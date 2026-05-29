"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";

export function DailyLineupHeaderActions() {
  return (
    <Link
      href="/assignment-board"
      className="flex h-10 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
    >
      <Settings2 size={16} />
      Admin View
    </Link>
  );
}
