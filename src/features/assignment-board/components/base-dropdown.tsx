"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const DROPDOWN_WIDTH = { xsmall: 105, compact: 160, default: 192, wide: 240 } as const;

export function BaseDropdown({
  open,
  onClose,
  triggerRef,
  triggerEl,
  minWidth = 144,
  maxHeight,
  offsetY = 2,
  flipThreshold,
  children,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  triggerEl?: HTMLElement | null;
  minWidth?: number;
  maxHeight?: number;
  offsetY?: number;
  /** If set, opens upward when space below trigger is less than this many pixels. */
  flipThreshold?: number;
  children: ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>(
    { left: 0, width: 0 },
  );

  useEffect(() => {
    const el = triggerEl ?? triggerRef?.current ?? null;
    if (!open || !el) return;
    const rect = el.getBoundingClientRect();
    const openUp = flipThreshold !== undefined && (window.innerHeight - rect.bottom) < flipThreshold;
    if (openUp) {
      setPos({ bottom: window.innerHeight - rect.top, left: rect.left, width: rect.width });
    } else {
      setPos({ top: rect.bottom + offsetY, left: rect.left, width: rect.width });
    }
  }, [open, triggerRef, triggerEl, offsetY, flipThreshold]);

  useEffect(() => {
    if (!open) return;
    const el = triggerEl ?? triggerRef?.current ?? null;
    const onMouseDown = (e: MouseEvent) => {
      if (
        el?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, triggerRef, triggerEl]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] overflow-hidden rounded-lg border bg-white shadow-lg"
      style={{
        ...(pos.top !== undefined ? { top: pos.top } : {}),
        ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
        left: pos.left,
        minWidth: Math.max(pos.width, minWidth),
        ...(maxHeight ? { maxHeight, overflowY: "auto" } : {}),
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DropdownSection({
  title,
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <>
      {title && (
        <div className="border-b px-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        </div>
      )}
      <div className="py-1.75">{children}</div>
    </>
  );
}

export function DropdownItem({
  onClick,
  disabled,
  className,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 disabled:opacity-50${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}

export function ActionDropdownItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs font-medium text-slate-500 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}
