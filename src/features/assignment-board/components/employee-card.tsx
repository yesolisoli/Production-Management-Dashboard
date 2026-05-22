"use client";

import React from "react";
import type { Employee } from "../types";
import type { ModeCode, ShiftCode } from "../types";

export function EmployeeCard({ employee, stationId, shiftCode, modeCode, onRemove, loanInfo, onDoubleClick, statusCode }: {
  employee: Employee;
  stationId: string;
  shiftCode: ShiftCode;
  modeCode: ModeCode;
  onRemove: () => void;
  loanInfo?: { isLoanedIn: boolean; homeWaName?: string };
  onDoubleClick?: () => void;
  statusCode?: string;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify({
      employeeId: employee.id,
      fromStationId: stationId,
      fromShiftCode: shiftCode,
      fromModeCode: modeCode,
    }));
    const ghost = document.createElement("div");
    ghost.textContent = employee.full_name;
    Object.assign(ghost.style, {
      position: "fixed", top: "-200px", left: "-200px",
      background: "white", padding: "6px 12px", borderRadius: "6px",
      fontSize: "13px", fontWeight: "600", color: "#475569",
      boxShadow: "0 4px 14px rgba(0,0,0,0.18)", border: "1px solid #e2e8f0",
      whiteSpace: "nowrap", pointerEvents: "none",
    });
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const isInjured = statusCode === "injured";

  const statusAccentColor: Record<string, string> = {
    injured:  "#fb923c",
    training: "#a78bfa",
  };
  const loanAccent = "#60a5fa";
  const isLoaned = loanInfo?.isLoanedIn ?? false;

  const nonDefaults: string[] = [];
  if (statusCode && statusAccentColor[statusCode]) nonDefaults.push(statusAccentColor[statusCode]);
  if (isLoaned) nonDefaults.push(loanAccent);

  const barStyle =
    nonDefaults.length === 0 ? { backgroundColor: "#4ade80" } :
    nonDefaults.length === 1 ? { backgroundColor: nonDefaults[0] } :
    { background: `linear-gradient(to bottom, ${nonDefaults[0]} 50%, ${nonDefaults[1]} 50%)` };

  type SubtitlePart = string | { dot: string; label: string };
  const subtitleParts: SubtitlePart[] = [
    isInjured ? "Injured" : null,
    employee.temporary ? "Temporary" : null,
    loanInfo?.isLoanedIn && loanInfo.homeWaName ? `from ${loanInfo.homeWaName}` : null,
  ].filter((x): x is string => x !== null);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={onDoubleClick}
      className="group/empcard relative flex cursor-grab flex-col rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm active:cursor-grabbing overflow-hidden"
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={barStyle}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-bold text-slate-700 truncate">{employee.full_name}</p>
        </div>
        <button onClick={onRemove} className="invisible shrink-0 rounded px-1 text-xs text-slate-400 transition-colors group-hover/empcard:visible hover:bg-slate-100 hover:text-slate-700">
          ×
        </button>
      </div>
      {subtitleParts.length > 0 && (
        <p className="flex items-center gap-1 text-[11px] text-slate-400">
          {subtitleParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span>·</span>}
              {typeof part === "string" ? part : (
                <span className="flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: part.dot }} />
                  {part.label}
                </span>
              )}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
