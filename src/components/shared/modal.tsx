"use client";

import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  footer,
  onClose,
  width = "w-96",
  zIndex = "z-50",
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: string;
  zIndex?: string;
}) {
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40`} onClick={onClose}>
      <div className={`${width} rounded-lg bg-white shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
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
