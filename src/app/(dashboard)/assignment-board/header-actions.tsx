"use client";

import { Archive, Megaphone, Monitor } from "lucide-react";
import { HeaderActionButton } from "@/components/layout/header-action-button";

export function AssignmentBoardHeaderActions() {
  return (
    <>
      <HeaderActionButton
        onClick={() => window.dispatchEvent(new CustomEvent("announcement-edit"))}
        title="Edit Announcement"
        icon={Megaphone}
      />

      <HeaderActionButton
        href="/tv-display"
        title="TV Display"
        icon={Monitor}
        label="TV Display"
      />

      <HeaderActionButton
        href="/history"
        title="History"
        icon={Archive}
        label="History"
      />
    </>
  );
}
