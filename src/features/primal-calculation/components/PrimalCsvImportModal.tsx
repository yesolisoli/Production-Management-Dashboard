"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, FileUp, Upload } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import {
  buildOrdersCsvTemplate,
  parsePrimalOrdersCsv,
  type CsvImportResult,
} from "../csv-import";
import type { ProductOrdersForDate } from "../types";

type PrimalCsvImportModalProps = {
  date: string;
  onClose: () => void;
  onApply: (orders: ProductOrdersForDate) => void;
};

// Upload → parse → preview → apply. Parsing is synchronous and pure; this
// component only handles file reading, preview rendering, and handing the
// validated orders back to the hook.
export function PrimalCsvImportModal({
  date,
  onClose,
  onApply,
}: PrimalCsvImportModalProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setReadError(null);
    setResult(null);
    try {
      const text = await file.text();
      setResult(parsePrimalOrdersCsv(text));
    } catch {
      setReadError("Could not read the file.");
    }
  };

  const handleApply = () => {
    if (!result || result.matched === 0) return;
    onApply(result.orders);
    onClose();
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildOrdersCsvTemplate()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "primal-orders-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileErrors = result?.errors ?? [];
  const canApply = !!result && result.matched > 0;

  return (
    <Modal
      title="Import Orders from CSV"
      onClose={onClose}
      width="w-[40rem]"
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            Imported quantities merge into{" "}
            <span className="font-semibold tabular-nums">{date}</span> — review,
            then Save to commit.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Upload size={15} />
              {canApply
                ? `Apply ${result.matched} ${result.matched === 1 ? "row" : "rows"}`
                : "Apply Import"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* File picker */}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              // Allow re-selecting the same file name.
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-100"
          >
            <FileUp size={18} />
            {fileName ? `Replace file — ${fileName}` : "Choose CSV file"}
          </button>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-xs text-slate-400">
              Expected columns:{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-600">
                sku, today_cases, tmrw_cases, overstock_cases
              </code>{" "}
              — pieces are computed from each product&apos;s case pack.
            </p>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Download size={14} />
              Template
            </button>
          </div>
        </div>

        {/* Read / file-level errors */}
        {readError && <ErrorNote>{readError}</ErrorNote>}
        {fileErrors.map((err) => (
          <ErrorNote key={err}>{err}</ErrorNote>
        ))}

        {/* Preview */}
        {result && fileErrors.length === 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Pill tone="emerald">{result.matched} matched</Pill>
              {result.skipped > 0 && (
                <Pill tone="amber">{result.skipped} skipped</Pill>
              )}
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-2 py-2 text-center text-blue-600">Today</th>
                    <th className="px-2 py-2 text-center text-emerald-600">Tmrw</th>
                    <th className="px-2 py-2 text-center text-violet-600">O/S</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((row) => (
                    <tr
                      key={`${row.rowNumber}-${row.sku}`}
                      className={
                        row.status === "ok" ? "" : "bg-amber-50/60 text-slate-500"
                      }
                    >
                      <td className="px-3 py-1.5 font-mono text-xs text-slate-400">
                        {row.rowNumber}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs font-semibold text-slate-700">
                        {row.sku || "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        {row.status === "ok" ? (
                          <span className="text-slate-800">{row.name}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle size={12} />
                            {row.message}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums">
                        {row.order ? row.order.today_cases : ""}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums">
                        {row.order ? row.order.tmrw_cases : ""}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums">
                        {row.order ? row.order.overstock_cases : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.matched === 0 && (
              <ErrorNote>
                No rows matched a known SKU — nothing to import.
              </ErrorNote>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

const PILL_TONES: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
};

function Pill({
  tone,
  children,
}: {
  tone: keyof typeof PILL_TONES;
  children: React.ReactNode;
}) {
  return (
    <span className={`rounded-full px-2.5 py-1 ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}
