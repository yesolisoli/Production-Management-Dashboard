"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import { StatusBadge, COLOR_OPTIONS, type StatusConfig } from "../status-select";

export function ManageStatusesModal({
  configs,
  onUpdate,
  onDelete,
  onAdd,
  onReorder,
  onClose,
}: {
  configs: StatusConfig[];
  onUpdate: (code: string, updates: Partial<StatusConfig>) => void;
  onDelete: (code: string) => void;
  onAdd: (label: string, colorHex: string) => void;
  onReorder: (newConfigs: StatusConfig[]) => void;
  onClose: () => void;
}) {
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newColorHex, setNewColorHex] = useState("#a5b4fc");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const longestLabel = configs.reduce((m, c) => (c.label.length > m.length ? c.label : m), "");

  const startEdit = (cfg: StatusConfig) => {
    setEditingCode(cfg.code);
    setEditingLabel(cfg.label);
    setColorPickerFor(null);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const next = [...configs];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      onReorder(next);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <Modal
      title="Employee Status Types"
      onClose={onClose}
      zIndex="z-[60]"
      width="w-[28rem] max-w-[calc(100vw-2rem)]"
      footer={
        <div className="flex items-center gap-2">
          <label className="relative shrink-0 cursor-pointer" title="Pick color">
            <span className="block h-8 w-8 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: newColorHex }} />
            <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) { onAdd(newLabel.trim(), newColorHex); setNewLabel(""); } }}
            placeholder="New status name..."
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <button
            onClick={() => { if (newLabel.trim()) { onAdd(newLabel.trim(), newColorHex); setNewLabel(""); } }}
            disabled={!newLabel.trim()}
            className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      }
    >
      <div className="max-h-[28rem] space-y-1.5 overflow-y-auto">
        {configs.map((cfg, idx) => (
          <div
            key={cfg.code}
            className="group"
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragEnter={() => setDropIndex(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            style={{ opacity: dragIndex === idx ? 0.4 : 1 }}
          >
            <div className={`flex items-center gap-3 rounded-lg border border-slate-300 px-2 py-2 hover:bg-slate-50 ${dropIndex === idx && dragIndex !== idx ? "border-t-2 border-blue-400" : ""}`}>
              <span className="shrink-0 cursor-grab text-slate-400 active:cursor-grabbing">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="5" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/>
                  <circle cx="11" cy="4" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
                </svg>
              </span>
              <button
                onClick={() => {
                  if (cfg.protected) return;
                  setColorPickerFor(colorPickerFor === cfg.code ? null : cfg.code);
                  setEditingCode(null);
                }}
                className={`shrink-0 transition-transform hover:scale-105 ${cfg.protected ? "cursor-default" : "cursor-pointer"}`}
                title={cfg.protected ? undefined : "Click to change color"}
              >
                <StatusBadge cfg={cfg} sizingLabel={longestLabel} />
              </button>

              {editingCode === cfg.code ? (
                <input
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingLabel.trim()) {
                      onUpdate(cfg.code, { label: editingLabel.trim() });
                      setEditingCode(null);
                    }
                    if (e.key === "Escape") setEditingCode(null);
                  }}
                  onBlur={() => {
                    if (editingLabel.trim()) onUpdate(cfg.code, { label: editingLabel.trim() });
                    setEditingCode(null);
                  }}
                  className="flex-1 rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-sm text-slate-700">{cfg.label}</span>
              )}

              <div className="flex shrink-0 items-center gap-1">
                {!cfg.protected && editingCode !== cfg.code && (
                  <button
                    onClick={() => startEdit(cfg)}
                    className="rounded p-1 text-slate-600 hover:bg-slate-700 hover:text-white"
                    title="Edit label"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M11 2l3 3-9 9H2v-3L11 2z" />
                    </svg>
                  </button>
                )}
                {!cfg.protected && (
                  <button
                    onClick={() => { onDelete(cfg.code); setColorPickerFor(null); }}
                    className="rounded p-1 text-slate-600 hover:bg-red-500 hover:text-white"
                    title="Delete"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9" />
                    </svg>
                  </button>
                )}
                {cfg.protected && <span className="w-6 shrink-0" />}
              </div>
            </div>

            {colorPickerFor === cfg.code && (
              <div className="mb-1 ml-2 flex flex-wrap gap-2 rounded-lg bg-slate-50 px-3 py-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.colorHex}
                    onClick={() => { onUpdate(cfg.code, { colorHex: c.colorHex }); setColorPickerFor(null); }}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${cfg.colorHex === c.colorHex ? "border-slate-600 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c.colorHex + "28", color: c.colorHex, outline: `2px solid ${c.colorHex}40` }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
