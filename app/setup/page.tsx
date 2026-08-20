import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FileInput } from "@/components/FileInput";
import { ISO_COUNTRIES } from "@/lib/geo/countries";
import {
  getCompanySettings,
  listDepartments,
  listWorkLocations,
  listLeaveDefinitions,
  getCompensationConfig,
} from "@/services/configurationService";
import { getCompanyIdentity } from "@/lib/company/identity";
import {
  saveCompanySettingsAction,
  saveCompanyLogoAction,
  removeCompanyLogoAction,
  createDepartmentAction,
  renameDepartmentAction,
  toggleDepartmentAction,
  createWorkLocationAction,
  updateWorkLocationAction,
  createLeaveDefinitionAction,
  updateLeaveDefinitionAction,
  setCompensationModeAction,
  createCompensationComponentAction,
  renameCompensationComponentAction,
  toggleCompensationComponentAction,
} from "./actions";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { key: "company", label: "Company" },
  { key: "departments", label: "Departments" },
  { key: "locations", label: "Work locations" },
  { key: "workingdays", label: "Working days" },
  { key: "holidays", label: "Holidays" },
  { key: "leave", label: "Leave" },
  { key: "compensation", label: "Compensation" },
  { key: "checkin", label: "30-day check-in" },
  { key: "access", label: "Users & Access" },
] as const;

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Check the details and try again.",
  INVALID_COUNTRY: "Choose a valid country.",
  DEPARTMENT_DUPLICATE: "A department with that name already exists.",
  WORK_LOCATION_DUPLICATE: "A work location with that name already exists.",
  COMPENSATION_COMPONENT_DUPLICATE: "A component with that name already exists.",
  LOGO_EMPTY_FILE: "Choose a logo image to upload.",
  LOGO_TOO_LARGE: "The logo must be 2 MB or smaller.",
  LOGO_UNSUPPORTED_TYPE: "Use a PNG, JPG, WEBP or SVG image.",
  LOGO_UPLOAD_FAILED: "The logo could not be uploaded. Try again.",
  FORBIDDEN: "You do not have permission for that action.",
  UNKNOWN: "Something went wrong. Try again.",
};

const DAYS = [
  { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" }, { n: 4, label: "Thu" },
  { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 7, label: "Sun" },
];

const input = "mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]";
const btn = "rounded-lg bg-brand-signal px-4 py-2 text-[13px] font-medium text-ink-800";
const btnGhost = "rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-[12px] text-ink-700 hover:border-ink-900";

function CountrySelect({ name, value }: { name: string; value?: string | null }) {
  return (
    <select name={name} defaultValue={value ?? ""} className={input}>
      <option value="">— Select country</option>
      {ISO_COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>{c.name}</option>
      ))}
    </select>
  );
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { section: sectionParam, status, error } = await searchParams;
  const section = SECTIONS.some((s) => s.key === sectionParam) ? sectionParam! : "company";
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role !== "admin") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <AppShell actor={actor} activePath="/setup" />
        <p className="mt-8 text-[15px] text-ink-700">Setup &amp; administration is admin-only in TeamFrame.</p>
      </main>
    );
  }

  const [company, departments, workLocations, leaveDefinitions, compConfig, identity] = await Promise.all([
    getCompanySettings(actor),
    listDepartments(actor),
    listWorkLocations(actor),
    listLeaveDefinitions(actor),
    getCompensationConfig(actor),
    getCompanyIdentity(actor.tenantId),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <AppShell actor={actor} activePath="/setup" />
      <div className="pb-5">
        <h1 className="tf-h1">Setup</h1>
        <p className="tf-meta mt-1">Configure your TeamFrame workspace.</p>
      </div>

      {status ? <p className="mb-5 rounded-lg border border-signal-green/25 bg-signal-green/5 px-4 py-2.5 text-[13.5px] text-signal-green">Saved.</p> : null}
      {errorMessage ? <p role="alert" className="mb-5 rounded-lg border border-signal-red/25 bg-signal-red/5 px-4 py-2.5 text-[13.5px] text-signal-red">{errorMessage}</p> : null}

      <div className="grid gap-8 lg:grid-cols-[196px_minmax(0,1fr)]">
        <nav aria-label="Setup sections" className="h-fit lg:sticky lg:top-10">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <Link
                  href={`/setup?section=${s.key}`}
                  aria-current={section === s.key ? "page" : undefined}
                  className={`block whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] transition ${section === s.key ? "bg-ink-100 font-semibold text-ink-900" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"}`}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          {section === "company" || section === "workingdays" || section === "checkin" ? (
            <section className="tf-surface-flat p-6">
              <h2 className="tf-h2">Company</h2>
              <p className="mt-1 text-[13px] text-ink-500">Identity, country, timezone, working-day defaults and the 30-day check-in.</p>
              <form action={saveCompanySettingsAction} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-[13px] text-ink-700">Company name<input name="name" required defaultValue={company.name} className={input} /></label>
                <label className="text-[13px] text-ink-700">Country<CountrySelect name="country" value={company.country} /></label>
                <label className="text-[13px] text-ink-700">Default timezone<input name="timezone" required defaultValue={company.default_timezone} className={input} placeholder="e.g. Asia/Dubai" /></label>
                <fieldset className="text-[13px] text-ink-700 sm:col-span-2">
                  <legend className="mb-1">Company default working days</legend>
                  <div className="flex flex-wrap gap-3">
                    {DAYS.map((d) => (
                      <label key={d.n} className="flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-1.5 text-[13px]">
                        <input type="checkbox" name="working_day" value={d.n} defaultChecked={company.default_working_days.includes(d.n)} />
                        {d.label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-ink-500">Employee-level working-day overrides remain available on the employee record and are unaffected.</p>
                </fieldset>
                <fieldset className="text-[13px] text-ink-700 sm:col-span-2">
                  <legend className="mb-1">Employee number format</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-[12px] text-ink-600">Prefix (optional)<input name="employee_number_prefix" defaultValue={company.employee_number_prefix ?? ""} maxLength={12} className={input} placeholder="e.g. NS" /></label>
                    <label className="text-[12px] text-ink-600">Separator<input name="employee_number_separator" defaultValue={company.employee_number_separator} maxLength={3} className={input} placeholder="-" /></label>
                    <label className="text-[12px] text-ink-600">Digits<input name="employee_number_digits" type="number" min={1} max={12} defaultValue={company.employee_number_digits} className={input} /></label>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-500">Next number: {company.employee_number_next}. Changing the format never renumbers existing employee numbers.</p>
                </fieldset>
                <label className="flex items-center gap-2 text-[13px] text-ink-700 sm:col-span-2">
                  <input type="checkbox" name="thirty_day_check_in_enabled" defaultChecked={company.thirty_day_check_in_enabled} />
                  Enable the optional automated 30-day onboarding check-in
                </label>
                <div className="sm:col-span-2"><PendingSubmitButton idleLabel="Save company settings" pendingLabel="Saving…" className={btn} /></div>
              </form>

              <div className="mt-6 border-t border-ink-200 pt-5">
                <h3 className="text-[14px] font-bold text-ink-800">Company logo</h3>
                <p className="mt-1 text-[13px] text-ink-500">Shown in the app workspace header. PNG, JPG, WEBP or SVG, up to 2&nbsp;MB. Falls back to a monogram.</p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  {identity.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={identity.logoUrl} alt="Current company logo" className="h-12 w-12 rounded-md border border-ink-200 object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-signal text-[15px] font-extrabold text-ink-900">{identity.monogram}</span>
                  )}
                  <form action={saveCompanyLogoAction} encType="multipart/form-data" className="flex flex-wrap items-center gap-3">
                    <FileInput name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" label="Choose logo" />
                    <PendingSubmitButton idleLabel="Upload logo" pendingLabel="Uploading…" className={btn} />
                  </form>
                  {identity.logoUrl ? (
                    <form action={removeCompanyLogoAction}>
                      <ConfirmSubmitButton idleLabel="Remove" pendingLabel="Removing…" confirmMessage="Remove the company logo?" className={btnGhost} />
                    </form>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {section === "departments" ? (
            <section className="tf-surface-flat p-6">
              <h2 className="tf-h2">Departments</h2>
              <p className="mt-1 text-[13px] text-ink-500">Company-controlled department list. Deactivate rather than delete — legacy free-text labels stay valid.</p>
              <form action={createDepartmentAction} className="mt-4 flex flex-wrap items-end gap-2">
                <label className="flex-1 text-[13px] text-ink-700">New department<input name="name" required className={input} /></label>
                <PendingSubmitButton idleLabel="Add" pendingLabel="Adding…" className={btn} />
              </form>
              <ul className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-200">
                {departments.length === 0 ? <li className="px-3 py-3 text-[13px] text-ink-500">No departments configured yet.</li> : null}
                {departments.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <form action={renameDepartmentAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={d.id} />
                      <input name="name" defaultValue={d.name} className="rounded-lg border border-ink-300 px-2 py-1 text-[13px]" />
                      <PendingSubmitButton idleLabel="Rename" pendingLabel="Saving…" className={btnGhost} />
                    </form>
                    <form action={toggleDepartmentAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="active" value={(!d.active).toString()} />
                      <span className={`text-[11px] font-semibold ${d.active ? "text-signal-green" : "text-ink-400"}`}>{d.active ? "Active" : "Inactive"}</span>
                      <PendingSubmitButton idleLabel={d.active ? "Deactivate" : "Reactivate"} pendingLabel="Saving…" className={btnGhost} />
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {section === "locations" ? (
            <section className="tf-surface-flat p-6">
              <h2 className="tf-h2">Work locations</h2>
              <p className="mt-1 text-[13px] text-ink-500">Company-defined work locations, each linked to a country.</p>
              <form action={createWorkLocationAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="text-[13px] text-ink-700">Name<input name="name" required className={input} /></label>
                <label className="text-[13px] text-ink-700">Country<CountrySelect name="country" /></label>
                <PendingSubmitButton idleLabel="Add" pendingLabel="Adding…" className={btn} />
              </form>
              <ul className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-200">
                {workLocations.length === 0 ? <li className="px-3 py-3 text-[13px] text-ink-500">No work locations configured yet.</li> : null}
                {workLocations.map((l) => (
                  <li key={l.id} className="px-3 py-2">
                    <form action={updateWorkLocationAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
                      <input type="hidden" name="id" value={l.id} />
                      <input name="name" defaultValue={l.name} className="rounded-lg border border-ink-300 px-2 py-1 text-[13px]" />
                      <CountrySelect name="country" value={l.country} />
                      <label className="flex items-center gap-1.5 text-[12px] text-ink-600"><input type="checkbox" name="active" defaultChecked={l.active} /> Active</label>
                      <PendingSubmitButton idleLabel="Save" pendingLabel="Saving…" className={btnGhost} />
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {section === "holidays" ? (
            <section className="tf-surface-flat p-6">
              <h2 className="tf-h2">Holidays</h2>
              <p className="mt-1 text-[13px] text-ink-500">The company holiday calendar feeds working-day leave calculations. Managed here under Setup.</p>
              <Link href="/company" className={`mt-4 inline-flex ${btn}`}>Open holiday calendar</Link>
            </section>
          ) : null}

          {section === "leave" ? (
            <section className="tf-surface-flat p-6">
              <h2 className="tf-h2">Leave definitions</h2>
              <p className="mt-1 text-[13px] text-ink-500">Configure the leave types offered. These drive the employee leave dropdown (a later phase). The underlying leave engine is unchanged.</p>
              <details className="mt-4 rounded-lg border border-ink-200 bg-ink-50/40 p-4">
                <summary className="cursor-pointer text-[13px] font-medium text-ink-800">Add custom leave type (e.g. Maternity, Study)</summary>
                <form action={createLeaveDefinitionAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-[13px] text-ink-700">Display name<input name="display_name" required className={input} placeholder="Maternity Leave" /></label>
                  <label className="text-[13px] text-ink-700">Underlying category<select name="system_leave_type" defaultValue="other" className={input}><option value="annual">annual</option><option value="sick">sick</option><option value="unpaid">unpaid</option><option value="other">other</option></select></label>
                  <label className="text-[13px] text-ink-700">Default entitlement (days, optional)<input name="default_entitlement_days" type="number" min="0" max="365" className={input} /></label>
                  <label className="text-[13px] text-ink-700">Counting basis<select name="counting_basis" defaultValue="working_days" className={input}><option value="working_days">Working days</option><option value="calendar_days">Calendar days</option></select></label>
                  <label className="text-[13px] text-ink-700">Attachment<select name="attachment_requirement" defaultValue="not_required" className={input}><option value="not_required">Not required</option><option value="optional">Optional</option><option value="required">Required</option></select></label>
                  <label className="flex items-center gap-2 text-[13px] text-ink-700"><input type="checkbox" name="active" defaultChecked /> Active</label>
                  <div className="sm:col-span-2"><PendingSubmitButton idleLabel="Add leave type" pendingLabel="Adding…" className={btn} /></div>
                </form>
              </details>
              <ul className="mt-4 space-y-2">
                {leaveDefinitions.map((d) => (
                  <li key={d.id} className="rounded-lg border border-ink-200 p-3">
                    <form action={updateLeaveDefinitionAction} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto_auto] sm:items-end">
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="system_leave_type" value={d.system_leave_type} />
                      <label className="text-[12px] text-ink-600">Name{d.is_system ? " (system)" : ""}<input name="display_name" defaultValue={d.display_name} className="mt-1 w-full rounded-lg border border-ink-300 px-2 py-1 text-[13px]" /></label>
                      <label className="text-[12px] text-ink-600">Entitlement<input name="default_entitlement_days" type="number" min="0" max="365" defaultValue={d.default_entitlement_days ?? ""} className="mt-1 w-full rounded-lg border border-ink-300 px-2 py-1 text-[13px]" /></label>
                      <label className="text-[12px] text-ink-600">Basis<select name="counting_basis" defaultValue={d.counting_basis} className="mt-1 w-full rounded-lg border border-ink-300 px-2 py-1 text-[13px]"><option value="working_days">Working days</option><option value="calendar_days">Calendar days</option></select></label>
                      <label className="text-[12px] text-ink-600">Attachment<select name="attachment_requirement" defaultValue={d.attachment_requirement} className="mt-1 w-full rounded-lg border border-ink-300 px-2 py-1 text-[13px]"><option value="not_required">Not required</option><option value="optional">Optional</option><option value="required">Required</option></select></label>
                      <label className="flex items-center gap-1.5 text-[12px] text-ink-600"><input type="checkbox" name="active" defaultChecked={d.active} /> Active</label>
                      <PendingSubmitButton idleLabel="Save" pendingLabel="Saving…" className={btnGhost} />
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {section === "compensation" ? (
            <section className="tf-surface-flat p-6">
              <h2 className="tf-h2">Compensation</h2>
              <p className="mt-1 text-[13px] text-ink-500">
                Choose how compensation is recorded on the employee record. Storage only — TeamFrame does not run payroll, tax, payslips or WPS.
              </p>

              <form action={setCompensationModeAction} className="mt-4 grid gap-3 sm:max-w-xl">
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${compConfig.mode === "total" ? "border-ink-900 bg-ink-50/60" : "border-ink-200"}`}>
                  <input type="radio" name="mode" value="total" defaultChecked={compConfig.mode === "total"} className="mt-1" />
                  <span>
                    <span className="block text-[14px] font-semibold text-ink-800">Total only</span>
                    <span className="block text-[12.5px] text-ink-500">A single figure per employee (currency, pay basis, effective date).</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${compConfig.mode === "components" ? "border-ink-900 bg-ink-50/60" : "border-ink-200"}`}>
                  <input type="radio" name="mode" value="components" defaultChecked={compConfig.mode === "components"} className="mt-1" />
                  <span>
                    <span className="block text-[14px] font-semibold text-ink-800">Component breakdown</span>
                    <span className="block text-[12.5px] text-ink-500">Named components (e.g. Basic, Housing, Transport); the total is derived from their sum.</span>
                  </span>
                </label>
                <div><PendingSubmitButton idleLabel="Save compensation mode" pendingLabel="Saving…" className={btn} /></div>
              </form>

              <div className="mt-6 border-t border-ink-200 pt-5">
                <h3 className="text-[14px] font-bold text-ink-800">Salary components</h3>
                <p className="mt-1 text-[13px] text-ink-500">Used when component breakdown is enabled. Deactivate rather than delete to keep historical records intact.</p>
                <form action={createCompensationComponentAction} className="mt-4 flex flex-wrap items-end gap-2">
                  <label className="flex-1 text-[13px] text-ink-700">New component<input name="name" required maxLength={80} placeholder="e.g. Housing allowance" className={input} /></label>
                  <PendingSubmitButton idleLabel="Add" pendingLabel="Adding…" className={btn} />
                </form>
                <ul className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-200">
                  {compConfig.components.length === 0 ? <li className="px-3 py-3 text-[13px] text-ink-500">No components configured yet.</li> : null}
                  {compConfig.components.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <form action={renameCompensationComponentAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input name="name" defaultValue={c.name} maxLength={80} className="rounded-lg border border-ink-300 px-2 py-1 text-[13px]" />
                        <PendingSubmitButton idleLabel="Rename" pendingLabel="Saving…" className={btnGhost} />
                      </form>
                      <form action={toggleCompensationComponentAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={(!c.active).toString()} />
                        <span className={`text-[11px] font-semibold ${c.active ? "text-signal-green" : "text-ink-400"}`}>{c.active ? "Active" : "Inactive"}</span>
                        <PendingSubmitButton idleLabel={c.active ? "Deactivate" : "Reactivate"} pendingLabel="Saving…" className={btnGhost} />
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {section === "access" ? (
            <section className="tf-surface-flat p-6">
              <h2 className="tf-h2">Users &amp; Access</h2>
              <p className="mt-1 text-[13px] text-ink-500">
                Access starts from clear presets — <strong>Full Access</strong>, <strong>Admin</strong>, <strong>Finance</strong>, <strong>Employee</strong>. Manager access is derived from reporting lines. Fine-grained custom access remains available for exceptions.
              </p>
              <Link href="/access" className={`mt-4 inline-flex ${btn}`}>Manage users &amp; access</Link>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
