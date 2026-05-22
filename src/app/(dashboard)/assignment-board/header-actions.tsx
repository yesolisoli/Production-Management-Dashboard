"use client";

import Link from "next/link";
import { Archive, Megaphone, Monitor } from "lucide-react";

export function AssignmentBoardHeaderActions() {
  return (
    <>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("announcement-edit"))}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600 bg-slate-900 text-sm font-medium text-white hover:bg-slate-700"
        title="Edit Announcement"
      >
        <Megaphone size={16} />
      </button>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("tv-open"))}
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
      >
        <Monitor size={16} />
        TV Display
      </button>

      <Link
        href="/history"
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
      >
        <Archive size={16} />
        History
      </Link>
    </>
  );
}
