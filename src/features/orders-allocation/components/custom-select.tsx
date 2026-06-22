"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

// Generic single-select dropdown — replaces the native <select> so each option
// can carry a colour dot. Presentation only; selection is forwarded up.
export type SelectOption<T extends string> = {
  value: T;
  label: string;
  dotClass: string; // solid colour dot, e.g. "bg-amber-500"
};

type CustomSelectProps<T extends string> = {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  id?: string;
  // When provided, the dropdown shows an "add" row whose free-text label is
  // forwarded here (the parent decides how to persist and select it).
  onAdd?: (label: string) => void;
  addLabel?: string;
};

export function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  id,
  onAdd,
  addLabel = "Add new",
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the dropdown and reset the add affordance in one step, so the panel
  // never reopens mid-add. Memoized so the listener effect can depend on it.
  const close = useCallback(() => {
    setOpen(false);
    setAdding(false);
    setDraftLabel("");
  }, []);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const selected = options.find((o) => o.value === value);

  const toggle = () => (open ? close() : setOpen(true));

  const select = (next: T) => {
    onChange(next);
    close();
  };

  const confirmAdd = () => {
    const label = draftLabel.trim();
    if (label) onAdd?.(label);
    close();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${selected?.dotClass ?? "bg-slate-300"}`}
        />
        <span className="flex-1 truncate text-left">{selected?.label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => select(option.value)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dotClass}`}
                  />
                  <span className="flex-1 text-left">{option.label}</span>
                  {active && (
                    <Check size={16} className="shrink-0 text-slate-500" />
                  )}
                </button>
              </li>
            );
          })}

          {onAdd && (
            <li className="mt-1 border-t border-slate-100 pt-1">
              {adding ? (
                <div className="flex items-center gap-1.5 px-1.5 py-1">
                  <input
                    autoFocus
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmAdd();
                      } else if (e.key === "Escape") {
                        // Cancel the add without closing the whole dropdown.
                        e.preventDefault();
                        e.stopPropagation();
                        setAdding(false);
                        setDraftLabel("");
                      }
                    }}
                    placeholder={addLabel}
                    className="h-9 flex-1 rounded-lg border border-slate-200 px-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    onClick={confirmAdd}
                    className="h-9 shrink-0 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel"
                    onClick={() => {
                      setAdding(false);
                      setDraftLabel("");
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  <Plus size={16} className="shrink-0" />
                  <span className="flex-1 text-left">{addLabel}</span>
                </button>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
