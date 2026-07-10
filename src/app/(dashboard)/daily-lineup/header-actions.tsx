"use client";

import { Settings2 } from "lucide-react";
import { HeaderActionButton } from "@/components/layout/header-action-button";

export function DailyLineupHeaderActions() {
  return (
    <HeaderActionButton
      href="/assignment-board"
      title="Admin View"
      icon={Settings2}
      label="Admin View"
    />
  );
}
