import type { Employee, WorkArea } from "./types";

export const EMPLOYEE_CSV_HEADERS = [
  "employee_code",
  "full_name",
  "home_department",
  "active",
  "gender",
  "level",
  "temporary",
] as const;

export const EMPLOYEE_CSV_MAX_ROWS = 1000;

export type EmployeeCsvAction = "create" | "update" | "skip" | "error";

export type DuplicateStrategy = "update" | "skip";

export type EmployeeCsvRow = {
  rowNumber: number;
  raw: Record<string, string>;
  employeeCode: string | null;
  fullName: string;
  homeDepartmentInput: string;
  homeWorkAreaId: string | null;
  active: boolean;
  gender: "M" | "F" | null;
  level: 1 | 2 | 3 | null;
  temporary: boolean;
  matchedEmployeeId: string | null;
  action: EmployeeCsvAction;
  errors: string[];
};

export type EmployeeCsvParseResult = {
  rows: EmployeeCsvRow[];
  fileErrors: string[];
};

function parseCsvText(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\r") {
      i++;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function parseBoolean(input: string, fallback: boolean): { value: boolean; ok: boolean } {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "") return { value: fallback, ok: true };
  if (["true", "yes", "y", "1"].includes(trimmed)) return { value: true, ok: true };
  if (["false", "no", "n", "0"].includes(trimmed)) return { value: false, ok: true };
  return { value: fallback, ok: false };
}

function nextEmployeeCodeFromUsed(used: Set<string>): string {
  let maxNum = 0;
  for (const code of used) {
    const match = code.match(/^E(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  let candidate = maxNum + 1;
  let next = `E${String(candidate).padStart(3, "0")}`;
  while (used.has(next)) {
    candidate += 1;
    next = `E${String(candidate).padStart(3, "0")}`;
  }
  return next;
}

export function parseEmployeeCsv(
  text: string,
  opts: {
    workAreas: WorkArea[];
    existingEmployees: Employee[];
    duplicateStrategy: DuplicateStrategy;
  },
): EmployeeCsvParseResult {
  const fileErrors: string[] = [];
  const parsed = parseCsvText(text);

  if (parsed.length === 0) {
    return { rows: [], fileErrors: ["CSV is empty."] };
  }

  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const requiredHeaders = ["full_name", "home_department"];
  const missingHeaders = requiredHeaders.filter((h) => !header.includes(h));
  if (missingHeaders.length > 0) {
    fileErrors.push(`Missing required header(s): ${missingHeaders.join(", ")}.`);
  }

  const headerIndex = (key: string) => header.indexOf(key);
  const dataRows = parsed.slice(1);
  if (dataRows.length > EMPLOYEE_CSV_MAX_ROWS) {
    fileErrors.push(`File has ${dataRows.length} rows; maximum is ${EMPLOYEE_CSV_MAX_ROWS}.`);
  }

  if (fileErrors.length > 0) {
    return { rows: [], fileErrors };
  }

  const workAreaByName = new Map(
    opts.workAreas.map((wa) => [wa.name.trim().toLowerCase(), wa]),
  );
  const employeeByCode = new Map<string, Employee>();
  for (const emp of opts.existingEmployees) {
    if (emp.employee_code) employeeByCode.set(emp.employee_code, emp);
  }
  const usedCodes = new Set<string>(
    opts.existingEmployees.map((e) => e.employee_code).filter((c): c is string => !!c),
  );

  const cappedRows = dataRows.slice(0, EMPLOYEE_CSV_MAX_ROWS);
  const seenCodesInFile = new Set<string>();
  const result: EmployeeCsvRow[] = [];

  cappedRows.forEach((cells, idx) => {
    const rowNumber = idx + 1;
    const errors: string[] = [];

    const get = (key: string): string => {
      const i = headerIndex(key);
      if (i < 0 || i >= cells.length) return "";
      return cells[i] ?? "";
    };

    const raw: Record<string, string> = {};
    for (const key of EMPLOYEE_CSV_HEADERS) raw[key] = get(key);

    const employeeCodeRaw = get("employee_code").trim();
    const fullName = get("full_name").trim();
    const homeDepartmentInput = get("home_department").trim();
    const activeRaw = get("active");
    const genderRaw = get("gender").trim().toUpperCase();
    const levelRaw = get("level").trim();
    const temporaryRaw = get("temporary");

    if (!fullName) errors.push("full_name is required.");

    let homeWorkAreaId: string | null = null;
    if (!homeDepartmentInput) {
      errors.push("home_department is required.");
    } else {
      const wa = workAreaByName.get(homeDepartmentInput.toLowerCase());
      if (!wa) {
        errors.push(`home_department "${homeDepartmentInput}" does not match any work area.`);
      } else {
        homeWorkAreaId = wa.id;
      }
    }

    let employeeCode: string | null = null;
    if (employeeCodeRaw) {
      employeeCode = employeeCodeRaw;
      if (seenCodesInFile.has(employeeCode)) {
        errors.push(`Duplicate employee_code "${employeeCode}" in file.`);
      } else {
        seenCodesInFile.add(employeeCode);
      }
    }

    const active = parseBoolean(activeRaw, true);
    if (!active.ok) errors.push(`active "${activeRaw}" is not a boolean (true/false).`);

    let gender: "M" | "F" | null = null;
    if (genderRaw === "M" || genderRaw === "F") gender = genderRaw;
    else if (genderRaw !== "") errors.push(`gender "${genderRaw}" must be M or F.`);

    let level: 1 | 2 | 3 | null = null;
    if (levelRaw !== "") {
      const n = Number(levelRaw);
      if (n === 1 || n === 2 || n === 3) level = n;
      else errors.push(`level "${levelRaw}" must be 1, 2, or 3.`);
    }

    const temporary = parseBoolean(temporaryRaw, false);
    if (!temporary.ok) errors.push(`temporary "${temporaryRaw}" is not a boolean (true/false).`);

    let matchedEmployeeId: string | null = null;
    if (employeeCode) {
      const existing = employeeByCode.get(employeeCode);
      if (existing) matchedEmployeeId = existing.id;
    }

    let action: EmployeeCsvAction;
    if (errors.length > 0) {
      action = "error";
    } else if (matchedEmployeeId) {
      action = opts.duplicateStrategy === "update" ? "update" : "skip";
    } else {
      action = "create";
    }

    result.push({
      rowNumber,
      raw,
      employeeCode,
      fullName,
      homeDepartmentInput,
      homeWorkAreaId,
      active: active.value,
      gender,
      level,
      temporary: temporary.value,
      matchedEmployeeId,
      action,
      errors,
    });
  });

  for (const row of result) {
    if (row.action === "create" && !row.employeeCode) {
      const generated = nextEmployeeCodeFromUsed(usedCodes);
      usedCodes.add(generated);
      row.employeeCode = generated;
    }
  }

  return { rows: result, fileErrors: [] };
}

export function buildEmployeeTemplateCsv(): string {
  const sample: Record<(typeof EMPLOYEE_CSV_HEADERS)[number], string>[] = [
    {
      employee_code: "E101",
      full_name: "Jane Doe",
      home_department: "Packing",
      active: "true",
      gender: "F",
      level: "2",
      temporary: "false",
    },
    {
      employee_code: "",
      full_name: "John Smith",
      home_department: "Assembly",
      active: "true",
      gender: "M",
      level: "1",
      temporary: "false",
    },
  ];

  const escape = (v: string) => /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines: string[] = [];
  lines.push(EMPLOYEE_CSV_HEADERS.join(","));
  for (const row of sample) {
    lines.push(EMPLOYEE_CSV_HEADERS.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
