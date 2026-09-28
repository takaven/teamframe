export function csv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.map(cell).join(","), ...rows.map((row) => headers.map((header) => cell(row[header])).join(","))].join("\r\n");
}

export function humanCsvValue(value: string | null | undefined): string {
  return value?.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) ?? "";
}
