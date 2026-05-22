"use client";

import { useRef, useState } from "react";
import type { WorkArea } from "../types";
import { BaseDropdown, DropdownSection, DropdownItem, DROPDOWN_WIDTH } from "./base-dropdown";

export function ActiveDeptSelect({ activeDepartmentIds, workAreas, onChange }: {
  activeDepartmentIds: string[];
  workAreas: WorkArea[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = (id: string) => {
    onChange(activeDepartmentIds.includes(id)
      ? activeDepartmentIds.filter((x) => x !== id)
      : [...activeDepartmentIds, id]);
  };

  const firstWa = workAreas.find((w) => w.id === activeDepartmentIds[0]);
  const label = activeDepartmentIds.length === 0
    ? "— None —"
    : activeDepartmentIds.length === 1
    ? (firstWa?.name ?? activeDepartmentIds[0])
    : `${activeDepartmentIds.length} dept`;
  const textColor = activeDepartmentIds.length > 0 ? (firstWa?.color_hex ?? "#475569") : "#94a3b8";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded border border-transparent px-2 py-1 text-xs font-medium hover:border-slate-200 hover:bg-white"
        style={{ color: textColor }}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3 w-3 shrink-0 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
      </button>
      <BaseDropdown
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        minWidth={DROPDOWN_WIDTH.compact}
      >
        <DropdownSection title="Active Dept">
          {workAreas.map((wa) => {
            const selected = activeDepartmentIds.includes(wa.id);
            const waColor = wa.color_hex ?? "#475569";
            return (
              <DropdownItem key={wa.id} onClick={() => toggle(wa.id)}>
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors"
                  style={selected
                    ? { backgroundColor: waColor, borderColor: waColor }
                    : { backgroundColor: "#fff", borderColor: "#cbd5e1" }}
                >
                  {selected && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 5l2.5 2.5L8 3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className="font-medium" style={{ color: selected ? waColor : "#475569" }}>{wa.name}</span>
              </DropdownItem>
            );
          })}
        </DropdownSection>
      </BaseDropdown>
    </div>
  );
}
