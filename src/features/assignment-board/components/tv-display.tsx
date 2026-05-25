"use client";

import React, { useEffect, useRef, useState } from "react";
import { Truck, Package, Settings, Scissors, Archive, Megaphone, LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";
import { DEFAULT_MODE_CODE } from "../types";
import type { Employee, EmployeeStatus, ModeCode, ShiftInfo, Station, StationAssignment, WorkArea, WorkAreaShiftMap } from "../types";
import { abbrevDept, getAssignmentWorkAreaId, getActiveShift, parseTimeMin } from "../utils";
import { TimePickerInput } from "./modals/time-picker-input";
import { getUnavailableStatusCodes, type StatusConfig } from "./status-select";

const DEPT_ICONS: Record<string, React.ReactNode> = {
  "Loading Dock": <Truck size={13} />,
  "Small Pro": <Package size={13} />,
  "Processing Floor": <Settings size={13} />,
  "Meat Cutting": <Scissors size={13} />,
  "Packaging": <Archive size={13} />,
};

function AutoScrollRows({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setInterval(() => {
      if (!el || el.scrollHeight <= el.clientHeight) return;
      if (atBottom.current) {
        el.scrollTo({ top: 0, behavior: "smooth" });
        atBottom.current = false;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        atBottom.current = true;
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto" style={style}>
      {children}
    </div>
  );
}

export type TVSyncStatus = "idle" | "syncing" | "ok" | "error";

export function TVDisplay({
  employees,
  statuses,
  assignments,
  stations,
  workAreas,
  shifts,
  workAreaShifts,
  statusConfigs,
  announcement = "Please clean your work area and report any equipment issues.",
  onClose,
  syncStatus,
  lastSyncedAt,
}: {
  employees: Employee[];
  statuses: Record<string, EmployeeStatus>;
  assignments: StationAssignment[];
  stations: Station[];
  workAreas: WorkArea[];
  shifts: ShiftInfo[];
  workAreaShifts?: WorkAreaShiftMap;
  statusConfigs: StatusConfig[];
  announcement?: string;
  onClose: () => void;
  syncStatus?: TVSyncStatus;
  lastSyncedAt?: Date | null;
}) {
  const unavailableCodes = getUnavailableStatusCodes(statusConfigs);
  const [now, setNow] = useState(new Date());
  const [previewMode, setPreviewMode] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [previewTime, setPreviewTime] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const effectiveDate = (() => {
    if (!previewMode) return now;
    const [h, m] = previewTime.split(":").map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  })();

  const sortedWorkAreas = [...workAreas].sort((a, b) => a.display_order - b.display_order);

  // Shifts are mode-scoped, so the "active mode" depends on which mode has a
  // shift covering the current time. First pass picks the first declared mode
  // whose shift list has an active shift at effectiveDate. If nothing is
  // currently active (e.g. we're between shifts, or before the day starts),
  // fall back to the earliest upcoming shift across all modes so the dept
  // column still renders with its next scheduled shift.
  const nowMin = effectiveDate.getHours() * 60 + effectiveDate.getMinutes();
  const startOf = (s: ShiftInfo): number | null => {
    if (!s.time_range.includes("-")) return null;
    const [a] = s.time_range.split("-").map((p) => p.trim());
    return parseTimeMin(a);
  };
  const waActiveModeCode: Record<string, ModeCode> = {};
  const waActiveShift: Record<string, ShiftInfo | null> = {};
  for (const wa of sortedWorkAreas) {
    const modeCodes: ModeCode[] = wa.mode_views?.length
      ? (wa.mode_views.map((mv) => mv.mode_code) as ModeCode[])
      : [DEFAULT_MODE_CODE];

    let chosenMode: ModeCode = modeCodes[0] ?? DEFAULT_MODE_CODE;
    let chosenShift: ShiftInfo | null = null;
    for (const modeCode of modeCodes) {
      const waShifts = workAreaShifts?.[wa.id]?.[modeCode] ?? shifts;
      const active = getActiveShift(waShifts, effectiveDate);
      if (active) {
        chosenMode = modeCode;
        chosenShift = active;
        break;
      }
    }

    if (!chosenShift) {
      let bestStart = Infinity;
      for (const modeCode of modeCodes) {
        const waShifts = workAreaShifts?.[wa.id]?.[modeCode] ?? [];
        for (const s of waShifts) {
          const start = startOf(s);
          if (start === null) continue;
          if (start >= nowMin && start < bestStart) {
            bestStart = start;
            chosenMode = modeCode;
            chosenShift = s;
          }
        }
      }
    }

    waActiveModeCode[wa.id] = chosenMode;
    waActiveShift[wa.id] = chosenShift;
  }
  const anyWaActive = Object.values(waActiveShift).some((s) => s !== null);

  const activeEmployees = employees.filter((e) => e.active);
  const activeAssignments = assignments.filter((a) => {
    const waId = getAssignmentWorkAreaId(a, stations);
    if (!waId) return false;
    const s = waActiveShift[waId];
    return s ? s.code === a.shift_code : false;
  });

  const loanedOutByWaId: Record<string, Employee[]> = {};
  const loanedInByWaId: Record<string, { emp: Employee; homeWaId: string | null }[]> = {};

  for (const wa of workAreas) {
    loanedOutByWaId[wa.id] = [];
    loanedInByWaId[wa.id] = [];
  }

  for (const asgn of activeAssignments) {
    const emp = activeEmployees.find((e) => e.id === asgn.employee_id);
    if (!emp) continue;
    const homeWaId = emp.homeDepartmentId;
    const activeWaId = getAssignmentWorkAreaId(asgn, stations);
    if (!activeWaId || activeWaId === homeWaId) continue;
    const currentModeForWa = waActiveModeCode[activeWaId] ?? DEFAULT_MODE_CODE;
    if (asgn.mode_code !== currentModeForWa) continue;
    if (!loanedInByWaId[activeWaId]) continue;
    if (!loanedInByWaId[activeWaId].some((x) => x.emp.id === emp.id)) {
      loanedInByWaId[activeWaId].push({ emp, homeWaId });
    }
    if (homeWaId && loanedOutByWaId[homeWaId] && !loanedOutByWaId[homeWaId].some((e) => e.id === emp.id)) {
      loanedOutByWaId[homeWaId].push(emp);
    }
  }

  const effectiveMin = effectiveDate.getHours() * 60 + effectiveDate.getMinutes();

  // Per work area, if the current time falls inside the hog_break mode_view
  // time window, compute remaining minutes and the after_hog_break start.
  const getHogBreakStatus = (wa: WorkArea): { remainingMin: number; resumeAt: string | null } | null => {
    const hogBreak = wa.mode_views?.find((mv) => mv.mode_code === "hog_break");
    if (!hogBreak?.time_range) return null;
    const parts = hogBreak.time_range.split("-").map((s) => s.trim());
    if (parts.length !== 2) return null;
    const startMin = parseTimeMin(parts[0]);
    const endMin = parseTimeMin(parts[1]);
    if (effectiveMin < startMin || effectiveMin > endMin) return null;
    const afterHogBreak = wa.mode_views?.find((mv) => mv.mode_code === "after_hog_break");
    let resumeAt: string | null = null;
    if (afterHogBreak?.time_range) {
      const ap = afterHogBreak.time_range.split("-").map((s) => s.trim());
      if (ap.length === 2) resumeAt = ap[0];
    }
    return { remainingMin: Math.max(0, endMin - effectiveMin), resumeAt };
  };

  const formatRemaining = (min: number): string => {
    if (min < 60) return `${min} min remaining`;
    const hr = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${hr} hr ${m} min remaining` : `${hr} hr remaining`;
  };

  const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-950">
      {/* ── Collapsible header (slides; pushes content) ── */}
      <div
        className={`grid shrink-0 transition-[grid-template-rows] duration-300 ease-out ${headerOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="flex items-center gap-4 bg-slate-900 px-6 py-3 border-b border-white/10">

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            onClick={() => setPreviewMode(false)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${!previewMode ? "bg-green-500 text-white" : "text-slate-400 hover:text-white"}`}
          >
            ● Live
          </button>
          <button
            onClick={() => setPreviewMode(true)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${previewMode ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            Preview
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4">
          {!previewMode ? (
            <div className="flex items-baseline gap-2 text-white">
              <span className="text-2xl font-light tabular-nums tracking-tight leading-none">
                {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).replace(/\s?(AM|PM)$/i, "")}
              </span>
              <span className="text-sm font-normal tracking-wide">
                {now.getHours() >= 12 ? "PM" : "AM"}
              </span>
            </div>
          ) : (
            <>
              <TimePickerInput
                value={previewTime}
                onChange={setPreviewTime}
                triggerClassName="flex items-baseline gap-2 rounded-md px-3 py-1 text-white hover:bg-white/10 focus:outline-none transition-colors"
                renderValue={(v) => {
                  const [hStr, mStr] = v.split(":");
                  const h = Number(hStr);
                  const ampm = h >= 12 ? "PM" : "AM";
                  const h12 = h % 12 === 0 ? 12 : h % 12;
                  return (
                    <>
                      <span className="text-2xl font-light tabular-nums tracking-tight leading-none">
                        {`${String(h12).padStart(2, "0")}:${mStr}`}
                      </span>
                      <span className="text-sm font-normal tracking-wide">{ampm}</span>
                      <ChevronDown size={14} className="self-center text-white/70" />
                    </>
                  );
                }}
              />
              <div className="flex items-center gap-1">
                {["06:00","08:00","10:00","12:00","14:00"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setPreviewTime(t)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      previewTime === t
                        ? "bg-blue-600 text-white"
                        : "bg-white/10 text-slate-300 hover:bg-white/20"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>


        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg border border-white bg-transparent px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            <LayoutGrid size={14} />
            Admin View
          </button>
        </div>
          </div>
        </div>
      </div>

      {/* ── Header toggle tab (overlay; reveals on hover, no flow space) ── */}
      <div className="relative shrink-0">
        <div className="group absolute inset-x-0 top-0 z-30 flex h-6 justify-center">
          <button
            onClick={() => setHeaderOpen((v) => !v)}
            className="flex items-center justify-center rounded-b-md border border-t-0 border-white/10 bg-slate-900 px-3 py-0.5 text-white/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-slate-800 hover:text-white"
            aria-label={headerOpen ? "Collapse header" : "Expand header"}
          >
            {headerOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* ── Content: department columns ── */}
      <div className="flex min-h-0 flex-1 overflow-x-auto">
        {!anyWaActive ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-lg font-semibold text-slate-500">No active shift at this time</p>
          </div>
        ) : sortedWorkAreas.flatMap((wa) => {
          const activeModeCode = waActiveModeCode[wa.id] ?? DEFAULT_MODE_CODE;
          const waStations = stations
            .filter((s) => s.work_area_id === wa.id && (s.mode_code === activeModeCode || s.mode_code == null))
            .sort((a, b) => a.display_order - b.display_order);

          if (waStations.length === 0) return [];
          const waShift = waActiveShift[wa.id];
          if (!waShift) return [];

          return [(
            <div key={wa.id} className="flex min-w-[180px] flex-1 flex-col border-r border-slate-800 last:border-r-0">
              <div
                className="shrink-0 flex h-24 flex-col items-center justify-center gap-1 px-3"
                style={{ backgroundColor: wa.color_hex ?? "#1e293b" }}
              >
                <div className="flex h-5 items-center justify-center gap-2">
                  <span className="text-white/80 shrink-0">{DEPT_ICONS[wa.name] ?? <Package size={13} />}</span>
                  <span className="text-base font-bold uppercase tracking-widest text-white truncate">{wa.name}</span>
                </div>
                {waShift.time_range && (
                  <div className="flex h-5 items-center justify-center">
                    <span className="text-sm font-normal tracking-wide text-white/80">
                      {waShift.time_range.replace("-", " – ")}
                    </span>
                  </div>
                )}
                {(loanedInByWaId[wa.id]?.length > 0 || loanedOutByWaId[wa.id]?.length > 0) && (
                  <div className="flex h-5 items-center justify-center gap-3">
                    {loanedInByWaId[wa.id]?.length > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80">
                        ↓ {loanedInByWaId[wa.id].length} SUPPORT IN
                      </span>
                    )}
                    {loanedOutByWaId[wa.id]?.length > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        ↑ {loanedOutByWaId[wa.id].length} LOANED OUT
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex h-6 shrink-0 border-b border-slate-800">
                <div className="flex w-[45%] shrink-0 items-center px-3 bg-slate-900">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Station</span>
                </div>
                <div className="flex flex-1 items-center bg-slate-900 px-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Employee</span>
                </div>
              </div>

              <AutoScrollRows style={{ background: "#0b1220" }}>
                {waStations.map((station) => {
                  const stationAsgns = assignments.filter(
                    (a) => a.shift_code === waShift.code && a.station_id === station.id && a.mode_code === activeModeCode
                  );
                  const assignedEmps = stationAsgns
                    .map((a) => ({ asgn: a, emp: activeEmployees.find((e) => e.id === a.employee_id) }))
                    .filter((x): x is { asgn: typeof x.asgn; emp: NonNullable<typeof x.emp> } => !!x.emp);

                  return (
                    <div
                      key={station.id}
                      className="flex items-stretch border-b border-slate-800 last:border-b-0"
                    >
                      <div className="flex w-[45%] shrink-0 flex-col justify-start px-3 py-2">
                        <span className="truncate text-xs text-slate-300">{station.name}</span>
                        {assignedEmps.length > 1 && (
                          <span className="text-[10px] text-slate-500">{assignedEmps.length} people</span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        {assignedEmps.length === 0 ? (
                          <span className="flex items-center gap-1.5 px-3 py-2">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                            <span className="text-xs font-semibold text-red-400">Unassigned</span>
                          </span>
                        ) : (
                          assignedEmps.map(({ asgn, emp }) => {
                            const isUnavailableEmp = unavailableCodes.has(statuses[emp.id] ?? "");
                            const asgnWaId = getAssignmentWorkAreaId(asgn, stations);
                            const isLoanedIn = !!asgnWaId && asgnWaId !== emp.homeDepartmentId;
                            const isInjured = statuses[emp.id] === "injured";
                            const dotColor = isUnavailableEmp
                              ? "bg-red-500"
                              : isInjured
                              ? "bg-orange-400"
                              : emp.temporary
                              ? "bg-violet-400"
                              : "bg-green-500";
                            return (
                              <span key={emp.id} className="flex items-center gap-1.5 px-3 py-2">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                                {!isUnavailableEmp ? (
                                  <>
                                    <span className="truncate text-xs font-semibold text-slate-100">{emp.full_name}</span>
                                    <span className="ml-auto flex shrink-0 items-center gap-1">
                                      {isLoanedIn && emp.homeDepartmentId && (
                                        <span className="rounded border border-blue-400/30 bg-blue-500/15 px-1 py-px text-[9px] text-blue-300">
                                          {abbrevDept(workAreas.find((w) => w.id === emp.homeDepartmentId)?.name ?? emp.homeDepartmentId)}
                                        </span>
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs font-semibold text-red-400">Unassigned</span>
                                )}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </AutoScrollRows>
            </div>
          )];
        })}
      </div>

      {/* ── Hog Break banner (global, just above footer) ── */}
      {(() => {
        const hogBreakWa = sortedWorkAreas.find((wa) => getHogBreakStatus(wa));
        const status = hogBreakWa ? getHogBreakStatus(hogBreakWa) : null;
        if (!status) return null;
        return (
          <div className="flex shrink-0 items-center justify-center gap-2 bg-linear-to-r from-indigo-950/90 via-indigo-700/70 to-indigo-950/90 px-6 py-1 text-xs font-semibold text-indigo-100">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
            <span className="tracking-wide">
              HOG BREAK · {formatRemaining(status.remainingMin)}
              {status.resumeAt ? ` · resumes ${status.resumeAt}` : ""}
            </span>
          </div>
        );
      })()}

      {/* ── Footer ── */}
      <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-slate-900 px-6 py-7">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Megaphone size={13} className="text-blue-400 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Announcement</span>
          </div>
          <span className="text-xl text-slate-300">{announcement}</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-400 shrink-0">
          {syncStatus !== undefined && (() => {
            const syncedSecAgo = lastSyncedAt
              ? Math.max(0, Math.floor((now.getTime() - lastSyncedAt.getTime()) / 1000))
              : null;
            const isStale = syncStatus === "ok" && syncedSecAgo !== null && syncedSecAgo > 90;
            const dotClass =
              syncStatus === "error"
                ? "bg-red-500"
                : syncStatus === "syncing"
                ? "bg-amber-400 animate-pulse"
                : isStale
                ? "bg-amber-400"
                : syncStatus === "ok"
                ? "bg-green-500"
                : "bg-slate-500";
            const label =
              syncStatus === "error"
                ? lastSyncedAt
                  ? `Sync failed · last ${fmt(lastSyncedAt)}`
                  : "Sync failed"
                : syncStatus === "syncing"
                ? "Syncing…"
                : isStale && lastSyncedAt
                ? `Stale · last ${fmt(lastSyncedAt)}`
                : syncStatus === "ok" && lastSyncedAt
                ? `Synced ${fmt(lastSyncedAt)}`
                : "Waiting for sync";
            return (
              <span className="flex items-center gap-2" title={label}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                <span className="text-xs">{label}</span>
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
