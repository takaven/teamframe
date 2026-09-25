import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireTenantActor } from "@/middleware/rbac";
import { ImportForm } from "./ImportForm";
import { getCompanySettings } from "@/services/configurationService";
import { getCountryName, normalizeCountryCode } from "@/lib/geo/countries";
import { isValidTimeZone } from "@/lib/geo/timezones";

export const dynamic = "force-dynamic";

export default async function PeopleImportPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const actor = await requireTenantActor();
  const params = await searchParams;
  const company = await getCompanySettings(actor);
  const country = normalizeCountryCode(company.country);
  const defaultsReady = Boolean(country && isValidTimeZone(company.default_timezone));
  return <main className="mx-auto max-w-5xl px-6 py-14">
    <AppShell actor={actor} activePath="/people" />
    <Link href="/people" className="tf-context-back">← Back to People</Link>
    <header className="mt-4 border-b border-ink-200 pb-5">
      <h1 className="text-[32px] font-bold">Import people</h1>
      <p className="mt-1 text-[14px] text-ink-500">Paste a CSV, review every row, then confirm the import into this workspace only. Country and timezone are optional and use company defaults when blank.</p>
    </header>
    {params.error ? <p className="mt-5 text-signal-red">Import stopped after {params.created ?? "0"} rows. Correct the CSV and avoid re-importing rows already created.</p> : null}
    <section className="mt-6 tf-surface-flat p-5">
      {!defaultsReady ? <p role="alert" className="mb-5 rounded-lg border border-signal-red/30 bg-signal-red/5 px-4 py-3 text-[13px] text-signal-red">Import is paused until a valid company country and timezone are saved in <Link href="/setup?view=company" className="font-semibold underline">Settings</Link>.</p> : null}
      <p className="mb-4 text-[12px] text-ink-500">Defaults: {country ? getCountryName(country) : "Not configured"} · {isValidTimeZone(company.default_timezone) ? company.default_timezone : "Timezone not configured"}</p>
      <a download="teamframe-people-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent("full_name,email,employee_number,role_title,department,manager_email,start_date,employment_type,country,timezone,work_location\n")}`} className="tf-secondary-action px-3 py-2 text-[12px]">Download template</a>
      <div className="mt-5"><ImportForm defaultCountry={country} defaultTimezone={isValidTimeZone(company.default_timezone) ? company.default_timezone : null} /></div>
    </section>
  </main>;
}
