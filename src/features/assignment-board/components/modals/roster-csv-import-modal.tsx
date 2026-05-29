"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Download,
  FileSpreadsheet,
  FileUp,
  Info,
  RefreshCw,
  SkipForward,
  Table as TableIcon,
  X,
} from "lucide-react";
import { Modal } from "@/components/shared/modal";
import type { Employee, WorkArea } from "../../types";
import {
  buildEmployeeTemplateCsv,
  downloadCsv,
  EMPLOYEE_CSV_MAX_ROWS,
  parseEmployeeCsv,
  type DuplicateStrategy,
  type EmployeeCsvRow,
} from "../../csv-import";

type BulkImportRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  homeWorkAreaId: string;
  active: boolean;
  gender: "M" | "F" | null;
  level: 1 | 2 | 3 | null;
  temporary: boolean;
  isUpdate: boolean;
};

export function RosterCsvImportModal({
  employees,
  workAreas,
  onImport,
  onClose,
}: {
  employees: Employee[];
  workAreas: WorkArea[];
  onImport: (rows: BulkImportRow[]) => Promise<void>;
  onClose: () => void;
}) {
  const [filename, setFilename] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>("update");
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseResult = useMemo(() => {
    if (!rawText) return { rows: [] as EmployeeCsvRow[], fileErrors: [] as string[] };
    return parseEmployeeCsv(rawText, {
      workAreas,
      existingEmployees: employees,
      duplicateStrategy,
    });
  }, [rawText, workAreas, employees, duplicateStrategy]);

  const rows = parseResult.rows;
  const combinedFileErrors = parseResult.fileErrors.length > 0 ? parseResult.fileErrors : fileErrors;
  const counts = useMemo(() => {
    const c = { create: 0, update: 0, skip: 0, error: 0 };
    for (const r of rows) c[r.action] += 1;
    return c;
  }, [rows]);

  const importable = rows.filter((r) => r.action === "create" || r.action === "update");
  const canImport = !isImporting && combinedFileErrors.length === 0 && importable.length > 0;

  const handleFile = async (file: File) => {
    setFileErrors([]);
    setImportError(null);
    setFilename(file.name);
    try {
      const text = await file.text();
      setRawText(text);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setFileErrors([`Failed to read file: ${message}`]);
      setRawText("");
    }
  };

  const handleImport = async () => {
    if (!canImport) return;
    setIsImporting(true);
    setImportError(null);

    const bulkRows: BulkImportRow[] = importable.map((row) => {
      const isUpdate = row.action === "update";
      const id = isUpdate ? row.matchedEmployeeId! : `emp_${crypto.randomUUID()}`;
      return {
        id,
        employeeCode: row.employeeCode!,
        fullName: row.fullName,
        homeWorkAreaId: row.homeWorkAreaId!,
        active: row.active,
        gender: row.gender,
        level: row.level,
        temporary: row.temporary,
        isUpdate,
      };
    });

    try {
      await onImport(bulkRows);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setImportError(message);
      setIsImporting(false);
    }
  };

  const resetFile = () => {
    setFilename(null);
    setRawText("");
    setFileErrors([]);
    setImportError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    downloadCsv("employee_template.csv", buildEmployeeTemplateCsv());
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <Modal
      title="Import Employees from CSV"
      onClose={onClose}
      width="w-[calc(100vw-6rem)] max-w-[980px]"
      zIndex="z-110"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            {rows.length > 0 ? (
              <span>
                <span className="font-semibold text-emerald-600">{counts.create}</span> new ·{" "}
                <span className="font-semibold text-sky-600">{counts.update}</span> update ·{" "}
                <span className="font-semibold text-slate-500">{counts.skip}</span> skip ·{" "}
                <span className="font-semibold text-red-600">{counts.error}</span> error
              </span>
            ) : (
              <>
                <Info size={12} />
                <span>Rows with issues are skipped automatically</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!canImport}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Download size={14} />
              {isImporting ? "Importing..." : `Import ${importable.length} ${importable.length === 1 ? "row" : "rows"}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* SOURCE FILE */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Source File
            </h4>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800"
            >
              <Download size={14} />
              Download template
            </button>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={clsx(
              "block cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
              isDragging
                ? "border-sky-400 bg-sky-50"
                : "border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-sky-50/60",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            {filename ? (
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center">
                  <FileSpreadsheet size={20} className="text-sky-700" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900 truncate max-w-[420px]">
                    {filename}
                  </p>
                  <p className="text-xs text-slate-500">Click to choose a different file</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    resetFile();
                  }}
                  className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Clear file"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
                  <FileUp size={20} className="text-sky-700" />
                </div>
                <p className="text-sm font-medium text-slate-900">
                  Drop your CSV here, or{" "}
                  <span className="font-medium text-sky-700 underline underline-offset-2">browse files</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  CSV up to {EMPLOYEE_CSV_MAX_ROWS.toLocaleString()} rows · UTF-8 encoding recommended
                </p>
              </>
            )}
          </label>
        </section>

        {/* ON DUPLICATE */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            On Duplicate
          </h4>
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setDuplicateStrategy("update")}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                duplicateStrategy === "update"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <RefreshCw size={14} />
              Update existing
            </button>
            <button
              type="button"
              onClick={() => setDuplicateStrategy("skip")}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                duplicateStrategy === "skip"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <SkipForward size={14} />
              Skip
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Matched on{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
              employee_code
            </code>
            .{" "}
            {duplicateStrategy === "update" ? (
              <>
                <span className="font-semibold text-slate-700">
                  Existing records will be overwritten
                </span>{" "}
                with values from the file.
              </>
            ) : (
              <span className="text-slate-600">Duplicate rows will be skipped.</span>
            )}
          </p>
        </section>

        {/* PREVIEW */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Preview
          </h4>

          {combinedFileErrors.length > 0 && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p className="font-semibold">Cannot import this file:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {combinedFileErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {importError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p className="font-semibold">Import failed:</p>
              <p className="mt-1 text-xs">{importError}</p>
            </div>
          )}

          {rows.length > 0 && combinedFileErrors.length === 0 ? (
            <div className="max-h-[40vh] overflow-y-auto rounded-md border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900 text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Action</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Home Dept</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Active</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Gender</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Level</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Temp</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.rowNumber}
                      className={
                        r.action === "error"
                          ? "border-b bg-red-50"
                          : r.action === "skip"
                            ? "border-b bg-slate-50 text-slate-400"
                            : r.action === "update"
                              ? "border-b bg-sky-50"
                              : "border-b bg-emerald-50"
                      }
                    >
                      <td className="px-3 py-1.5 text-xs text-slate-500">{r.rowNumber}</td>
                      <td className="px-3 py-1.5 text-xs font-semibold uppercase">
                        {r.action === "create" && <span className="text-emerald-600">New</span>}
                        {r.action === "update" && <span className="text-sky-600">Update</span>}
                        {r.action === "skip" && <span className="text-slate-500">Skip</span>}
                        {r.action === "error" && <span className="text-red-600">Error</span>}
                      </td>
                      <td className="px-3 py-1.5 text-xs">{r.employeeCode ?? "—"}</td>
                      <td className="px-3 py-1.5 text-xs">{r.fullName || <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 py-1.5 text-xs">{r.homeDepartmentInput || <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 py-1.5 text-xs">{r.active ? "true" : "false"}</td>
                      <td className="px-3 py-1.5 text-xs">{r.gender ?? "—"}</td>
                      <td className="px-3 py-1.5 text-xs">{r.level ?? "—"}</td>
                      <td className="px-3 py-1.5 text-xs">{r.temporary ? "true" : "false"}</td>
                      <td className="px-3 py-1.5 text-xs text-red-600">
                        {r.errors.length > 0 ? (
                          <ul className="list-disc pl-4">
                            {r.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : combinedFileErrors.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
                <TableIcon size={20} className="text-sky-700" />
              </div>
              <p className="text-sm text-slate-600">
                Choose a file to preview rows here. We&apos;ll validate up to
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                  {EMPLOYEE_CSV_MAX_ROWS.toLocaleString()} rows
                </span>{" "}
                and flag anything that needs a fix before importing.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}
