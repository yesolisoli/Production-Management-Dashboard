"use client";

import { Plus, Trash2 } from "lucide-react";
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
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Farm Delivery Records
          </h3>
          <p className="text-xs text-slate-500">
            Track each delivery for traceability.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus size={14} />
          Add Row
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Farm</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Tattoo</th>
              <th className="px-3 py-2 font-medium">Count</th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-slate-400"
                >
                  No deliveries recorded. Click <strong>Add Row</strong> to start.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="bg-white">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.farm}
                      onChange={(e) =>
                        onUpdate(row.id, { farm: e.target.value })
                      }
                      placeholder="ABC Farm"
                      className="h-9 w-full rounded-lg border border-slate-200 px-2 outline-none focus:border-slate-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.type}
                      onChange={(e) =>
                        onUpdate(row.id, {
                          type: (e.target.value || "") as HogType | "",
                        })
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 outline-none focus:border-slate-400"
                    >
                      <option value="">—</option>
                      {HOG_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.tattoo}
                      onChange={(e) =>
                        onUpdate(row.id, { tattoo: e.target.value })
                      }
                      placeholder="1234"
                      className="h-9 w-full rounded-lg border border-slate-200 px-2 outline-none focus:border-slate-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={row.count}
                      onChange={(e) =>
                        onUpdate(row.id, {
                          count: clampNonNegativeInt(e.target.value),
                        })
                      }
                      className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      aria-label="Delete row"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
