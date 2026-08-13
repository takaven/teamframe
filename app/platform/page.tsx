import { redirect } from "next/navigation";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requirePlatformOwnerAal2 } from "@/middleware/rbac";
import { loadPlatformOverview } from "@/services/platformService";
import { listPlatformOwnerState } from "@/services/platformOwnerService";
import {
  enterCompanyAction,
  nominatePlatformOwnerTransferAction,
  revokePlatformOwnerAction,
  updateCompanyStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  MFA_REQUIRED: "Verify your authenticator before using Platform Owner controls.",
  FORBIDDEN: "This account cannot perform that Platform Owner action.",
  LAST_PLATFORM_OWNER_REQUIRED: "At least one active Platform Owner must remain.",
};

function statusTone(status: string): string {
  if (status === "active" || status === "complete") return "border-brand-signal/60 bg-white text-ink-800";
  if (status === "overdue" || status === "failed") return "border-red-200 bg-red-50 text-red-900";
  return "border-ink-200 bg-ink-50 text-ink-700";
}

export default async function PlatformPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; status?: string }>;
}) {
  let actor: Awaited<ReturnType<typeof requirePlatformOwnerAal2>>;
  try {
    actor = await requirePlatformOwnerAal2();
  } catch (error) {
    if (error instanceof Error && error.message === "MFA_REQUIRED") redirect("/platform/mfa");
    throw error;
  }
  const [overview, ownerState] = await Promise.all([
    loadPlatformOverview(actor),
    listPlatformOwnerState(actor),
  ]);
  const params = (await searchParams) ?? {};
  const error = params.error ? ERROR_COPY[params.error] ?? "Platform action failed." : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <section className="tf-page-header">
        <div>
          <p className="tf-section-kicker">Platform Owner</p>
          <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-extrabold tracking-tight text-ink-800">
            Control Room
          </h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-7 text-ink-600">
            Provision, recover and support customer workspaces without being modelled as a customer employee.
          </p>
        </div>
      </section>

      {error ? <section className="tf-card mb-5 border-red-200 bg-red-50 text-[14px] text-red-900">{error}</section> : null}
      {params.status ? <section className="tf-card mb-5 text-[14px] text-ink-800">Platform state updated.</section> : null}

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Companies", overview.totals.companies],
          ["Active", overview.totals.active],
          ["Suspended", overview.totals.suspended],
          ["Closed", overview.totals.closed],
          ["Setup overdue", overview.totals.overdue_setups],
          ["Failures", overview.totals.automation_failures + overview.totals.export_failures],
        ].map(([label, value]) => (
          <article key={label} className="tf-card">
            <p className="tf-section-kicker">{label}</p>
            <p className="mt-3 text-3xl font-extrabold text-ink-800">{value}</p>
          </article>
        ))}
      </section>

      <section className="tf-card mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="tf-section-kicker">Companies</p>
            <h2 className="text-2xl font-extrabold text-ink-800">Customer workspaces</h2>
          </div>
          <p className="max-w-md text-[13px] leading-6 text-ink-600">
            Opening a workspace preserves Platform Owner identity and audit attribution.
          </p>
        </div>

        <div className="mt-5 divide-y divide-ink-100">
          {overview.companies.map((company) => (
            <article key={company.id} className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[17px] font-extrabold text-ink-800">{company.name}</h3>
                  <span className={`rounded-full border px-2 py-1 text-[12px] font-bold ${statusTone(company.status)}`}>{company.status}</span>
                  <span className={`rounded-full border px-2 py-1 text-[12px] font-bold ${statusTone(company.setup_sla)}`}>{company.setup_sla.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink-500">{company.slug}</p>
                <dl className="mt-4 grid gap-3 text-[13px] text-ink-600 md:grid-cols-4">
                  <div><dt className="font-bold text-ink-800">Employees</dt><dd>{company.employee_count}</dd></div>
                  <div><dt className="font-bold text-ink-800">Memberships</dt><dd>{company.membership_count}</dd></div>
                  <div><dt className="font-bold text-ink-800">Automation failures</dt><dd>{company.automation_failures}</dd></div>
                  <div><dt className="font-bold text-ink-800">Export failures</dt><dd>{company.export_failures}</dd></div>
                </dl>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <form action={enterCompanyAction}>
                  <input type="hidden" name="company_id" value={company.id} />
                  <PendingSubmitButton idleLabel="Open workspace" pendingLabel="Opening..." className="tf-primary-action w-full px-3 py-2 text-[13px]" />
                </form>
                {(["active", "suspended", "closed"] as const).map((status) => (
                  <form key={status} action={updateCompanyStatusAction}>
                    <input type="hidden" name="company_id" value={company.id} />
                    <input type="hidden" name="status" value={status} />
                    <PendingSubmitButton idleLabel={status} pendingLabel="Saving..." className="w-full border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-800" />
                  </form>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="tf-card mt-5">
        <p className="tf-section-kicker">Platform owners</p>
        <h2 className="text-2xl font-extrabold text-ink-800">Operator access</h2>
        <div className="mt-5 divide-y divide-ink-100">
          {ownerState.owners.map((owner) => (
            <article key={owner.auth_user_id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <p className="text-[16px] font-extrabold text-ink-800">{owner.display_name}</p>
                <p className="mt-1 text-[13px] text-ink-500">{owner.email}</p>
              </div>
              {owner.active && !owner.revoked_at ? (
                <form action={revokePlatformOwnerAction}>
                  <input type="hidden" name="auth_user_id" value={owner.auth_user_id} />
                  <PendingSubmitButton idleLabel="Revoke" pendingLabel="Revoking..." className="border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-800" />
                </form>
              ) : null}
            </article>
          ))}
        </div>

        <form action={nominatePlatformOwnerTransferAction} className="mt-5 grid gap-3 md:grid-cols-3">
          <input name="replacement_display_name" placeholder="Name" required className="rounded-lg border border-ink-200 px-3 py-2 text-[14px]" />
          <input name="replacement_email" type="email" placeholder="email@company.com" required className="rounded-lg border border-ink-200 px-3 py-2 text-[14px]" />
          <input name="replacement_auth_user_id" placeholder="Auth user id, if known" className="rounded-lg border border-ink-200 px-3 py-2 text-[14px]" />
          <PendingSubmitButton idleLabel="Create transfer" pendingLabel="Creating..." className="tf-primary-action md:col-span-3" />
        </form>
      </section>
    </main>
  );
}
