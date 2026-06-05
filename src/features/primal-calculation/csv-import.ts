// -------------------------------------------------------------------
// CSV import for primal production orders (SAP export → orders map).
//
// Pure, framework-free parsing: takes raw CSV text and returns the
// parsed orders ready to merge plus a per-row preview so the UI can show
// what will be applied before committing. No I/O, no state — the hook
// owns merging the result into the orders map.
//
// Expected shape — one row per SKU, header-driven (column order free):
//   sku,today_cases
//   10005,10
//
// Only today's RAW case input is read from the file; the paired today_pcs
// is derived from each product's case pack, exactly like manual entry.
// Tomorrow / overstock are no longer entered per SKU — O/S is calculated.
// Older templates with extra columns still import (extras are ignored).
// -------------------------------------------------------------------

import { casesToPieces, clampNonNegativeInt } from "./calculations";
import { PRODUCT_SPEC_BY_SKU, PRODUCT_SPECS } from "./product-specs";
import { emptyProductOrder, type ProductOrder, type ProductOrdersForDate } from "./types";

// Header written by the template and recognized on import. The `name`
// column is for human reference only — the parser maps rows by SKU and
// ignores it.
export const CSV_TEMPLATE_HEADER = "sku,name,today_cases";

// Build a ready-to-fill template listing every catalog product with zero
// quantities, in catalog (category) order. Operators fill the today_cases
// column and re-import. Names are quoted since they can't contain commas
// today, but quoting keeps it safe if that ever changes.
export function buildOrdersCsvTemplate(): string {
  const rows = PRODUCT_SPECS.map((spec) => `${spec.sku},"${spec.name}",0`);
  return [CSV_TEMPLATE_HEADER, ...rows].join("\r\n") + "\r\n";
}

// Accepted header aliases for each logical column. Matching is done on a
// normalized header (lowercased, non-alphanumerics stripped).
const COLUMN_ALIASES: Record<string, readonly string[]> = {
  sku: ["sku", "material", "materialno", "item", "itemno", "productcode"],
  today_cases: ["todaycases", "today", "todaycase", "todayqty"],
};

type RowStatus = "ok" | "unknown-sku" | "invalid";

export type CsvImportRow = {
  rowNumber: number; // 1-based source line (excluding header)
  sku: string;
  name?: string;
  status: RowStatus;
  order?: ProductOrder;
  message?: string;
};

export type CsvImportResult = {
  // Valid orders keyed by SKU, ready to merge into a date's orders map.
  orders: ProductOrdersForDate;
  // Per-row preview, in source order — drives the confirmation table.
  rows: CsvImportRow[];
  matched: number; // rows that mapped to a known SKU
  skipped: number; // rows dropped (unknown SKU or unparseable)
  // File-level errors that prevented any import (empty file, no SKU column).
  errors: string[];
};

function normalizeHeader(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Split one CSV line into fields, honoring double-quoted values that may
// contain commas or escaped ("") quotes. Good enough for SAP exports.
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

// Resolve which file column index feeds each logical field. Returns null
// for the required SKU column if no alias matched.
function mapColumns(header: string[]): {
  sku: number | null;
  today_cases: number | null;
} {
  const normalized = header.map(normalizeHeader);
  const find = (key: keyof typeof COLUMN_ALIASES) => {
    const idx = normalized.findIndex((h) => COLUMN_ALIASES[key].includes(h));
    return idx === -1 ? null : idx;
  };
  return {
    sku: find("sku"),
    today_cases: find("today_cases"),
  };
}

// Parse a numeric cell tolerantly: blanks become 0; thousands separators
// and stray quotes are stripped before clamping to a non-negative int.
function parseQty(cell: string | undefined): number {
  if (!cell) return 0;
  const cleaned = cell.replace(/[",]/g, "");
  if (cleaned === "") return 0;
  return clampNonNegativeInt(Number(cleaned));
}

export function parsePrimalOrdersCsv(text: string): CsvImportResult {
  const empty: CsvImportResult = {
    orders: {},
    rows: [],
    matched: 0,
    skipped: 0,
    errors: [],
  };

  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { ...empty, errors: ["The file is empty."] };
  }

  const header = splitCsvLine(lines[0]);
  const cols = mapColumns(header);

  if (cols.sku === null) {
    return {
      ...empty,
      errors: [
        'No SKU column found. The header must include a "sku" (or "material") column.',
      ],
    };
  }
  if (cols.today_cases === null) {
    return {
      ...empty,
      errors: ['No quantity column found. Include a "today_cases" column.'],
    };
  }

  const orders: ProductOrdersForDate = {};
  const rows: CsvImportRow[] = [];
  let matched = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const sku = (fields[cols.sku] ?? "").trim();
    const rowNumber = i;

    if (sku === "") {
      skipped++;
      rows.push({
        rowNumber,
        sku: "",
        status: "invalid",
        message: "Missing SKU — row skipped.",
      });
      continue;
    }

    const spec = PRODUCT_SPEC_BY_SKU[sku];
    if (!spec) {
      skipped++;
      rows.push({
        rowNumber,
        sku,
        status: "unknown-sku",
        message: "SKU not in product catalog — row skipped.",
      });
      continue;
    }

    const today_cases =
      cols.today_cases === null ? 0 : parseQty(fields[cols.today_cases]);

    const order: ProductOrder = {
      ...emptyProductOrder(),
      today_cases,
      today_pcs: casesToPieces(spec, today_cases),
    };

    // Last row wins on duplicate SKUs; flag it so the operator notices.
    const duplicate = seen.has(sku);
    seen.add(sku);
    orders[sku] = order;
    matched++;
    rows.push({
      rowNumber,
      sku,
      name: spec.name,
      status: "ok",
      order,
      message: duplicate ? "Duplicate SKU — later row overrides earlier." : undefined,
    });
  }

  return { orders, rows, matched, skipped, errors: [] };
}
