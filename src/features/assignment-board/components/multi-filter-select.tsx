"use client";

import { useRef, useState } from "react";
import { BaseDropdown, DropdownSection, DROPDOWN_WIDTH } from "./base-dropdown";

export function MultiFilterSelect({ placeholder, options, selected, onChange }: {
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);

  const label = selected.length === 0 ? `All ${placeholder}s` : selected.length === 1
    ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
    : `${placeholder} (${selected.length})`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-36 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm text-slate-600 hover:border-slate-400 ${selected.length > 0 ? "border-slate-400 bg-slate-50 font-medium" : "border-slate-200"}`}
      >
        <span className="flex-1 truncate text-left">{label}</span>
        {selected.length > 0 && (
          <span onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="ml-0.5 rounded-full text-slate-400 hover:text-slate-600">×</span>
        )}
        <svg className="h-3.5 w-3.5 opacity-40" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
      </button>
      <BaseDropdown
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        minWidth={DROPDOWN_WIDTH.compact}
        offsetY={4}
      >
        <DropdownSection title={placeholder}>
          {options.map((opt) => (
            <button key={opt.value} onClick={() => toggle(opt.value)}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs font-medium hover:bg-slate-50">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected.includes(opt.value) ? "border-slate-700 bg-slate-700 text-white" : "border-slate-300"}`}>
                {selected.includes(opt.value) && <svg viewBox="0 0 10 8" fill="currentColor" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6"/></svg>}
              </span>
              {opt.label}
            </button>
          ))}
        </DropdownSection>
      </BaseDropdown>
    </div>
  );
}
