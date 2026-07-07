"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// Shared modal shell. Styling, portal-free centered overlay, and layout are
// unchanged; this adds accessibility (dialog role + labelling), Escape-to-close,
// focus management, and background scroll locking.

// Module-level state shared across every mounted Modal so stacked modals behave:
//   * escapeStack — only the TOPMOST modal reacts to Escape.
//   * body scroll lock — reference-counted so an inner modal closing doesn't
//     unlock the background while an outer modal is still open.
const escapeStack: symbol[] = [];
let bodyLockCount = 0;
let savedBodyOverflow = "";

// A floating popover/dropdown open inside the modal (base-dropdown, custom
// select, time pickers) marks itself so Escape is handled by the popover, not
// by the modal. base-dropdown / time-picker-input expose `data-floating-panel`;
// the orders-allocation inline editors expose `data-editor-popover`.
const OPEN_POPOVER_SELECTOR = "[data-editor-popover],[data-floating-panel]";

export function Modal({
  title,
  children,
  footer,
  onClose,
  width = "w-96",
  zIndex = "z-50",
  descriptionId,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: string;
  zIndex?: string;
  // Opt-in id of a description element inside `children`. When provided it is
  // wired to `aria-describedby`; the Modal can't infer it since the description
  // is part of the consumer's own content.
  descriptionId?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the mount-only effects.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes the modal — but only the topmost one, and only when no nested
  // floating popover is open (that popover handles its own Escape instead).
  useEffect(() => {
    const token = Symbol("modal");
    escapeStack.push(token);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (escapeStack[escapeStack.length - 1] !== token) return;
      if (document.querySelector(OPEN_POPOVER_SELECTOR)) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = escapeStack.indexOf(token);
      if (i !== -1) escapeStack.splice(i, 1);
    };
  }, []);

  // Prevent the background from scrolling while any modal is open.
  useEffect(() => {
    if (bodyLockCount === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    bodyLockCount += 1;
    return () => {
      bodyLockCount -= 1;
      if (bodyLockCount === 0) document.body.style.overflow = savedBodyOverflow;
    };
  }, []);

  // Move focus into the dialog on open (unless an autoFocus child already took
  // it), and restore focus to the previously focused element on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) {
        panel.focus({ preventScroll: true });
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40`} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`${width} rounded-lg bg-white shadow-2xl focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 id={titleId} className="text-xl font-bold text-slate-900">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            ✕
          </button>
        </div>
        <div className="border-b border-slate-200" />
        <div className="px-6 py-5">
          {children}
        </div>
        {footer && (
          <>
            <div className="border-t border-slate-200" />
            <div className="px-6 py-4">
              {footer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
