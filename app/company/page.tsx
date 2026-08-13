import { AppShell } from "@/components/AppShell";
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
      <section className="tf-page-header">
        <div>
          <p className="tf-section-kicker">Company</p>
          <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-extrabold tracking-tight text-ink-800">
            Holiday calendar
          </h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-7 text-ink-600">
            Maintain the manual company holiday dates used by leave calculations. TeamFrame does not infer statutory
            holidays from country or external feeds.
          </p>
        </div>
      </section>

      {error ? (
        <section className="tf-card mb-5 border-red-200 bg-red-50 text-[14px] text-red-900">{error}</section>
      ) : null}
      {params.status ? (
        <section className="tf-card mb-5 border-brand-signal/50 bg-white text-[14px] text-ink-800">
          Holiday calendar updated.
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="tf-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="tf-section-kicker">Year</p>
              <h2 className="text-2xl font-extrabold text-ink-800">{year} holidays</h2>
            </div>
            <form className="flex items-center gap-2" action="/company">
              <label className="text-[13px] font-bold text-ink-700">
                View year
                <select name="year" defaultValue={year} className="ml-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px]">
                  {years.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px] font-bold text-ink-800">
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
                    <input
                      name="holiday_date"
                      type="date"
                      defaultValue={holiday.holiday_date}
                      required
                      className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px] text-ink-800"
                    />
                    <input
                      name="name"
                      defaultValue={holiday.name}
                      required
                      maxLength={160}
                      className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px] text-ink-800"
                    />
                    <PendingSubmitButton idleLabel="Save" pendingLabel="Saving..." className="border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-800" />
                  </form>
                  <form action={deleteHolidayAction}>
                    <input type="hidden" name="holiday_id" value={holiday.id} />
                    <input type="hidden" name="year" value={year} />
                    <PendingSubmitButton idleLabel="Remove" pendingLabel="Removing..." className="border border-red-200 bg-white px-3 py-2 text-[13px] text-red-900" />
                  </form>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="tf-card h-fit">
          <p className="tf-section-kicker">Add holiday</p>
          <h2 className="text-xl font-extrabold text-ink-800">Manual date</h2>
          <form action={saveHolidayAction} className="mt-5 grid gap-4">
            <input type="hidden" name="year" value={year} />
            <label className="block text-sm font-semibold text-ink-700">
              Date
              <input
                name="holiday_date"
                type="date"
                required
                className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-ink-800"
              />
            </label>
            <label className="block text-sm font-semibold text-ink-700">
              Name
              <input
                name="name"
                required
                maxLength={160}
                placeholder="Company holiday"
                className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-ink-800"
              />
            </label>
            <PendingSubmitButton idleLabel="Add holiday" pendingLabel="Adding..." className="bg-brand-signal px-3 py-2 text-[13px] font-extrabold text-ink-900" />
          </form>
        </aside>
      </section>
    </main>
  );
}
