"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function TimePickerInput({ value, onChange, placeholder = "--:--", triggerClassName, valueClassName, placeholderClassName, renderValue }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  valueClassName?: string;
  placeholderClassName?: string;
  renderValue?: (value: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);

  const [selH, selM] = value ? value.split(":") : ["", ""];
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const hIdx = hours.indexOf(selH);
    const mIdx = minutes.indexOf(selM);
    if (hIdx >= 0) hourRef.current?.children[hIdx]?.scrollIntoView({ block: "center" });
    if (mIdx >= 0) minRef.current?.children[mIdx]?.scrollIntoView({ block: "center" });
  }, [open]);

  const select = (h: string, m: string) => {
    onChange(`${h}:${m}`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName ?? "w-full rounded-xl border border-slate-800 bg-slate-50 px-4 py-3 text-left text-sm font-medium transition-colors focus:bg-white focus:outline-none"}
      >
        {value
          ? (renderValue ? renderValue(value) : <span className={valueClassName ?? "text-slate-800"}>{value}</span>)
          : <span className={placeholderClassName ?? "text-slate-400"}>{placeholder}</span>}
      </button>
      {open && mounted && coords && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="z-50 flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div ref={hourRef} className="h-48 flex-1 overflow-y-auto border-r border-slate-100 scroll-smooth">
            {hours.map((h) => (
              <button key={h} type="button"
                onClick={() => select(h, selM || "00")}
                className={`w-full py-2 text-center text-sm font-medium transition-colors ${selH === h ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >{h}</button>
            ))}
          </div>
          <div ref={minRef} className="h-48 flex-1 overflow-y-auto scroll-smooth">
            {minutes.map((m) => (
              <button key={m} type="button"
                onClick={() => select(selH || "00", m)}
                className={`w-full py-2 text-center text-sm font-medium transition-colors ${selM === m ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >{m}</button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
