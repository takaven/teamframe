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
    ...(!defaultCountry ? ["Company country is not configured."] : []),
    ...(!defaultTimezone ? ["Company timezone is not configured."] : []),
    ...rows.flatMap((row, index) => {
      const rowErrors: string[] = [];
      if (!row.email.includes("@")) rowErrors.push(`Row ${index + 2}: invalid email`);
      if (row.country && !normalizeCountryCode(row.country)) rowErrors.push(`Row ${index + 2}: country must be an ISO two-letter code`);
      if (row.timezone && !isValidTimeZone(row.timezone)) rowErrors.push(`Row ${index + 2}: invalid timezone`);
      return rowErrors;
    }),
  ];
  return { rows, errors };
}
