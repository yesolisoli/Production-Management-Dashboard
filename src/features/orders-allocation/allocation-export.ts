// Excel export for the daily allocation-sheet instructions. Reproduces the paper
// "Daily Allocation Sheet" the floor already uses: a date title row, then product
// groups down the left (one pale-blue cell vertically merged across the group),
// with Qty / Instruction / Customer columns. Each instruction row is tinted by
// rule type — yellow = DO THIS, red = DO NOT, white = STANDARD. Presentation-only;
// reads the persisted instructions, never mutates them.

import writeXlsxFile, {
  type Row as XlsxRow,
  type Cell as XlsxCell,
} from "write-excel-file/browser";
import {
  productLabel,
  sortProductKeys,
  unitShort,
  type AllocationInstruction,
  type Priority,
  type Unit,
} from "./types";

// DO NOT first, then DO THIS, then STANDARD — same order as the printed sheet.
const PRIORITY_RANK: Record<Priority, number> = {
  dont: 0,
  do: 1,
  standard: 2,
};

// Per-row tint by rule type — the saturated paper-sheet palette (not the softer
// on-screen tints): yellow = DO THIS, red = DO NOT, no fill = STANDARD.
const PRIORITY_FILL: Record<Priority, string | undefined> = {
  dont: "#E9A28E", // salmon red
  do: "#FFF275", // highlighter yellow
  standard: undefined, // white
};

const PRODUCT_FILL = "#C9DCE2"; // pale blue — the product / area column
const BORDER = { borderColor: "#808080", borderStyle: "thin" } as const;

// Every cell carries the thin grid border; spread the shared props in.
function cell(extra: Partial<XlsxCell> & { value?: string | number }): XlsxCell {
  return { ...BORDER, ...extra } as XlsxCell;
}

function titleCell(value: string): XlsxCell {
  return cell({
    type: String,
    value,
    fontWeight: "bold",
    fontSize: 13,
    align: "center",
    columnSpan: 4,
  });
}

function headerCell(value: string): XlsxCell {
  return cell({
    type: String,
    value,
    fontWeight: "bold",
    align: "center",
    backgroundColor: "#0F172A",
    textColor: "#FFFFFF",
  });
}

function productCell(value: string, rowSpan: number): XlsxCell {
  return cell({
    type: String,
    value,
    backgroundColor: PRODUCT_FILL,
    alignVertical: "top",
    rowSpan,
  });
}

function qtyCell(
  qty: number,
  unit: Unit,
  fill: string | undefined,
): XlsxCell {
  return cell({
    type: String,
    value: qty > 0 ? `${qty} ${unitShort(unit)}` : "",
    align: "center",
    backgroundColor: fill,
  });
}

function textCell(value: string, fill: string | undefined): XlsxCell {
  return cell({ type: String, value, backgroundColor: fill });
}

// "2026-06-17" → "6/17/2026" (the format the paper sheet uses in its title row).
function formatSheetDate(date: string): string {
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${Number(m)}/${Number(d)}/${y}`;
}

// Build the sheet rows (date title + product-grouped instruction lines) and the
// column widths.
function buildSheet(
  rows: AllocationInstruction[],
  date: string,
): { data: XlsxRow[]; columns: { width: number }[] } {
  // Title row — the date, merged across all four columns — then column headers.
  const data: XlsxRow[] = [
    [titleCell(formatSheetDate(date)), null, null, null],
    [
      headerCell("Product / Area"),
      headerCell("Qty"),
      headerCell("Instruction"),
      headerCell("Customer / Context"),
    ],
  ];

  const categories = sortProductKeys([...new Set(rows.map((r) => r.category))]);
  for (const key of categories) {
    const groupRows = rows
      .filter((r) => r.category === key)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    if (groupRows.length === 0) continue;

    groupRows.forEach((row, i) => {
      const fill = PRIORITY_FILL[row.priority];
      // The product / area cell is written once on the group's first row and
      // vertically merged (rowSpan) down the rest; later rows leave it null.
      const productSlot =
        i === 0 ? productCell(productLabel(key), groupRows.length) : null;
      data.push([
        productSlot,
        qtyCell(row.qty, row.unit, fill),
        textCell(row.instruction, fill),
        textCell(row.customer, fill),
      ]);
    });
  }

  return {
    data,
    columns: [
      { width: 16 }, // Product / Area
      { width: 12 }, // Qty
      { width: 50 }, // Instruction
      { width: 26 }, // Customer / Context
    ],
  };
}

function fileName(date: string): string {
  return `allocation_instructions_${date}.xlsx`;
}

// Build the .xlsx workbook handle (exposes toFile / toBlob).
function buildWorkbook(rows: AllocationInstruction[], date: string) {
  const { data, columns } = buildSheet(rows, date);
  return writeXlsxFile(data, { columns });
}

// Download the day's allocation instructions as an .xlsx file.
export async function exportAllocationInstructions(
  rows: AllocationInstruction[],
  date: string,
): Promise<void> {
  await buildWorkbook(rows, date).toFile(fileName(date));
}

// Email the day's allocation sheet: download the .xlsx, then open the computer's
// default mail app (via a mailto: link) with the subject / body pre-filled. A
// mailto: link can't carry an attachment, so the operator attaches the
// just-downloaded file in the compose window.
export async function emailAllocationInstructions(
  rows: AllocationInstruction[],
  date: string,
): Promise<void> {
  const pretty = formatSheetDate(date);
  const subject = `Daily Allocation Sheet — ${pretty}`;
  const body = [
    `Daily allocation sheet for ${pretty} is attached.`,
    "",
    `Please attach the downloaded file: ${fileName(date)}`,
  ].join("\n");
  const mailtoUrl =
    "mailto:?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body);

  // Download the file first so it's ready to attach, then hand off to the
  // default mail client.
  await buildWorkbook(rows, date).toFile(fileName(date));
  window.location.href = mailtoUrl;
}
