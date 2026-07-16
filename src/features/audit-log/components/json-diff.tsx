"use client";

import clsx from "clsx";
import { FIELD_LABELS, SUBFIELD_LABELS } from "../types";

// Minimal pretty-printed-JSON renderer with per-leaf change highlighting.
// This is intentionally NOT a full diff engine: it prints one side's row
// image and highlights each line whose value differs from the matching
// line on the other side. Arrays are compared by index (a good-enough
// heuristic for the audited rows), and highlighting is only meaningful when
// both sides exist — insert/delete render plain (see enableDiff in the panel).

type Line = { text: string; changed: boolean };

// Sentinel for "no corresponding value on the other side" (added/removed key).
const MISSING = Symbol("missing");

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function kindOf(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v;
}

// Deep structural equality for JSON values.
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (kindOf(a) !== kindOf(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => jsonEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    return (
      ak.length === bk.length &&
      ak.every((k) => k in b && jsonEqual(a[k], b[k]))
    );
  }
  return false;
}

const indent = (depth: number) => "  ".repeat(depth);

// System-managed columns whose value tracks the write itself rather than any
// meaningful edit (e.g. updated_at bumps on every update). Never highlighted —
// the change carries no information the user needs to see.
const NOISE_KEYS = new Set(["updated_at"]);

// Emit indented lines for `value`, comparing each node against `other`
// (the value at the same path on the other side, or MISSING). `forced` marks
// a whole subtree as changed once an ancestor has no counterpart. `suppressed`
// silences highlighting for a noise subtree regardless of the actual diff.
function emit(
  value: unknown,
  other: unknown,
  keyPrefix: string,
  trailing: string,
  depth: number,
  forced: boolean,
  lines: Line[],
  suppressed = false,
): void {
  const wholeChanged =
    !suppressed &&
    (forced || other === MISSING || kindOf(value) !== kindOf(other));

  if (isPlainObject(value)) {
    lines.push({ text: indent(depth) + keyPrefix + "{", changed: wholeChanged });
    const keys = Object.keys(value);
    keys.forEach((k, i) => {
      const childOther =
        !wholeChanged && isPlainObject(other) && k in other
          ? other[k]
          : MISSING;
      emit(
        value[k],
        childOther,
        `${JSON.stringify(k)}: `,
        i < keys.length - 1 ? "," : "",
        depth + 1,
        wholeChanged,
        lines,
        suppressed || NOISE_KEYS.has(k),
      );
    });
    lines.push({ text: indent(depth) + "}" + trailing, changed: wholeChanged });
    return;
  }

  if (Array.isArray(value)) {
    lines.push({ text: indent(depth) + keyPrefix + "[", changed: wholeChanged });
    value.forEach((item, i) => {
      const childOther =
        !wholeChanged && Array.isArray(other) && i < other.length
          ? other[i]
          : MISSING;
      emit(
        item,
        childOther,
        "",
        i < value.length - 1 ? "," : "",
        depth + 1,
        wholeChanged,
        lines,
        suppressed,
      );
    });
    lines.push({ text: indent(depth) + "]" + trailing, changed: wholeChanged });
    return;
  }

  const changed = !suppressed && (wholeChanged || !jsonEqual(value, other));
  lines.push({
    text: indent(depth) + keyPrefix + JSON.stringify(value) + trailing,
    changed,
  });
}

// One line of the plain-language summary. A "scalar" row shows an old → new
// value pair; a "note" row is a short phrase for changes we don't spell out
// value-by-value (array columns, or a nested value too deep to unfold).
type SummaryRow =
  | { kind: "scalar"; label: string; from: unknown; to: unknown }
  | { kind: "note"; label: string; text: string };

function isNested(v: unknown): boolean {
  return isPlainObject(v) || Array.isArray(v);
}

const subLabel = (key: string) => SUBFIELD_LABELS[key] ?? key;

// Human phrase for an array column change (e.g. farm_records): describe it by
// row count rather than unfolding every row (that detail lives in the JSON
// panel). MISSING/non-array sides count as empty.
function arrayNote(from: unknown, to: unknown): string {
  const a = Array.isArray(from) ? from.length : 0;
  const b = Array.isArray(to) ? to.length : 0;
  if (b > a) return `${b - a} added (${b} total)`;
  if (a > b) return `${a - b} removed (${b} total)`;
  return "edited";
}

// Unfold a changed nested object one level (e.g. next_day, hog_counts): emit a
// row per changed sub-key, labelled "Parent › Sub". A sub-value that is itself
// nested falls back to a note rather than recursing further.
function unfoldObject(
  label: string,
  from: unknown,
  to: unknown,
  rows: SummaryRow[],
): void {
  const a = isPlainObject(from) ? from : {};
  const b = isPlainObject(to) ? to : {};
  const keys = [
    ...Object.keys(a),
    ...Object.keys(b).filter((k) => !(k in a)),
  ];
  for (const k of keys) {
    const fv = k in a ? a[k] : MISSING;
    const tv = k in b ? b[k] : MISSING;
    if (!(fv === MISSING || tv === MISSING || !jsonEqual(fv, tv))) continue;
    const rowLabel = `${label} › ${subLabel(k)}`;
    if (Array.isArray(fv) || Array.isArray(tv)) {
      rows.push({ kind: "note", label: rowLabel, text: arrayNote(fv, tv) });
    } else if (isNested(fv) || isNested(tv)) {
      rows.push({ kind: "note", label: rowLabel, text: "updated" });
    } else {
      rows.push({ kind: "scalar", label: rowLabel, from: fv, to: tv });
    }
  }
}

// Changed columns for one update, in human terms. Only columns present in
// FIELD_LABELS[tableName] are considered, which filters out audit/system
// noise and fixes the display order to the dictionary's order. Nested object
// columns are unfolded one level; array columns are summarised by count.
function summarizeChanges(
  tableName: string,
  oldData: unknown,
  newData: unknown,
): SummaryRow[] {
  if (!isPlainObject(oldData) || !isPlainObject(newData)) return [];
  const labels = FIELD_LABELS[tableName];
  if (!labels) return [];
  const rows: SummaryRow[] = [];
  for (const [col, label] of Object.entries(labels)) {
    const from = col in oldData ? oldData[col] : MISSING;
    const to = col in newData ? newData[col] : MISSING;
    if (!(from === MISSING || to === MISSING || !jsonEqual(from, to))) continue;
    if (Array.isArray(from) || Array.isArray(to)) {
      rows.push({ kind: "note", label, text: arrayNote(from, to) });
    } else if (isPlainObject(from) || isPlainObject(to)) {
      unfoldObject(label, from, to, rows);
    } else {
      rows.push({ kind: "scalar", label, from, to });
    }
  }
  return rows;
}

// Render a scalar jsonb value in plain text for the summary. Long strings
// (e.g. notes) are clipped so a row stays one glance wide.
function formatValue(v: unknown): string {
  if (v === MISSING) return "—";
  if (v === null) return "empty";
  if (typeof v === "string") {
    if (v === "") return "empty";
    return v.length > 48 ? `${v.slice(0, 48)}…` : v;
  }
  return String(v);
}

// Plain-language "what changed" list for an update: one line per changed
// field, using human labels (see FIELD_LABELS) rather than raw column names,
// so it reads differently from the raw JSON panels below. Rendered only
// inside the expanded details, so the diff work happens lazily on expand.
// Returns null when no labelled field changed.
export function ChangeSummary({
  tableName,
  page,
  oldData,
  newData,
}: {
  tableName: string;
  // The app page this record is edited on, shown under the heading. Optional
  // so the summary still renders for tables without a page mapping.
  page?: string;
  oldData: unknown;
  newData: unknown;
}) {
  const rows = summarizeChanges(tableName, oldData, newData);
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        What changed
      </p>
      {page && (
        <p className="mb-1.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Page: </span>
          {page}
        </p>
      )}
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-700">{r.label}</span>
            {r.kind === "note" ? (
              <span className="text-slate-500">{r.text}</span>
            ) : (
              <>
                <span className="rounded bg-rose-100 px-1.5 text-rose-900">
                  {formatValue(r.from)}
                </span>
                <span className="text-slate-400">→</span>
                <span className="rounded bg-emerald-100 px-1.5 text-emerald-900">
                  {formatValue(r.to)}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// One raw jsonb panel (old_data / new_data). When `other` is provided the
// changed leaves are highlighted in `tone`; otherwise the JSON renders plain.
export function JsonPanel({
  label,
  value,
  other,
  tone,
}: {
  label: string;
  value: unknown;
  // The matching side, or undefined to disable highlighting (insert/delete).
  other?: unknown;
  tone: "old" | "new";
}) {
  const lines: Line[] = [];
  if (value != null) {
    if (other === undefined) {
      // Highlighting disabled (insert/delete): render plain, nothing marked.
      for (const text of JSON.stringify(value, null, 2).split("\n")) {
        lines.push({ text, changed: false });
      }
    } else {
      emit(value, other, "", "", 0, false, lines);
    }
  }

  const highlight =
    tone === "old"
      ? "bg-rose-100 text-rose-900"
      : "bg-emerald-100 text-emerald-900";

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        {value == null
          ? "—"
          : lines.map((line, i) => (
              <div
                key={i}
                className={clsx(
                  "-mx-1 rounded px-1",
                  line.changed && highlight,
                )}
              >
                {line.text}
              </div>
            ))}
      </pre>
    </div>
  );
}
