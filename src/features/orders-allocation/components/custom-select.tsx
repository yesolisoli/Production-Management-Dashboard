"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, X } from "lucide-react";

// Generic single-select dropdown — replaces the native <select> so each option
// can carry a colour dot. Presentation only; selection is forwarded up.
export type SelectOption<T extends string> = {
  value: T;
  label: string;
  dotClass: string; // solid colour dot, e.g. "bg-amber-500"
  // Pill classes for the "badge" variant, e.g. "bg-amber-100 text-amber-800".
  badgeClass?: string;
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
  // Open the panel as soon as it mounts — for click-to-edit cells that render
  // the select only once the cell is activated, so the dropdown shows at once.
  defaultOpen?: boolean;
  // Called whenever the panel closes (selection, outside click or Escape), so a
  // host cell can drop back out of edit mode in step with the dropdown.
  onClose?: () => void;
  // "dot" (default) shows a colour dot + label. "badge" shows the label inside a
  // colour-coded pill (option.badgeClass) with no dot — for tag-style pickers.
  variant?: "dot" | "badge";
  // Badge-only. When true, the trigger drops its border/chevron and the pill
  // fills the full width, centred — for an inline table cell that must keep the
  // same footprint as its read-mode badge (open expands downward, never resizes).
  // Default (false) keeps the standard bordered dropdown box with a chevron.
  flush?: boolean;
};

export function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  id,
  onAdd,
  addLabel = "Add new",
  defaultOpen = false,
  onClose,
  variant = "dot",
  flush = false,
}: CustomSelectProps<T>) {
  const isBadge = variant === "badge";
  // A flush badge picker drops the border/chevron and shows a full-width centred
  // pill (matches the read-cell badge so opening keeps the same footprint). A
  // boxed picker (the default) sits in a bordered dropdown box with a chevron.
  const flushBadge = isBadge && flush;
  // The pill: full-width centred when flush, otherwise a compact inline pill.
  const badgeClass = flushBadge
    ? "block rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide"
    : "inline-block rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide";
  // Bordered box chrome — used by every picker except the flush badge.
  const boxChrome =
    "h-11 border border-slate-200 bg-white px-3 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  // The open panel is portalled to <body> so it escapes the table's
  // overflow-x-auto wrapper (which clips it vertically). We position it in fixed
  // coordinates measured from the trigger, and re-measure on scroll/resize.
  const [panelPos, setPanelPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);

  const measure = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Open upward only when below is too cramped and above has more room.
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    setPanelPos({
      left: rect.left,
      width: rect.width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
      maxHeight: Math.max(120, (openUp ? spaceAbove : spaceBelow) - gap - 8),
    });
  }, []);

  // Close the dropdown and reset the add affordance in one step, so the panel
  // never reopens mid-add. Memoized so the listener effect can depend on it.
  const close = useCallback(() => {
    setOpen(false);
    setAdding(false);
    setDraftLabel("");
    onClose?.();
  }, [onClose]);

  // Measure once on open, then keep the portalled panel pinned to the trigger as
  // the page/table scrolls or the window resizes. Close on outside click/Escape.
  useEffect(() => {
    if (!open) return;
    measure();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target))
        return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Capture-phase scroll catches the inner table scroller too, not just window.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, close, measure]);

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
        className={`flex w-full items-center gap-2.5 rounded-xl text-sm font-semibold text-slate-900 outline-none transition ${
          flushBadge ? "" : boxChrome
        }`}
      >
        {isBadge ? (
          <span className={flushBadge ? "flex-1" : "flex-1 truncate text-left"}>
            <span className={`${badgeClass} ${selected?.badgeClass ?? ""}`}>
              {selected?.label}
            </span>
          </span>
        ) : (
          <>
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${selected?.dotClass ?? "bg-slate-300"}`}
            />
            <span className="flex-1 truncate text-left">{selected?.label}</span>
          </>
        )}
        {!flushBadge && (
          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open &&
        panelPos &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            // Portalled to <body>, so an ancestor's outside-click handler can't
            // see this via DOM containment. This marker lets such handlers treat
            // clicks inside the panel as "inside" (see time-input.tsx).
            data-editor-popover=""
            style={{
              position: "fixed",
              left: panelPos.left,
              width: panelPos.width,
              top: panelPos.top,
              bottom: panelPos.bottom,
              maxHeight: panelPos.maxHeight,
            }}
            className="z-50 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
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
                  {isBadge ? (
                    <span className={flushBadge ? "flex-1" : "flex-1 text-left"}>
                      <span className={`${badgeClass} ${option.badgeClass ?? ""}`}>
                        {option.label}
                      </span>
                    </span>
                  ) : (
                    <>
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dotClass}`}
                      />
                      <span className="flex-1 text-left">{option.label}</span>
                    </>
                  )}
                  {!flushBadge && active && (
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
        </ul>,
          document.body,
        )}
    </div>
  );
}
