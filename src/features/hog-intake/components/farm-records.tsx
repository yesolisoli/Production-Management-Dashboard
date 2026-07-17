"use client";

import clsx from "clsx";
import { ChevronDown, Plus, Truck, X } from "lucide-react";
import { useRef, useState } from "react";
import { BaseDropdown, DROPDOWN_WIDTH } from "@/features/assignment-board/components/base-dropdown";
import { TimePickerInput } from "@/features/assignment-board/components/modals/time-picker-input";
import { NumberStepper } from "@/components/shared/number-stepper";
import {
  FARM_RECORD_TYPES,
  type FarmRecord,
  type FarmRecordType,
} from "../types";

type FarmRecordsProps = {
  rows: FarmRecord[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Omit<FarmRecord, "id">>) => void;
  onRemove: (id: string) => void;
};

// Colored pill styling per delivery type. Unassigned rows stay neutral so they
// read as "not yet counted toward primal".
const TYPE_PILL: Record<
  FarmRecordType | "",
  { bg: string; text: string; dot: string }
> = {
  "": { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" },
  JP: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  RWA: { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" },
  BK: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  // BK/JP folds into primal JP — tinted toward JP's blue but kept distinct.
  "BK/JP": { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  Sow: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  Round: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-500" },
  Suckling: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-500" },
  Customer: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-500" },
};

// Selectable delivery types for a farm row. "" reads as Unassigned.
const TYPE_OPTIONS: (FarmRecordType | "")[] = ["", ...FARM_RECORD_TYPES];

const typeLabel = (type: FarmRecordType | "") =>
  type === "" ? "Unassigned" : type;

export function FarmRecords({
  rows,
  onAdd,
  onUpdate,
  onRemove,
}: FarmRecordsProps) {
  const isEmpty = rows.length === 0;

  const awaitingType = rows.reduce(
    (sum, r) => sum + (r.type === "" ? r.count : 0),
    0,
  );

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Truck size={16} />
        </span>
        <h3 className="text-base font-semibold text-slate-900">
          Farm Delivery Records
        </h3>
      </div>

      {/* Table wrapped in a rounded, bordered container to match the Today's
          Availability table. */}
      <div className="px-5 pb-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-xl table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="w-[32%] pl-7 pr-5 py-3">Farm</th>
            <th className="w-[15%] pl-6 pr-3 py-3">Type</th>
            <th className="w-[16%] px-3 py-3 text-center">Tattoo / Tag</th>
            <th className="w-[15%] px-3 py-3 text-center">Count</th>
            <th className="w-[18%] px-3 py-3 text-center">Delivery Time</th>
            {!isEmpty ? <th className="w-12 px-3 py-3" /> : null}
          </tr>
        </thead>
        {!isEmpty ? (
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              return (
                <tr key={row.id}>
                  <td className="px-5 py-2">
                    <input
                      type="text"
                      value={row.farm}
                      onChange={(e) =>
                        onUpdate(row.id, { farm: e.target.value })
                      }
                      placeholder="Farm name"
                      className="h-10 w-full rounded-lg border border-transparent bg-transparent px-2 text-base font-normal text-slate-900 outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <TypeSelect
                      value={row.type}
                      onChange={(type) => onUpdate(row.id, { type })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="text"
                      value={row.tattoo}
                      onChange={(e) =>
                        onUpdate(row.id, { tattoo: e.target.value })
                      }
                      placeholder="1234"
                      className="h-10 w-24 rounded-lg border border-transparent bg-transparent px-3 text-center text-base font-normal text-slate-900 outline-none transition hover:border-slate-200 focus:border-slate-400 focus:bg-white"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <NumberStepper
                      variant="card"
                      className="inline-flex items-center gap-1.5"
                      ariaLabel="Count"
                      value={row.count}
                      onChange={(count) => onUpdate(row.id, { count })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <TimePickerInput
                      value={row.delivery_time ?? ""}
                      onChange={(delivery_time) =>
                        onUpdate(row.id, { delivery_time })
                      }
                      editable
                      formatDisplay={formatTime12h}
                      parseInput={parseTimeInput}
                      placeholder="Set time"
                      triggerClassName="h-10 w-28 rounded-lg border border-transparent bg-transparent px-3 text-center text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-200 focus:border-slate-400 focus:bg-white"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      aria-label="Delete row"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ) : null}
      </table>
      </div>
      </div>

      {!isEmpty ? (
        <div className="flex justify-center py-3">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add Record"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <Plus size={16} />
          </button>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Truck size={20} />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700">
            No delivery records yet
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Add farms that delivered today
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-3 flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
          >
            <Plus size={13} />
            Add first record
          </button>
        </div>
      ) : null}

      {!isEmpty && awaitingType > 0 ? (
        <div className="mt-auto border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-amber-600">
              {awaitingType} head awaiting type
            </span>{" "}
            <span className="text-slate-400">— not in primal</span>
          </p>
        </div>
      ) : null}
    </section>
  );
}

// Formats a stored 24h "HH:MM" as 12h "hh:mm AM/PM" for display.
function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

// Parses freely-typed time text into stored 24h "HH:MM". Accepts 24h ("6:15",
// "06:15", "615") and 12h ("6:15 pm", "6pm"). Returns "" to clear, null to
// reject (caller keeps the previous value).
function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  const m = s.match(/^(\d{1,2})\s*[:.]?\s*(\d{2})?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.[0];
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = ap === "p" ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
  } else if (h > 23) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Custom pill dropdown for a row's delivery type. Replaces the native <select>
// so the whole pill (including the chevron) is a reliable click target.
function TypeSelect({
  value,
  onChange,
}: {
  value: FarmRecordType | "";
  onChange: (type: FarmRecordType | "") => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pill = TYPE_PILL[value];

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex items-center rounded-full pl-3 pr-2.5 py-1.5 text-sm font-semibold outline-none",
          pill.bg,
          pill.text,
        )}
      >
        <span
          className={clsx("mr-1.5 h-2 w-2 shrink-0 rounded-full", pill.dot)}
        />
        {typeLabel(value)}
        <ChevronDown size={14} className="ml-1.5 shrink-0" />
      </button>
      <BaseDropdown
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        minWidth={DROPDOWN_WIDTH.xsmall}
        offsetY={4}
        flipThreshold={220}
      >
        <div className="py-1.5">
          {TYPE_OPTIONS.map((option) => {
            const opt = TYPE_PILL[option];
            const active = option === value;
            return (
              <button
                key={option || "unassigned"}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full items-center px-3 py-1.5 text-left text-sm font-semibold transition-colors",
                  active ? "bg-slate-100" : "hover:bg-slate-50",
                  opt.text,
                )}
              >
                <span
                  className={clsx(
                    "mr-2 h-2 w-2 shrink-0 rounded-full",
                    opt.dot,
                  )}
                />
                {typeLabel(option)}
              </button>
            );
          })}
        </div>
      </BaseDropdown>
    </div>
  );
}
