import { AppShell } from "@/components/AppShell";
import { DateField } from "@/components/DateField";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireTenantCapability } from "@/middleware/rbac";
import { listCompanyHolidays } from "@/services/companyHolidayService";
import { deleteHolidayAction, saveHolidayAction } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission to maintain company holidays.",
  HOLIDAY_DATE_DUPLICATE: "That holiday date already exists for this company.",
  HOLIDAY_NOT_FOUND: "That holiday could not be found.",
  INVALID_INPUT: "Check the holiday date and name.",
  INVALID_YEAR: "Choose a valid year.",
};

function currentYear(): number {
  return new Date().getUTCFullYear();
}

function parseYear(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2200 ? parsed : currentYear();
}

export default async function CompanyPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; error?: string; status?: string }>;
}) {
  const actor = await requireTenantCapability("people_operations");
  const params = (await searchParams) ?? {};
  const year = parseYear(params.year);
  const holidays = await listCompanyHolidays(actor, year);
  const error = params.error ? ERROR_COPY[params.error] ?? "Company holidays could not be updated." : null;
  const years = [year - 1, year, year + 1, year + 2];

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <AppShell actor={actor} activePath="/company" />
      <div className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Company</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">Holiday calendar</h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-ink-500">
          Maintain the manual company holiday dates used by leave calculations. TeamFrame does not infer statutory
          holidays from country or external feeds.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">{error}</p>
      ) : null}
      {params.status ? (
        <p className="mt-6 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          Holiday calendar updated.
        </p>
      ) : null}

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="tf-surface-flat p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">Year</p>
              <h2 className="mt-1 tf-h2 text-ink-900">{year} holidays</h2>
            </div>
            <form className="flex items-center gap-2" action="/company">
              <label className="text-[13px] font-medium text-ink-700">
                View year
                <select name="year" defaultValue={year} className="ml-2 rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px]">
                  {years.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="tf-secondary-action px-3 py-2 text-[13px] font-medium">
                View
              </button>
            </form>
          </div>

          <div className="mt-5 divide-y divide-ink-100">
            {holidays.length === 0 ? (
              <p className="py-8 text-[14px] text-ink-500">No holidays recorded for this year.</p>
            ) : (
              holidays.map((holiday) => (
                <article key={holiday.id} className="grid gap-3 py-4 md:grid-cols-[150px_minmax(0,1fr)_auto] md:items-center">
                  <p className="text-[14px] font-extrabold text-ink-800">{holiday.holiday_date}</p>
                  <form action={saveHolidayAction} className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                    <input type="hidden" name="holiday_id" value={holiday.id} />
                    <input type="hidden" name="year" value={year} />
                    <DateField name="holiday_date" defaultValue={holiday.holiday_date} required dense />
                    <input
                      name="name"
                      defaultValue={holiday.name}
                      required
                      maxLength={160}
                      className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-800"
                    />
                    <PendingSubmitButton idleLabel="Save" pendingLabel="Saving..." className="tf-secondary-action px-3 py-2 text-[13px]" />
                  </form>
                  <form action={deleteHolidayAction}>
                    <input type="hidden" name="holiday_id" value={holiday.id} />
                    <input type="hidden" name="year" value={year} />
                    <PendingSubmitButton idleLabel="Remove" pendingLabel="Removing..." className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-700 transition hover:border-signal-red hover:text-signal-red" />
                  </form>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="h-fit tf-surface-flat p-5">
          <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">Add holiday</p>
          <h2 className="mt-1 tf-h2 text-ink-900">Manual date</h2>
          <form action={saveHolidayAction} className="mt-5 grid gap-4">
            <input type="hidden" name="year" value={year} />
            <label className="block text-[13px] font-medium text-ink-700">
              Date
              <DateField name="holiday_date" required />
            </label>
            <label className="block text-[13px] font-medium text-ink-700">
              Name
              <input
                name="name"
                required
                maxLength={160}
                placeholder="Company holiday"
                className="mt-2 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px] text-ink-800"
              />
            </label>
            <PendingSubmitButton idleLabel="Add holiday" pendingLabel="Adding..." className="tf-primary-action px-4 py-2 text-[14px] disabled:cursor-not-allowed disabled:bg-ink-300" />
          </form>
        </aside>
      </section>
    </main>
  );
}
