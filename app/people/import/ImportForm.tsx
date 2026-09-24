"use client";

import { useMemo, useState } from "react";
import { importEmployeesAction } from "./actions";

const columns = ["full_name", "email", "employee_number", "role_title", "department", "manager_email", "start_date", "employment_type", "country", "work_location"];
type ImportRow = Record<string, string | null> & { full_name: string; email: string; role_title: string; department: string; start_date: string; manager_email: string | null };

function parse(text: string): { rows: ImportRow[]; errors: string[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ["CSV needs a header and at least one row."] };
  const header = lines[0]!.split(",").map((value) => value.trim());
  const missing = ["full_name", "email", "role_title", "department", "start_date", "employment_type", "country"].filter((column) => !header.includes(column));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    const raw = Object.fromEntries(header.map((key, index) => [key, values[index]?.trim() ?? ""]));
    return { ...raw, manager_email: raw.manager_email || null } as ImportRow;
  });
  const errors = [...missing.map((column) => `Missing column: ${column}`), ...rows.flatMap((row, index) => !row.email.includes("@") ? [`Row ${index + 2}: invalid email`] : [])];
  return { rows, errors };
}

export function ImportForm() {
  const [text, setText] = useState("");
  const preview = useMemo(() => parse(text), [text]);
  return (
    <div className="space-y-5">
      <label className="block text-[13px] text-ink-600">Employee CSV<textarea value={text} onChange={(event) => setText(event.target.value)} className="tf-input mt-2 min-h-48 w-full p-3 font-mono text-[12px]" placeholder={columns.join(",")} /></label>
      {preview.errors.length > 0 ? <ul className="rounded-lg border border-signal-red/30 p-3 text-[12px] text-signal-red">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      {preview.rows.length > 0 ? <div className="overflow-x-auto rounded-lg border border-ink-200"><table className="min-w-full text-left text-[12px]"><thead><tr>{["Name", "Email", "Role", "Department", "Start"].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 20).map((row, index) => <tr key={index} className="border-t border-ink-100"><td className="px-3 py-2">{row.full_name}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{row.role_title}</td><td className="px-3 py-2">{row.department}</td><td className="px-3 py-2">{row.start_date}</td></tr>)}</tbody></table></div> : null}
      <form action={importEmployeesAction}><input type="hidden" name="rows" value={JSON.stringify(preview.rows)} /><button disabled={preview.rows.length === 0 || preview.errors.length > 0} className="tf-primary-action px-4 py-2 text-[13px] disabled:opacity-40">Import {preview.rows.length || ""} people</button></form>
    </div>
  );
}
