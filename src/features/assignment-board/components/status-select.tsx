"use client";

import { useRef, useState } from "react";
import { BaseDropdown, DROPDOWN_WIDTH } from "./base-dropdown";

export const STATUS_CODE_AVAILABLE = "available" as const;

export type StatusConfig = {
  code: string;
  label: string;
  className: string;
  colorHex?: string;
  protected?: boolean;
  /** When true, employee is excluded from assignment eligibility */
  unavailable?: boolean;
};

export function getUnavailableStatusCodes(configs: StatusConfig[]): Set<string> {
  return new Set(configs.filter((c) => c.unavailable).map((c) => c.code));
}

export function cfgBadge(cfg: StatusConfig): { cls: string; sty?: React.CSSProperties } {
  if (cfg.colorHex) {
    return {
      cls: "rounded-md px-2.5 py-1 text-xs font-semibold",
      sty: { backgroundColor: cfg.colorHex + "28", color: cfg.colorHex },
    };
  }
  return { cls: `rounded-md px-2.5 py-1 text-xs font-semibold ${cfg.className}` };
}

export function StatusBadge({ cfg, sizingLabel, showArrow = false, className = "" }: { cfg: StatusConfig; sizingLabel?: string; showArrow?: boolean; className?: string }) {
  const badge = cfgBadge(cfg);
  const widthLabel = sizingLabel ?? cfg.label;
  return (
    <span className={`inline-grid items-center ${badge.cls} ${className}`} style={badge.sty}>
      <span className="invisible col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap" aria-hidden="true">
        {widthLabel}
        {showArrow && (
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
        )}
      </span>
      <span className={`col-start-1 row-start-1 inline-flex w-full items-center gap-1 ${showArrow ? "justify-between" : "justify-center"}`}>
        <span>{cfg.label}</span>
        {showArrow && (
          <svg className="h-3 w-3 shrink-0 opacity-50" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
        )}
      </span>
    </span>
  );
}

export const COLOR_OPTIONS: { label: string; colorHex: string }[] = [
  { label: "Green",  colorHex: "#15803d" },
  { label: "Blue",   colorHex: "#1d4ed8" },
  { label: "Slate",  colorHex: "#64748b" },
  { label: "Red",    colorHex: "#dc2626" },
  { label: "Yellow", colorHex: "#a16207" },
  { label: "Orange", colorHex: "#c2410c" },
  { label: "Purple", colorHex: "#7e22ce" },
  { label: "Gray",   colorHex: "#475569" },
  { label: "Teal",   colorHex: "#0f766e" },
  { label: "Pink",   colorHex: "#be185d" },
];

export const DEFAULT_STATUS_CONFIGS: StatusConfig[] = [
  { code: "available",  label: "Available",  className: "bg-emerald-50 text-emerald-600",  colorHex: "#059669", protected: true },
  { code: "sick",       label: "Sick",       className: "bg-rose-50 text-rose-500",        colorHex: "#f43f5e", unavailable: true },
  { code: "vacation",   label: "Vacation",   className: "bg-amber-50 text-amber-500",      colorHex: "#f59e0b", unavailable: true },
  { code: "injured",    label: "Injured",    className: "bg-orange-50 text-orange-400",    colorHex: "#fb923c" },
  { code: "training",   label: "Training",   className: "bg-violet-50 text-violet-400",    colorHex: "#a78bfa" },
  { code: "off_shift",  label: "Off Shift",  className: "bg-slate-100 text-slate-400",     colorHex: "#94a3b8", unavailable: true },
];

export function StatusSelect({ value, configs, onChange, onManageStatuses }: {
  value: string;
  configs: StatusConfig[];
  onChange: (status: string) => void;
  onManageStatuses?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = configs.find((c) => c.code === value) ?? configs[0];
  const longestLabel = configs.reduce((m, c) => (c.label.length > m.length ? c.label : m), "");

  if (!current) return null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
      >
        <StatusBadge cfg={current} sizingLabel={longestLabel} showArrow />
      </button>
      <BaseDropdown
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        minWidth={DROPDOWN_WIDTH.xsmall}
        offsetY={4}
      >
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
          {onManageStatuses && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onManageStatuses(); }}
              className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Manage statuses"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
              </svg>
            </button>
          )}
        </div>
        <div className="py-1.75">
        {configs.map((cfg) => {
            const active = cfg.code === value;
            return (
              <button
                key={cfg.code}
                onClick={() => { onChange(cfg.code); setOpen(false); }}
                className={`flex w-full items-center justify-center gap-2.5 px-3 py-1.5 transition-colors ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
              >
                <StatusBadge cfg={cfg} sizingLabel={longestLabel} className="shrink-0" />
              </button>
            );
          })}
        </div>
      </BaseDropdown>
    </div>
  );
}
