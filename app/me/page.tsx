import { redirect } from "next/navigation";
import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { getEmployee } from "@/services/employeeService";
import { listUnacknowledgedForEmployee, type PolicyRecord } from "@/services/policyService";
import { listMyOnboardingCheckIns } from "@/services/earlyEmploymentService";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { acknowledgePolicyAction } from "@/app/policies/actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  task_completed: "Onboarding task marked complete.",
  leave_submitted: "Leave request submitted.",
  policy_acknowledged: "Policy acknowledged. Thank you.",
  check_in_submitted: "30-day check-in submitted.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet. Ask your admin.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  STALE_WRITE: "This policy changed. Refresh and try again.",
  INVALID_INPUT: "Something was wrong with that request. Refresh and try again.",
  POLICY_NOT_FOUND: "That policy could not be found.",
  POLICY_NOT_PUBLISHED: "That policy is no longer active, so no acknowledgement is needed.",
  POLICY_ACKNOWLEDGE_FAILED: "Could not record your acknowledgement.",
  CHECK_IN_SUBMIT_FAILED: "Could not submit check-in.",
  AUDIT_LOG_FAILED: "Could not record required audit trail. No change was applied.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role === "admin") {
    redirect("/dashboard");
  }

  if (!actor.employeeId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <AppShell actor={actor} activePath="/me" />
        <EmptyState
          className="mt-8"
          message="Your account is not yet linked to an employee profile."
          hint="Ask your admin to add you as an employee."
        />
      </main>
    );
  }

  const [employee, unacknowledgedPolicies, checkIns]: [
    Awaited<ReturnType<typeof getEmployee>>,
    PolicyRecord[],
    Awaited<ReturnType<typeof listMyOnboardingCheckIns>>,
  ] = await Promise.all([
    getEmployee(actor, actor.employeeId),
    listUnacknowledgedForEmployee(actor),
    listMyOnboardingCheckIns(actor),
  ]);
  const openCheckIn = checkIns.find((checkIn) => checkIn.status === "scheduled");

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <AppShell actor={actor} activePath="/me" />

      {successMessage ? (
        <p className="mt-0 mb-6 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="mt-0 mb-6 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">My profile</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">
          {employee.full_name}
        </h1>
        <p className="mt-1 text-[16px] text-ink-700">
          {employee.role_title} · {employee.department}
        </p>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <dt className="text-[12px] text-ink-500">Start date</dt>
          <dd className="mt-1 font-mono text-[16px] tabular-nums text-ink-900">{formatDate(employee.start_date)}</dd>
        </div>
        <div className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <dt className="text-[12px] text-ink-500">Employment type</dt>
          <dd className="mt-1 text-[16px] text-ink-900 capitalize">
            {employee.employment_type.replace(/_/g, " ")}
          </dd>
        </div>
        {employee.country ? (
          <div className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <dt className="text-[12px] text-ink-500">Country</dt>
            <dd className="mt-1 text-[16px] text-ink-900">{employee.country}</dd>
          </div>
        ) : null}
      </dl>

      <section id="documents" className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
        <h2 className="text-[17px] font-bold tracking-tight text-ink-800">Documents</h2>
        <p className="mt-2 text-[14px] text-ink-500">
          Your admin manages private employment documents in the employee record. Ask them to update anything that looks missing or out of date.
        </p>
      </section>

      {openCheckIn ? (
        <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <h2 className="text-[17px] font-bold tracking-tight text-ink-800">30-day check-in</h2>
          <p className="mt-2 text-[14px] text-ink-500">
            Your check-in is ready on the onboarding page.
          </p>
          <Link
            href="/onboarding"
            className="mt-4 inline-flex rounded-lg bg-brand-signal px-4 py-2 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F]"
          >
            Complete check-in
          </Link>
        </section>
      ) : null}

      {unacknowledgedPolicies.length > 0 ? (
        <section id="policies" className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
          <div className="border-b border-ink-300/60 px-5 py-4">
            <h2 className="text-[17px] font-medium tracking-tight">
              Policies to acknowledge — <span className="font-mono tabular-nums">{unacknowledgedPolicies.length}</span>
            </h2>
            <p className="mt-1 text-[13px] text-ink-500">
              Read each policy, then confirm you have understood it. Your acknowledgement is recorded.
            </p>
          </div>
          <ul className="divide-y divide-ink-300/40">
            {unacknowledgedPolicies.map((policy) => (
              <li key={policy.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[15px] text-ink-900 font-medium">
                      {policy.title}{" "}
                      <span className="font-mono text-[12px] tabular-nums text-ink-500 font-normal">v{policy.version}</span>
                    </p>
                    <details>
                      <summary className="cursor-pointer text-[12px] text-ink-500 hover:text-ink-900 transition">
                        Read policy text
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap rounded-md border border-ink-300/50 bg-ink-100/40 px-3 py-2 text-[13px] text-ink-700">
                        {policy.body}
                      </p>
                    </details>
                  </div>
                  <form action={acknowledgePolicyAction} className="w-full sm:w-auto">
                    <input type="hidden" name="policy_id" value={policy.id} />
                    <input type="hidden" name="policy_version" value={policy.version} />
                    <input type="hidden" name="return_to" value="/me" />
                    <ConfirmSubmitButton
                      idleLabel="I acknowledge"
                      pendingLabel="Recording…"
                      confirmMessage={`Acknowledge "${policy.title}" v${policy.version}? This confirms you have read and understood it.`}
                      className="w-full rounded-lg bg-brand-signal px-4 py-1.5 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300 sm:w-auto"
                    />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/onboarding"
          className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
        >
          View onboarding
        </Link>
        <Link
          href="/leaves"
          className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
        >
          Request leave
        </Link>
      </div>
    </main>
  );
}
