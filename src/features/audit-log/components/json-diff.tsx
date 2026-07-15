"use client";

import clsx from "clsx";

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

// Emit indented lines for `value`, comparing each node against `other`
// (the value at the same path on the other side, or MISSING). `forced` marks
// a whole subtree as changed once an ancestor has no counterpart.
function emit(
  value: unknown,
  other: unknown,
  keyPrefix: string,
  trailing: string,
  depth: number,
  forced: boolean,
  lines: Line[],
): void {
  const wholeChanged =
    forced || other === MISSING || kindOf(value) !== kindOf(other);

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
      );
    });
    lines.push({ text: indent(depth) + "]" + trailing, changed: wholeChanged });
    return;
  }

  const changed = wholeChanged || !jsonEqual(value, other);
  lines.push({
    text: indent(depth) + keyPrefix + JSON.stringify(value) + trailing,
    changed,
  });
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
