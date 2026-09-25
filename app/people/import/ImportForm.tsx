"use client";

import { useMemo, useState } from "react";
import { importEmployeesAction } from "./actions";
import { getCountryName, normalizeCountryCode } from "@/lib/geo/countries";
import { parseEmployeeCsv } from "@/lib/people/importCsv";

const columns = ["full_name", "email", "employee_number", "role_title", "department", "manager_email", "start_date", "employment_type", "country", "timezone", "work_location"];

export function ImportForm({ defaultCountry, defaultTimezone }: { defaultCountry: string | null; defaultTimezone: string | null }) {
  const [text, setText] = useState("");
  const preview = useMemo(() => parseEmployeeCsv(text, defaultCountry, defaultTimezone), [text, defaultCountry, defaultTimezone]);
  return (
    <div className="space-y-5">
      <label className="block text-[13px] text-ink-600">Upload CSV<input type="file" accept=".csv,text/csv" className="tf-input mt-2 w-full" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setText(String(reader.result ?? "")); reader.readAsText(file); }} /></label>
      <label className="block text-[13px] text-ink-600">Employee CSV<textarea value={text} onChange={(event) => setText(event.target.value)} className="tf-input mt-2 min-h-48 w-full p-3 font-mono text-[12px]" placeholder={columns.join(",")} /></label>
      {preview.errors.length > 0 ? <ul className="rounded-lg border border-signal-red/30 p-3 text-[12px] text-signal-red">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      {preview.rows.length > 0 ? <div className="overflow-x-auto rounded-lg border border-ink-200"><table className="min-w-full text-left text-[12px]"><thead><tr>{["Name", "Email", "Role", "Department", "Start", "Country", "Timezone"].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 20).map((row, index) => { const country = normalizeCountryCode(row.country) ?? defaultCountry; const timezone = row.timezone || defaultTimezone; return <tr key={index} className="border-t border-ink-100"><td className="px-3 py-2">{row.full_name}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{row.role_title}</td><td className="px-3 py-2">{row.department}</td><td className="px-3 py-2">{row.start_date}</td><td className="px-3 py-2">{country ? getCountryName(country) : "—"}</td><td className="px-3 py-2">{timezone ?? "—"}</td></tr>; })}</tbody></table></div> : null}
      <form action={importEmployeesAction}><input type="hidden" name="rows" value={JSON.stringify(preview.rows)} /><button disabled={preview.rows.length === 0 || preview.errors.length > 0} className="tf-primary-action px-4 py-2 text-[13px] disabled:opacity-40">Import {preview.rows.length || ""} people</button></form>
    </div>
  );
}
