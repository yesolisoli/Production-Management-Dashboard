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

      <Link
        href="/tv-display"
        title="TV Display"
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 text-sm font-medium text-white hover:bg-slate-700 sm:w-auto sm:px-4"
      >
        <Monitor size={16} />
        <span className="hidden sm:inline">TV Display</span>
      </Link>

      <Link
        href="/history"
        title="History"
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 text-sm font-medium text-white hover:bg-slate-700 sm:w-auto sm:px-4"
      >
        <Archive size={16} />
        <span className="hidden sm:inline">History</span>
      </Link>
    </>
  );
}
