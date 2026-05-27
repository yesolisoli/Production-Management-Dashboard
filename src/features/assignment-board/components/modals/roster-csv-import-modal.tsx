"use client";

import { useMemo, useRef, useState } from "react";
import { Modal } from "@/components/shared/modal";
import type { Employee, WorkArea } from "../../types";
import {
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

  return (
    <Modal
      title="Import Employees from CSV"
      onClose={onClose}
      width="w-[calc(100vw-6rem)] max-w-[1100px]"
      zIndex="z-110"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {rows.length > 0 && (
              <span>
                <span className="font-semibold text-emerald-600">{counts.create}</span> new ·{" "}
                <span className="font-semibold text-sky-600">{counts.update}</span> update ·{" "}
                <span className="font-semibold text-slate-500">{counts.skip}</span> skip ·{" "}
                <span className="font-semibold text-red-600">{counts.error}</span> error
              </span>
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
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-slate-700"
            >
              {isImporting ? "Importing..." : `Import ${importable.length} ${importable.length === 1 ? "row" : "rows"}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {filename ? "Choose different file" : "Choose CSV file"}
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
          </label>
          {filename && (
            <>
              <span className="text-sm text-slate-600 truncate">{filename}</span>
              <button onClick={resetFile} className="text-xs text-slate-400 hover:text-slate-600">
                clear
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-slate-700">Duplicates (by employee_code):</span>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="duplicate-strategy"
              checked={duplicateStrategy === "update"}
              onChange={() => setDuplicateStrategy("update")}
            />
            <span className="text-slate-700">Update existing</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="duplicate-strategy"
              checked={duplicateStrategy === "skip"}
              onChange={() => setDuplicateStrategy("skip")}
            />
            <span className="text-slate-700">Skip</span>
          </label>
        </div>

        {combinedFileErrors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p className="font-semibold">Cannot import this file:</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {combinedFileErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {importError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p className="font-semibold">Import failed:</p>
            <p className="mt-1 text-xs">{importError}</p>
          </div>
        )}

        {rows.length > 0 && combinedFileErrors.length === 0 && (
          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-800 text-slate-200">
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
        )}

        {rows.length === 0 && !filename && (
          <div className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
            Choose a CSV file to preview rows here. Maximum {EMPLOYEE_CSV_MAX_ROWS} rows. Use the Download Template button for the expected format.
          </div>
        )}
      </div>
    </Modal>
  );
}
