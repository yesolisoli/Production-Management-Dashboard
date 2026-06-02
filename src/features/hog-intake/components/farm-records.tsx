"use client";

import { Plus, Trash2, Truck } from "lucide-react";
import { useBlankZeroInput } from "@/hooks/use-blank-zero-input";
import { clampNonNegativeInt } from "../calculations";
import { HOG_TYPES, type FarmRecord, type HogType } from "../types";

type FarmRecordsProps = {
  rows: FarmRecord[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Omit<FarmRecord, "id">>) => void;
  onRemove: (id: string) => void;
};

export function FarmRecords({
  rows,
  onAdd,
  onUpdate,
  onRemove,
}: FarmRecordsProps) {
  const isEmpty = rows.length === 0;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Farm Delivery Records
          </h3>
          <p className="text-xs text-slate-500">List of farms delivering today</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800"
        >
          <Plus size={13} />
          Add Record
        </button>
      </div>

      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[10px] font-medium uppercase tracking-wide text-slate-400">
            <th className="w-[38%] px-2 py-2">Farm</th>
            <th className="w-[22%] px-2 py-2">Type</th>
            <th className="w-[20%] px-2 py-2">Tattoo / Tag</th>
            <th className="w-[15%] px-2 py-2 text-right">Count</th>
            {!isEmpty ? <th className="w-12 px-2 py-2" /> : null}
          </tr>
        </thead>
        {!isEmpty ? (
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={row.farm}
                    onChange={(e) =>
                      onUpdate(row.id, { farm: e.target.value })
                    }
                    placeholder="Farm name"
                    className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={row.type}
                    onChange={(e) =>
                      onUpdate(row.id, {
                        type: (e.target.value || "") as HogType | "",
                      })
                    }
                    className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white"
                  >
                    <option value="">—</option>
                    {HOG_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={row.tattoo}
                    onChange={(e) =>
                      onUpdate(row.id, { tattoo: e.target.value })
                    }
                    placeholder="1234"
                    className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <CountInput
                    value={row.count}
                    onChange={(count) => onUpdate(row.id, { count })}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(row.id)}
                    aria-label="Delete row"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        ) : null}
      </table>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
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
            className="mt-3 flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
          >
            <Plus size={13} />
            Add first record
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CountInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (count: number) => void;
}) {
  const blank = useBlankZeroInput(value);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      {...blank}
      onChange={(e) => onChange(clampNonNegativeInt(e.target.value))}
      className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-right text-sm tabular-nums outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}
