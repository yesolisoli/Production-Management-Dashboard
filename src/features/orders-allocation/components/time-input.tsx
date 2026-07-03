"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEventHandler,
} from "react";
import { createPortal } from "react-dom";
import { fromTimeInputValue, toTimeInputValue } from "../route-printing";

// Shared time field used by both the Route Printing schedule and the Production
// Sheet's Start column. It replaces the native <input type="time"> with a custom
// control so the two things the floor wants can coexist — which the native
// picker cannot do: once its dropdown is open it captures the keyboard, so you
// can't type the segments while it shows.
//
// Here the segments stay a plain text input (type freely — "6:30", "06:00",
// "1:15 PM", or 24-hour "13:30") AND a column dropdown (Hour / Minute / AM·PM)
// stays open the whole time the field is engaged. Typing and clicking drive the
// same value; neither blocks the other because nothing native is involved.
//
// The stored value may be the floor's "h:mm AM/PM" or 24-hour "HH:MM"; onChange
// emits the raw 24-hour "HH:MM" the existing callers expect (or "" when blank).

type TimeInputProps = {
  value: string; // stored value, "h:mm AM/PM" or "HH:MM"
  onChange: (value: string) => void; // emits 24-hour "HH:MM" (or "" when blank)
  ariaLabel: string;
  className?: string; // sizing/layout only — base styling is built in
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  onBlur?: () => void;
  // Focus + open the dropdown on mount — for click-to-edit cells that only
  // render the field once the cell is activated.
  autoFocus?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

// 24-hour "HH:MM" -> { h12, m, mer }, or nulls when the string is blank.
function partsOf(native: string): {
  h12: number | null;
  m: number | null;
  mer: "AM" | "PM" | null;
} {
  if (!native) return { h12: null, m: null, mer: null };
  const h24 = Number(native.slice(0, 2));
  const m = Number(native.slice(3, 5));
  return {
    h12: h24 % 12 === 0 ? 12 : h24 % 12,
    m,
    mer: h24 < 12 ? "AM" : "PM",
  };
}

// { h12, m, mer } -> 24-hour "HH:MM".
function nativeOf(h12: number, m: number, mer: "AM" | "PM"): string {
  let h24 = h12 % 12;
  if (mer === "PM") h24 += 12;
  return `${pad(h24)}:${pad(m)}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MERIDIEMS = ["AM", "PM"] as const;

// At rest the field is borderless and transparent so it reads as plain text;
// the border/background only appear while editing (hover hints, focus commits).
const baseClass =
  "min-w-0 rounded-lg border border-transparent bg-transparent px-2.5 text-sm tabular-nums text-slate-900 outline-none transition hover:border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";

const colCellClass = (active: boolean) =>
  `w-full rounded-md px-2 py-1.5 text-center text-sm tabular-nums transition ${
    active
      ? "bg-slate-900 font-semibold text-white"
      : "text-slate-600 hover:bg-slate-100"
  }`;

export function TimeInput({
  value,
  onChange,
  ariaLabel,
  className,
  onKeyDown,
  onBlur,
  autoFocus,
}: TimeInputProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Dropdown position, in viewport coords. The dropdown is portalled to
  // <body> so it can escape the Production Sheet's horizontally-scrolling table
  // wrapper (overflow-x-auto clips vertically too, which was cropping it).
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>(
    { left: 0 },
  );
  // Raw text of the input — kept local so a half-typed value isn't clobbered.
  // Seeded from the stored value, normalised to the floor's 12-hour display.
  const [text, setText] = useState(() => fromTimeInputValue(toTimeInputValue(value)));

  // Reflect external value changes (date switch, seed, a column pick) into the
  // field — but never while the user is actively typing in it (that would stomp
  // a half-typed entry; column picks keep focus on the input via preventDefault,
  // so they already update text directly without needing this).
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setText(fromTimeInputValue(toTimeInputValue(value)));
  }, [value]);

  // Close the dropdown on a click outside the whole control, or on Escape. The
  // column buttons now live in a portal (popoverRef), not inside rootRef, so a
  // pick must be recognised as inside via either ref to keep the panel open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Anchor the portalled dropdown to the input, flipping above when there isn't
  // room below. Recompute on open and on any scroll/resize so it tracks the
  // input as the table or page scrolls.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const PANEL = 220; // approx panel height; flip if it won't fit below
      const openUp = window.innerHeight - rect.bottom < PANEL;
      setPos(
        openUp
          ? { bottom: window.innerHeight - rect.top + 6, left: rect.left }
          : { top: rect.bottom + 6, left: rect.left },
      );
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Best-known full time: the typed text if it parses, else the committed value.
  // Drives which column cells are highlighted and the base for a partial pick.
  const base = toTimeInputValue(text) || toTimeInputValue(value);
  const parts = partsOf(base);

  // Commit a column pick: keep the other two parts (defaulting any still-unset),
  // rebuild the value, push it up, and reflect it in the input text.
  const pick = (next: Partial<{ h12: number; m: number; mer: "AM" | "PM" }>) => {
    const h12 = next.h12 ?? parts.h12 ?? 12;
    const m = next.m ?? parts.m ?? 0;
    const mer = next.mer ?? parts.mer ?? "AM";
    const native = nativeOf(h12, m, mer);
    setText(fromTimeInputValue(native));
    onChange(native);
  };

  // On engaging an empty field, seed it with 00:00 (12:00 AM) so the floor
  // starts from a concrete time rather than a blank, then open the dropdown.
  const onEngage = () => {
    setOpen(true);
    if (text.trim() === "" && !value) {
      const native = "00:00";
      setText(fromTimeInputValue(native));
      onChange(native);
    }
  };

  const onText = (raw: string) => {
    setText(raw);
    if (raw.trim() === "") {
      onChange("");
      return;
    }
    const native = toTimeInputValue(raw);
    if (native) onChange(native); // only emit once it parses to a clock time
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onFocus={onEngage}
        onClick={onEngage}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        autoFocus={autoFocus}
        placeholder="hh:mm AM"
        aria-label={ariaLabel}
        className={`${baseClass} ${className ?? ""}`}
      />

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            // Portalled to <body>, so an ancestor's outside-click handler (e.g.
            // the Production Sheet's cell editor) can't see this via DOM
            // containment. This marker lets such handlers treat clicks inside the
            // dropdown as "inside", so picking hour/minute/AM·PM doesn't close the
            // cell after a single pick.
            data-editor-popover=""
            className="fixed z-200 flex w-44 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
            style={{
              ...(pos.top !== undefined ? { top: pos.top } : {}),
              ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
              left: pos.left,
            }}
          >
            <Column
              ariaLabel="Hour"
              items={HOURS}
              render={(h) => String(h)}
              isActive={(h) => parts.h12 === h}
              onPick={(h) => pick({ h12: h })}
            />
            <Column
              ariaLabel="Minute"
              items={MINUTES}
              render={(m) => pad(m)}
              isActive={(m) => parts.m === m}
              onPick={(m) => pick({ m })}
            />
            <Column
              ariaLabel="AM / PM"
              items={MERIDIEMS}
              render={(x) => x}
              isActive={(x) => parts.mer === x}
              onPick={(x) => pick({ mer: x })}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

// One scrollable column of options. onMouseDown (not onClick) commits the pick
// and preventDefault keeps focus on the text input, so the dropdown doesn't
// blur-close between selections. The active option scrolls into view on open so
// a far-down minute (e.g. :45) is visible without manual scrolling.
function Column<T>({
  ariaLabel,
  items,
  render,
  isActive,
  onPick,
}: {
  ariaLabel: string;
  items: readonly T[];
  render: (item: T) => string;
  isActive: (item: T) => boolean;
  onPick: (item: T) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  // Centre the active option within the column only — set the list's own
  // scrollTop rather than scrollIntoView, which could also scroll the page.
  useEffect(() => {
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    list.scrollTop =
      active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
  }, []);
  return (
    <ul
      ref={listRef}
      aria-label={ariaLabel}
      className="flex max-h-48 flex-1 flex-col gap-0.5 overflow-auto"
    >
      {items.map((item, i) => {
        const active = isActive(item);
        return (
          <li key={i}>
            <button
              ref={active ? activeRef : undefined}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item);
              }}
              className={colCellClass(active)}
            >
              {render(item)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
