import { normalizeCountryCode } from "@/lib/geo/countries";
import { isValidTimeZone } from "@/lib/geo/timezones";

export type EmployeeImportRow = Record<string, string | null> & {
  full_name: string;
  email: string;
  role_title: string;
  department: string;
  start_date: string;
  manager_email: string | null;
};

export type EmployeeImportValidationContext = {
  departments?: string[];
  workLocations?: string[];
  existingEmails?: string[];
  existingEmployeeNumbers?: string[];
};

const EMPLOYMENT_TYPES = new Set(["full_time", "part_time", "contractor", "intern"]);

function key(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function validIsoDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export function orderEmployeeImportRows(rows: EmployeeImportRow[], existingEmails: string[] = []): EmployeeImportRow[] {
  const remaining = new Map(rows.map((row) => [key(row.email), row]));
  const available = new Set(existingEmails.map(key));
  const ordered: EmployeeImportRow[] = [];
  while (remaining.size > 0) {
    const next = [...remaining.values()].find((row) => !row.manager_email || available.has(key(row.manager_email)));
    if (!next) throw new Error("IMPORT_MANAGER_CYCLE");
    const email = key(next.email);
    ordered.push(next);
    available.add(email);
    remaining.delete(email);
  }
  return ordered;
}

export function validateEmployeeImportRows(
  rows: EmployeeImportRow[],
  defaultCountry: string | null,
  defaultTimezone: string | null,
  context: EmployeeImportValidationContext = {},
): string[] {
  const errors: string[] = [
    ...(!defaultCountry ? ["Company country is not configured."] : []),
    ...(!defaultTimezone ? ["Company timezone is not configured."] : []),
  ];
  const seenEmails = new Set((context.existingEmails ?? []).map(key));
  const seenEmployeeNumbers = new Set((context.existingEmployeeNumbers ?? []).map(key).filter(Boolean));
  const fileEmails = new Set(rows.map((row) => key(row.email)).filter(Boolean));
  const knownDepartments = new Set((context.departments ?? []).map(key));
  const knownLocations = new Set((context.workLocations ?? []).map(key));

  rows.forEach((row, index) => {
    const line = index + 2;
    const email = key(row.email);
    const employeeNumber = key(row.employee_number);
    if (!row.full_name?.trim()) errors.push(`Row ${line}: full name is required`);
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(`Row ${line}: invalid email`);
    else if (seenEmails.has(email)) errors.push(`Row ${line}: duplicate email ${email}`);
    seenEmails.add(email);
    if (employeeNumber) {
      if (seenEmployeeNumbers.has(employeeNumber)) errors.push(`Row ${line}: duplicate employee number ${row.employee_number}`);
      seenEmployeeNumbers.add(employeeNumber);
    }
    if (!row.role_title?.trim()) errors.push(`Row ${line}: role title is required`);
    if (!row.department?.trim()) errors.push(`Row ${line}: department is required`);
    else if (knownDepartments.size > 0 && !knownDepartments.has(key(row.department))) {
      errors.push(`Row ${line}: unknown department ${row.department}`);
    }
    if (!validIsoDate(row.start_date)) errors.push(`Row ${line}: start date must be a real YYYY-MM-DD date`);
    if (!EMPLOYMENT_TYPES.has(key(row.employment_type))) errors.push(`Row ${line}: unsupported employment type ${row.employment_type ?? ""}`);
    if (row.country && !normalizeCountryCode(row.country)) errors.push(`Row ${line}: country must be an ISO two-letter code`);
    if (row.timezone && !isValidTimeZone(row.timezone)) errors.push(`Row ${line}: invalid timezone`);
    if (row.manager_email && !/^\S+@\S+\.\S+$/.test(key(row.manager_email))) errors.push(`Row ${line}: invalid manager email`);
    else if (row.manager_email && !seenEmails.has(key(row.manager_email)) && !fileEmails.has(key(row.manager_email))) {
      errors.push(`Row ${line}: manager email was not found ${row.manager_email}`);
    }
    if (row.work_location && knownLocations.size > 0 && !knownLocations.has(key(row.work_location))) {
      errors.push(`Row ${line}: unknown work location ${row.work_location}`);
    }
  });

  if (!errors.some((error) => error.includes("duplicate email") || error.includes("manager email was not found"))) {
    try {
      orderEmployeeImportRows(rows, context.existingEmails);
    } catch {
      errors.push("Manager reporting relationships contain a cycle.");
    }
  }

  return [...new Set(errors)];
}

function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseEmployeeCsv(
  text: string,
  defaultCountry: string | null,
  defaultTimezone: string | null,
  context: EmployeeImportValidationContext = {},
): { rows: EmployeeImportRow[]; errors: string[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ["CSV needs a header and at least one row."] };
  const header = csvCells(lines[0]!);
  const missing = ["full_name", "email", "role_title", "department", "start_date", "employment_type"].filter((column) => !header.includes(column));
  const rows = lines.slice(1).map((line) => {
    const values = csvCells(line);
    const raw = Object.fromEntries(header.map((key, index) => [key, values[index]?.trim() ?? ""]));
    return { ...raw, manager_email: raw.manager_email || null } as EmployeeImportRow;
  });
  const errors = [
    ...missing.map((column) => `Missing column: ${column}`),
    ...validateEmployeeImportRows(rows, defaultCountry, defaultTimezone, context),
  ];
  return { rows, errors };
}
