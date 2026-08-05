"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

// Hydration gate for the portal: false during SSR/first paint, true on the
// client — expressed as an external store so no mount effect is needed.
const emptySubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

export function TimePickerInput({ value, onChange, placeholder = "--:--", triggerClassName, valueClassName, placeholderClassName, renderValue, editable, formatDisplay, parseInput }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  valueClassName?: string;
  placeholderClassName?: string;
  renderValue?: (value: string) => ReactNode;
  /** When true, the trigger is a text input so the time can also be typed directly. */
  editable?: boolean;
  /** Formats the stored value for display (e.g. 24h -> 12h). Defaults to identity. */
  formatDisplay?: (value: string) => string;
  /** Parses typed text into a stored value. Return null to reject, "" to clear. Required for editable. */
  parseInput?: (raw: string) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);
  const display = formatDisplay ?? ((v: string) => v);

  const [selH, selM] = value ? value.split(":") : ["", ""];

  // Latest selection for the scroll-on-open effect below, so it can keep its
  // "only when opening" timing without re-running (and re-scrolling) when the
  // user picks a value while the popover is open.
  const selRef = useRef<[string, string]>([selH, selM]);
  useEffect(() => {
    selRef.current = [selH, selM];
  }, [selH, selM]);

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
    const [h, m] = selRef.current;
    const hIdx = HOURS.indexOf(h);
    const mIdx = MINUTES.indexOf(m);
    if (hIdx >= 0) hourRef.current?.children[hIdx]?.scrollIntoView({ block: "center" });
    if (mIdx >= 0) minRef.current?.children[mIdx]?.scrollIntoView({ block: "center" });
  }, [open]);

  const select = (h: string, m: string) => {
    setEditing(false);
    onChange(`${h}:${m}`);
  };

  const commitText = () => {
    setEditing(false);
    if (!parseInput) return;
    const parsed = parseInput(text);
    if (parsed !== null && parsed !== value) onChange(parsed);
  };

  return (
    <div ref={ref} className="relative">
      {editable ? (
        <input
          ref={(el) => { triggerRef.current = el; }}
          type="text"
          value={editing ? text : value ? display(value) : ""}
          placeholder={placeholder}
          onFocus={() => { setEditing(true); setText(value ? display(value) : ""); setOpen(true); }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commitText(); setOpen(false); e.currentTarget.blur(); }
            else if (e.key === "Escape") { setEditing(false); setOpen(false); e.currentTarget.blur(); }
          }}
          onBlur={commitText}
          className={triggerClassName ?? "w-full rounded-xl border border-slate-800 bg-slate-50 px-4 py-3 text-left text-sm font-medium transition-colors focus:bg-white focus:outline-none"}
        />
      ) : (
        <button
          ref={(el) => { triggerRef.current = el; }}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={triggerClassName ?? "w-full rounded-xl border border-slate-800 bg-slate-50 px-4 py-3 text-left text-sm font-medium transition-colors focus:bg-white focus:outline-none"}
        >
          {value
            ? (renderValue ? renderValue(value) : <span className={valueClassName ?? "text-slate-800"}>{value}</span>)
            : <span className={placeholderClassName ?? "text-slate-400"}>{placeholder}</span>}
        </button>
      )}
      {open && mounted && coords && createPortal(
        <div
          ref={popoverRef}
          data-floating-panel=""
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="z-50 flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div ref={hourRef} className="h-48 flex-1 overflow-y-auto border-r border-slate-100 scroll-smooth">
            {HOURS.map((h) => (
              <button key={h} type="button"
                onClick={() => select(h, selM || "00")}
                className={`w-full py-2 text-center text-sm font-medium transition-colors ${selH === h ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >{h}</button>
            ))}
          </div>
          <div ref={minRef} className="h-48 flex-1 overflow-y-auto scroll-smooth">
            {MINUTES.map((m) => (
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
