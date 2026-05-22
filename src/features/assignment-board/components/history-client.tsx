"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Lock, Users, ClipboardList, Activity } from "lucide-react";
import writeXlsxFile, { type Row as XlsxRow, type Sheet as XlsxSheetBase } from "write-excel-file/browser";

type XlsxSheet = XlsxSheetBase<Blob>;
import { listAssignmentBoardSnapshots, type SnapshotRecord } from "../supabase";
import { getAssignmentWorkAreaId } from "../utils";
import { DEFAULT_MODE_CODE } from "../types";
import type { ModeCode, ShiftInfo, Station, StationAssignment, WorkArea } from "../types";
import type { Employee, EmployeeStatus } from "../types";
import { getUnavailableStatusCodes, STATUS_CODE_AVAILABLE, type StatusConfig } from "./status-select";

function formatDate(workDate: string): string {
  const [y, m, d] = workDate.split("-").map(Number);
  if (!y || !m || !d) return workDate;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCapturedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Summary = {
  totalEmployees: number;
  activeEmployees: number;
  totalAssignments: number;
  realAssignments: number;
  deptOnlyAssignments: number;
  totalStatuses: number;
  noteworthyStatuses: number;
  totalStations: number;
  workAreas: WorkArea[];
};

function summarize(record: SnapshotRecord): Summary {
  const { snapshot } = record;
  const activeEmployees = snapshot.employees.filter((e) => e.active).length;
  const realAssignments = snapshot.assignments.filter((a) => a.station_id !== null).length;
  const deptOnly = snapshot.assignments.length - realAssignments;
  const noteworthy = Object.values(snapshot.statuses).filter(
    (code) => code && code !== STATUS_CODE_AVAILABLE,
  ).length;
  return {
    totalEmployees: snapshot.employees.length,
    activeEmployees,
    totalAssignments: snapshot.assignments.length,
    realAssignments,
    deptOnlyAssignments: deptOnly,
    totalStatuses: Object.keys(snapshot.statuses).length,
    noteworthyStatuses: noteworthy,
    totalStations: snapshot.stations.length,
    workAreas: [...snapshot.workAreas].sort((a, b) => a.display_order - b.display_order),
  };
}

export function HistoryClient() {
  const [records, setRecords] = useState<SnapshotRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAssignmentBoardSnapshots()
      .then((items) => {
        if (cancelled) return;
        setRecords(items);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setRecords([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => records?.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  );

  if (records === null) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading history…</div>;
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-red-500">{error}</div>;
  }

  if (selected) {
    return <SnapshotDetail record={selected} onBack={() => setSelectedId(null)} />;
  }

  return <SnapshotLog records={records} onOpen={(id) => setSelectedId(id)} />;
}

function SnapshotLog({ records, onOpen }: { records: SnapshotRecord[]; onOpen: (id: string) => void }) {
  if (records.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
        <Archive size={36} />
        <p className="text-sm font-medium">No snapshots yet</p>
        <p className="max-w-sm text-xs text-slate-400">
          A snapshot is captured automatically once the last shift end has passed by 30 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {records.length} {records.length === 1 ? "snapshot" : "snapshots"}
        </p>
        <p className="text-[10px] text-slate-400">Read-only archive</p>
      </div>

      <ul className="grid gap-3">
        {records.map((record) => {
          const summary = summarize(record);
          return (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => onOpen(record.id)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-bold text-slate-800">{formatDate(record.work_date)}</h3>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <Lock size={10} /> Read-only
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Captured {formatCapturedAt(record.captured_at)}</p>
                    <p className="text-[10px] text-slate-400">Auto-captured · end of shift</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {summary.workAreas.map((wa) => (
                      <span
                        key={wa.id}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: wa.color_hex ?? "#475569" }}
                      >
                        {wa.name}
                      </span>
                    ))}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-4 gap-3">
                  <Stat icon={<Users size={14} />} label="Employees" value={summary.activeEmployees} sub={`${summary.totalEmployees} total`} />
                  <Stat icon={<ClipboardList size={14} />} label="Assignments" value={summary.totalAssignments} sub={`${summary.realAssignments} station · ${summary.deptOnlyAssignments} dept`} />
                  <Stat icon={<Activity size={14} />} label="Statuses" value={summary.totalStatuses} sub={`${summary.noteworthyStatuses} non-available`} />
                  <Stat icon={<Archive size={14} />} label="Stations" value={summary.totalStations} sub={`${summary.workAreas.length} work areas`} />
                </dl>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-800">{value}</dd>
      {sub && <dd className="text-[10px] text-slate-500">{sub}</dd>}
    </div>
  );
}

const SHEET_NAME_INVALID = /[\\/?*:[\]]/g;

function sanitizeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(SHEET_NAME_INVALID, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) {
    const suffix = ` (${counter})`;
    base = name.replace(SHEET_NAME_INVALID, " ").trim().slice(0, 31 - suffix.length) || "Sheet";
    candidate = base + suffix;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function txt(value: string): { type: StringConstructor; value: string } {
  return { type: String, value };
}

function num(value: number): { type: NumberConstructor; value: number } {
  return { type: Number, value };
}

function header(value: string): { type: StringConstructor; value: string; fontWeight: "bold" } {
  return { type: String, value, fontWeight: "bold" };
}

function buildSummarySheet(record: SnapshotRecord, summary: Summary, used: Set<string>): XlsxSheet {
  const { work_date, captured_at, id } = record;
  const data: XlsxRow[] = [
    [header("Snapshot Report")],
    [txt("Work Date"), txt(work_date)],
    [txt("Captured At"), txt(new Date(captured_at).toLocaleString("en-US"))],
    [txt("Snapshot ID"), txt(id)],
    [],
    [header("Counts")],
    [txt("Total Employees"), num(summary.totalEmployees)],
    [txt("Active Employees"), num(summary.activeEmployees)],
    [txt("Total Assignments"), num(summary.totalAssignments)],
    [txt("Station Assignments"), num(summary.realAssignments)],
    [txt("Dept-only Assignments"), num(summary.deptOnlyAssignments)],
    [txt("Total Statuses"), num(summary.totalStatuses)],
    [txt("Non-available Statuses"), num(summary.noteworthyStatuses)],
    [txt("Total Stations"), num(summary.totalStations)],
    [txt("Work Areas"), num(summary.workAreas.length)],
    [],
    [header("Work Areas Included")],
    ...summary.workAreas.map((w) => [txt(w.name)] as XlsxRow),
  ];

  // Status breakdown
  const { snapshot } = record;
  const statusLabel = new Map(snapshot.statusConfigs.map((c) => [c.code, c.label]));
  const empById = new Map(snapshot.employees.map((e) => [e.id, e]));
  const grouped: Record<string, string[]> = {};
  for (const [employee_id, code] of Object.entries(snapshot.statuses)) {
    if (!code || code === STATUS_CODE_AVAILABLE) continue;
    const emp = empById.get(employee_id);
    if (!emp) continue;
    (grouped[code] ??= []).push(emp.full_name);
  }
  const codes = Object.keys(grouped);
  if (codes.length > 0) {
    data.push([], [header("Employee Statuses (non-available)")], [header("Status"), header("Employee")]);
    for (const code of codes) {
      const label = statusLabel.get(code) ?? code;
      for (const name of grouped[code]) data.push([txt(label), txt(name)]);
    }
  }

  return {
    sheet: sanitizeSheetName("Summary", used),
    data,
    columns: [{ width: 26 }, { width: 36 }],
  };
}

function buildWorkAreaSheet(
  wa: SnapshotRecord["snapshot"]["workAreas"][number],
  record: SnapshotRecord,
  used: Set<string>,
): XlsxSheet {
  const { snapshot } = record;
  const { employees, statuses, assignments, stations, workAreaShifts, statusConfigs } = snapshot;
  const empById = new Map(employees.map((e) => [e.id, e]));
  const waById = new Map(snapshot.workAreas.map((w) => [w.id, w]));
  const statusLabel = new Map(statusConfigs.map((c) => [c.code, c.label]));

  const headerRow: XlsxRow = [
    header("Mode"),
    header("Shift Code"),
    header("Shift Label"),
    header("Shift Time"),
    header("Station"),
    header("Employee Code"),
    header("Employee Name"),
    header("Home Work Area"),
    header("Status"),
    header("Loaned In"),
  ];
  const data: XlsxRow[] = [headerRow];

  const modeCodes: ModeCode[] = wa.mode_views?.length
    ? (wa.mode_views.map((mv) => mv.mode_code) as ModeCode[])
    : [DEFAULT_MODE_CODE];

  let anyRow = false;
  for (const modeCode of modeCodes) {
    const modeLabel = wa.mode_views?.find((mv) => mv.mode_code === modeCode)?.label ?? modeCode;
    const shifts = workAreaShifts?.[wa.id]?.[modeCode] ?? [];
    const waStations = stations
      .filter((s) => s.work_area_id === wa.id && (s.mode_code === modeCode || s.mode_code == null))
      .sort((a, b) => a.display_order - b.display_order);

    for (const shift of shifts) {
      for (const station of waStations) {
        const stationAsgns = assignments.filter(
          (a) => a.shift_code === shift.code && a.mode_code === modeCode && a.station_id === station.id,
        );
        if (stationAsgns.length === 0) {
          data.push([
            txt(modeLabel),
            txt(shift.code),
            txt(shift.label),
            txt(shift.time_range),
            txt(station.name),
            txt(""),
            txt("— Unassigned —"),
            txt(""),
            txt(""),
            txt(""),
          ]);
          anyRow = true;
          continue;
        }
        for (const asgn of stationAsgns) {
          const emp = empById.get(asgn.employee_id);
          if (!emp) continue;
          const home = emp.homeDepartmentId ? waById.get(emp.homeDepartmentId)?.name ?? "" : "";
          const statusCode = statuses[emp.id] ?? "";
          const statusText = statusCode ? statusLabel.get(statusCode) ?? statusCode : "";
          const asgnWaId = getAssignmentWorkAreaId(asgn, stations);
          const loan = !!asgnWaId && asgnWaId !== emp.homeDepartmentId ? "Yes" : "";
          data.push([
            txt(modeLabel),
            txt(shift.code),
            txt(shift.label),
            txt(shift.time_range),
            txt(station.name),
            txt(emp.employee_code ?? ""),
            txt(emp.full_name),
            txt(home),
            txt(statusText),
            txt(loan),
          ]);
          anyRow = true;
        }
      }
    }

    // Dept-only assignments
    const deptAsgns = assignments.filter(
      (a) => a.station_id === null && a.work_area_id === wa.id && a.mode_code === modeCode,
    );
    for (const asgn of deptAsgns) {
      const emp = empById.get(asgn.employee_id);
      if (!emp) continue;
      const home = emp.homeDepartmentId ? waById.get(emp.homeDepartmentId)?.name ?? "" : "";
      const statusCode = statuses[emp.id] ?? "";
      const statusText = statusCode ? statusLabel.get(statusCode) ?? statusCode : "";
      const loan = wa.id !== emp.homeDepartmentId ? "Yes" : "";
      data.push([
        txt(modeLabel),
        txt(""),
        txt("(dept-only)"),
        txt(""),
        txt("(no station)"),
        txt(emp.employee_code ?? ""),
        txt(emp.full_name),
        txt(home),
        txt(statusText),
        txt(loan),
      ]);
      anyRow = true;
    }
  }

  if (!anyRow) data.push([txt("No assignments")]);

  return {
    sheet: sanitizeSheetName(wa.name, used),
    data,
    columns: [
      { width: 16 }, // Mode
      { width: 12 }, // Shift Code
      { width: 18 }, // Shift Label
      { width: 14 }, // Shift Time
      { width: 22 }, // Station
      { width: 14 }, // Employee Code
      { width: 22 }, // Employee Name
      { width: 18 }, // Home Work Area
      { width: 14 }, // Status
      { width: 10 }, // Loaned In
    ],
  };
}

async function downloadSnapshotXlsx(record: SnapshotRecord, summary: Summary): Promise<void> {
  const used = new Set<string>();
  const sheets: XlsxSheet[] = [
    buildSummarySheet(record, summary, used),
    ...summary.workAreas.map((wa) => buildWorkAreaSheet(wa, record, used)),
  ];
  await writeXlsxFile(sheets).toFile(`snapshot_${record.work_date}.xlsx`);
}

function SnapshotDetail({ record, onBack }: { record: SnapshotRecord; onBack: () => void }) {
  const summary = summarize(record);
  const { snapshot, work_date, captured_at } = record;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ChevronLeft size={14} /> Back to log
        </button>
        <button
          type="button"
          onClick={() => { void downloadSnapshotXlsx(record, summary); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          <Download size={14} /> Export to Excel
        </button>
      </div>

      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Snapshot</p>
        <h2 className="mt-1 text-xl font-bold text-slate-800">{formatDate(work_date)}</h2>
        <p className="mt-1 text-xs text-slate-500">Captured {formatCapturedAt(captured_at)} · ID {record.id}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={<Users size={14} />} label="Employees" value={summary.activeEmployees} sub={`${summary.totalEmployees} total`} />
          <Stat icon={<ClipboardList size={14} />} label="Assignments" value={summary.totalAssignments} sub={`${summary.realAssignments} station · ${summary.deptOnlyAssignments} dept`} />
          <Stat icon={<Activity size={14} />} label="Statuses" value={summary.totalStatuses} sub={`${summary.noteworthyStatuses} non-available`} />
          <Stat icon={<Archive size={14} />} label="Stations" value={summary.totalStations} sub={`${summary.workAreas.length} work areas`} />
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {summary.workAreas.map((wa) => (
            <span
              key={wa.id}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: wa.color_hex ?? "#475569" }}
            >
              {wa.name}
            </span>
          ))}
        </div>
      </header>

      <StatusBreakdown snapshot={snapshot} />
      <SnapshotChart record={record} />
    </div>
  );
}

function StatusBreakdown({ snapshot }: { snapshot: SnapshotRecord["snapshot"] }) {
  const configByCode: Record<string, StatusConfig> = {};
  for (const cfg of snapshot.statusConfigs) configByCode[cfg.code] = cfg;

  const grouped: Record<string, { employee_id: string; name: string }[]> = {};
  for (const [employee_id, code] of Object.entries(snapshot.statuses)) {
    if (!code || code === STATUS_CODE_AVAILABLE) continue;
    const emp = snapshot.employees.find((e) => e.id === employee_id);
    if (!emp) continue;
    (grouped[code] ??= []).push({ employee_id, name: emp.full_name });
  }

  const codes = Object.keys(grouped);
  const totalCount = codes.reduce((sum, code) => sum + grouped[code].length, 0);
  const [open, setOpen] = useState(false);

  if (codes.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Employee Statuses</p>
        <p className="mt-2 text-sm text-slate-500">All employees were available at capture time.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Employee Statuses</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{totalCount}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {codes.map((code) => {
              const cfg = configByCode[code];
              const label = cfg?.label ?? code;
              const color = cfg?.colorHex ?? "#64748b";
              const people = grouped[code];
              return (
                <div key={code} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{label}</span>
                    <span className="ml-auto text-[10px] font-semibold text-slate-500">{people.length}</span>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {people.map((p) => (
                      <li key={p.employee_id} className="truncate text-xs text-slate-600">
                        {p.name}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

type ShiftItem = {
  modeCode: ModeCode;
  modeLabel: string | null;
  shift: ShiftInfo;
};

function buildShiftItemsForArea(
  wa: WorkArea,
  stations: Station[],
  assignments: StationAssignment[],
  workAreaShifts: SnapshotRecord["snapshot"]["workAreaShifts"],
): ShiftItem[] {
  const modeCodes: ModeCode[] = wa.mode_views?.length
    ? (wa.mode_views.map((mv) => mv.mode_code) as ModeCode[])
    : [DEFAULT_MODE_CODE];
  const hasMultipleModes = (wa.mode_views?.length ?? 0) > 1;

  const items: ShiftItem[] = [];
  for (const modeCode of modeCodes) {
    const areaStations = stations.filter(
      (s) => s.work_area_id === wa.id && (s.mode_code === modeCode || s.mode_code == null),
    );
    if (areaStations.length === 0) continue;
    const shifts = workAreaShifts?.[wa.id]?.[modeCode] ?? [];
    for (const shift of shifts) {
      const hasAny = assignments.some(
        (a) => a.shift_code === shift.code && a.mode_code === modeCode && areaStations.some((st) => st.id === a.station_id),
      );
      if (!hasAny) continue;
      items.push({
        modeCode,
        modeLabel: hasMultipleModes ? wa.mode_views?.find((mv) => mv.mode_code === modeCode)?.label ?? modeCode : null,
        shift,
      });
    }
  }
  return items;
}

function WorkAreaShiftCard({
  wa,
  stations,
  assignments,
  workAreaShifts,
  activeEmployees,
  statuses,
  unavailableCodes,
}: {
  wa: WorkArea;
  stations: Station[];
  assignments: StationAssignment[];
  workAreaShifts: SnapshotRecord["snapshot"]["workAreaShifts"];
  activeEmployees: Employee[];
  statuses: Record<string, EmployeeStatus>;
  unavailableCodes: Set<string>;
}) {
  const items = useMemo(
    () => buildShiftItemsForArea(wa, stations, assignments, workAreaShifts),
    [wa, stations, assignments, workAreaShifts],
  );
  const [index, setIndex] = useState(0);

  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);
  const current = items[safeIndex];

  const goPrev = () => setIndex((i) => (items.length === 0 ? 0 : (i - 1 + items.length) % items.length));
  const goNext = () => setIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length));

  const areaStations = current
    ? stations
        .filter((s) => s.work_area_id === wa.id && (s.mode_code === current.modeCode || s.mode_code == null))
        .sort((a, b) => a.display_order - b.display_order)
    : [];
  const shiftAsgns = current
    ? assignments.filter((a) => a.shift_code === current.shift.code && a.mode_code === current.modeCode)
    : [];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 px-3 py-2" style={{ backgroundColor: wa.color_hex ?? "#1e293b" }}>
        <p className="truncate text-sm font-bold uppercase tracking-widest text-white">{wa.name}</p>
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-slate-400">No assignments</p>
      ) : (
        <>
          <div className="flex items-center gap-1 bg-slate-100/60 px-2 py-1.5">
            <button
              type="button"
              onClick={goPrev}
              disabled={items.length < 2}
              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous shift"
            >
              <ChevronLeft size={12} />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                {current.modeLabel ? `${current.modeLabel} · ` : ""}
                {current.shift.label}
                {current.shift.time_range ? ` · ${current.shift.time_range.replace("-", " – ")}` : ""}
              </p>
              {items.length > 1 && (
                <p className="text-[9px] text-slate-400">
                  {safeIndex + 1} / {items.length}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={items.length < 2}
              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next shift"
            >
              <ChevronRight size={12} />
            </button>
          </div>

          <ul>
            {areaStations.map((station) => {
              const stationAsgns = shiftAsgns.filter((a) => a.station_id === station.id);
              const assignedEmps = stationAsgns
                .map((a) => ({ asgn: a, emp: activeEmployees.find((e) => e.id === a.employee_id) }))
                .filter((x): x is { asgn: typeof x.asgn; emp: NonNullable<typeof x.emp> } => !!x.emp);

              return (
                <li key={station.id} className="flex items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0">
                  <span className="w-2/5 shrink-0 truncate text-xs text-slate-600">{station.name}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {assignedEmps.length === 0 ? (
                      <span className="text-xs font-semibold text-red-500">Unassigned</span>
                    ) : (
                      assignedEmps.map(({ asgn, emp }) => {
                        const unavailable = unavailableCodes.has(statuses[emp.id] ?? "");
                        const asgnWaId = getAssignmentWorkAreaId(asgn, stations);
                        const loaned = !!asgnWaId && asgnWaId !== emp.homeDepartmentId;
                        return (
                          <span key={`${emp.id}-${asgn.id}`} className="flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                unavailable ? "bg-red-500" : emp.temporary ? "bg-violet-400" : "bg-green-500"
                              }`}
                            />
                            <span className={`truncate text-xs font-medium ${unavailable ? "text-red-500" : "text-slate-700"}`}>
                              {emp.full_name}
                            </span>
                            {loaned && (
                              <span className="ml-auto shrink-0 rounded border border-blue-200 bg-blue-50 px-1 text-[9px] text-blue-600">
                                loan
                              </span>
                            )}
                          </span>
                        );
                      })
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function SnapshotChart({ record }: { record: SnapshotRecord }) {
  const { snapshot } = record;
  const { employees, statuses, assignments, stations, workAreas, workAreaShifts, statusConfigs } = snapshot;

  const unavailableCodes = getUnavailableStatusCodes(statusConfigs);
  const sortedWorkAreas = [...workAreas].sort((a, b) => a.display_order - b.display_order);
  const activeEmployees = employees.filter((e) => e.active);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Chart at capture time</p>
      </div>

      <div className="p-5">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${sortedWorkAreas.length || 1}, minmax(220px, 1fr))` }}
        >
          {sortedWorkAreas.map((wa) => (
            <WorkAreaShiftCard
              key={wa.id}
              wa={wa}
              stations={stations}
              assignments={assignments}
              workAreaShifts={workAreaShifts}
              activeEmployees={activeEmployees}
              statuses={statuses}
              unavailableCodes={unavailableCodes}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
