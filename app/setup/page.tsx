import { AppShell } from "@/components/AppShell";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireTenantRole } from "@/middleware/rbac";
import { getCompanySetupState } from "@/services/companySetupService";
import { completeGuidedSetupAction } from "./actions";

export const dynamic = "force-dynamic";

const DEFAULT_POSITIONS = `Managing Director | Leadership
Head of Operations | Operations | Managing Director
Operations Coordinator | Operations | Head of Operations
Finance Manager | Finance | Managing Director
Product Lead | Product | Managing Director`;

const DEFAULT_EMPLOYEES = `Amina Rahman | amina.rahman@setup.example | Managing Director | Leadership | 2026-08-17
Mateo Silva | mateo.silva@setup.example | Operations Coordinator | Operations | 2026-08-24`;

const ERROR_COPY: Record<string, string> = {
  INVALID_INPUT: "Check the required fields and try again.",
  SETUP_POSITION_LINE_INVALID: "Each position must use: Title | Department | Reports to title.",
  SETUP_POSITION_TITLE_DUPLICATE: "Each position title must be unique during setup.",
  SETUP_POSITION_PARENT_UNKNOWN: "Every reporting line must refer to a position listed in this setup.",
  SETUP_POSITION_PARENT_SELF: "A position cannot report to itself.",
  SETUP_EMPLOYEE_LINE_INVALID: "Each employee must use: Full name | Email | Role title | Department | Start date.",
  SETUP_EMPLOYEE_START_DATE_INVALID: "Employee start dates must use YYYY-MM-DD.",
  SETUP_EMPLOYEE_EMAIL_DUPLICATE: "Each employee email must be unique during setup.",
  SETUP_ALREADY_COMPLETED: "Guided setup has already been completed for this company.",
  COMPANY_NOT_FOUND: "The company record could not be found.",
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; status?: string }>;
}) {
  const actor = await requireTenantRole("admin");
  const company = await getCompanySetupState(actor);
  const params = (await searchParams) ?? {};
  const error = params.error ? ERROR_COPY[params.error] ?? "Setup could not be completed. Check the details and try again." : null;
  const completed = params.status === "completed";

  return (
    <>
      <AppShell actor={actor} activePath="/setup" />
      <main className="tf-main-surface">
        <section className="tf-page-header">
          <div>
            <p className="tf-section-kicker">Company setup</p>
            <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-extrabold tracking-[-0.01em] text-ink-800">
              Guided setup
            </h1>
            <p className="mt-3 max-w-[760px] text-[17px] leading-7 text-ink-600">
              Set the company basics, initial structure and first employees after a controlled administrator has been
              provisioned.
            </p>
          </div>
        </section>

        {completed ? (
          <div className="tf-card mb-5 border-brand-signal/60 bg-white">
            <p className="text-[15px] font-extrabold text-ink-800">Setup recorded.</p>
            <p className="mt-1 text-[14px] text-ink-600">
              Company details, starter positions and first employees have been created from this guided setup.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="tf-card mb-5 border-red-200 bg-red-50">
            <p className="text-[15px] font-extrabold text-red-900">Setup needs attention.</p>
            <p className="mt-1 text-[14px] text-red-800">{error}</p>
          </div>
        ) : null}

        <form action={completeGuidedSetupAction} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="tf-card">
              <h2 className="text-xl font-extrabold text-ink-800">Company identity</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-ink-700">
                  Company name
                  <input
                    name="company_name"
                    defaultValue={company.name}
                    required
                    className="mt-2 w-full rounded-lg border border-[color:var(--border-default)] bg-white px-3 py-2 text-ink-800"
                  />
                </label>
                <label className="block text-sm font-semibold text-ink-700">
                  Country
                  <input
                    name="country"
                    defaultValue={company.country ?? ""}
                    required
                    className="mt-2 w-full rounded-lg border border-[color:var(--border-default)] bg-white px-3 py-2 text-ink-800"
                    placeholder="United Kingdom"
                  />
                </label>
                <label className="block text-sm font-semibold text-ink-700 md:col-span-2">
                  Location
                  <input
                    name="location"
                    defaultValue={company.location ?? ""}
                    className="mt-2 w-full rounded-lg border border-[color:var(--border-default)] bg-white px-3 py-2 text-ink-800"
                    placeholder="London"
                  />
                </label>
              </div>
            </section>

            <section className="tf-card">
              <h2 className="text-xl font-extrabold text-ink-800">Initial organisation structure</h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">
                One position per line. Use: Title | Department | Reports to title. Leave the final part empty for the
                top position.
              </p>
              <textarea
                name="positions"
                required
                rows={8}
                defaultValue={DEFAULT_POSITIONS}
                className="mt-4 w-full rounded-lg border border-[color:var(--border-default)] bg-white px-3 py-2 font-mono text-[13px] leading-6 text-ink-800"
              />
            </section>

            <section className="tf-card">
              <h2 className="text-xl font-extrabold text-ink-800">First employees</h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">
                One employee per line. Use: Full name | Email | Role title | Department | Start date. Role titles that
                match a unique position are assigned into the Org Chart.
              </p>
              <textarea
                name="employees"
                required
                rows={7}
                defaultValue={DEFAULT_EMPLOYEES}
                className="mt-4 w-full rounded-lg border border-[color:var(--border-default)] bg-white px-3 py-2 font-mono text-[13px] leading-6 text-ink-800"
              />
            </section>
          </div>

          <aside className="space-y-5">
            <section className="tf-card">
              <h2 className="text-lg font-extrabold text-ink-800">Basic leave defaults</h2>
              <div className="mt-4 grid gap-4">
                <label className="block text-sm font-semibold text-ink-700">
                  Annual leave days
                  <input
                    name="annual_leave_default_days"
                    type="number"
                    min="0"
                    max="365"
                    defaultValue={company.annual_leave_default_days ?? 20}
                    required
                    className="mt-2 w-full rounded-lg border border-[color:var(--border-default)] bg-white px-3 py-2 text-ink-800"
                  />
                </label>
                <label className="block text-sm font-semibold text-ink-700">
                  Sick leave days
                  <input
                    name="sick_leave_default_days"
                    type="number"
                    min="0"
                    max="365"
                    defaultValue={company.sick_leave_default_days ?? 10}
                    required
                    className="mt-2 w-full rounded-lg border border-[color:var(--border-default)] bg-white px-3 py-2 text-ink-800"
                  />
                </label>
              </div>
            </section>

            <section className="tf-card bg-ink-700 text-white">
              <h2 className="text-lg font-extrabold">Controlled setup boundary</h2>
              <p className="mt-3 text-sm leading-6 text-[#D6DCE3]">
                This does not create public signup or billing. It only lets an already-provisioned admin initialise the
                normal company workspace without developer or direct database intervention.
              </p>
              <PendingSubmitButton idleLabel="Complete setup" pendingLabel="Creating setup..." className="mt-5 w-full" />
              {company.setup_completed_at ? (
                <p className="mt-3 text-xs leading-5 text-[#D6DCE3]">
                  Setup is already recorded for this company. Further configuration belongs in the relevant module.
                </p>
              ) : null}
            </section>
          </aside>
        </form>
      </main>
    </>
  );
}
