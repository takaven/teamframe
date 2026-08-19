import { redirect } from "next/navigation";
import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { getEmployeeMasterRecord } from "@/services/employeeMasterService";
import { listDocumentRequirementsForEmployee } from "@/services/documentService";
import { listUnacknowledgedForEmployee, type PolicyRecord } from "@/services/policyService";
import { getMyCheckInState } from "@/services/earlyEmploymentService";
import { getManagerDashboard } from "@/services/managerService";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EmployeeSelfRecord } from "@/components/EmployeeSelfRecord";
import { DocumentsChecklist } from "@/components/DocumentsChecklist";
import { acknowledgePolicyAction, downloadPolicyFileAction } from "@/app/policies/actions";
import { submitOnboardingCheckInAction } from "@/app/onboarding/actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  policy_acknowledged: "Policy acknowledged. Thank you.",
  document_uploaded: "Document uploaded.",
  profile_updated: "Your details were saved.",
  payment_updated: "Payment details saved.",
  photo_updated: "Profile photo updated.",
  check_in_submitted: "Thanks — your 30-day check-in was submitted.",
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet. Ask your admin.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  INVALID_INPUT: "Some details were not valid. Check the fields and try again.",
  PHOTO_UNSUPPORTED_TYPE: "Profile photos must be PNG, JPEG or WebP.",
  PHOTO_TOO_LARGE: "Profile photos must be 5 MB or smaller.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

async function getOptionalManagerDashboard(actor: Awaited<ReturnType<typeof requireTenantActor>>) {
  try {
    return await getManagerDashboard(actor);
  } catch (error) {
    if (error instanceof Error && ["MANAGER_NOT_ACTIVE", "NO_EMPLOYEE_RECORD"].includes(error.message)) {
      return { directReports: [], pendingLeaves: [], onboardingTasks: [], probationReviews: [] };
    }
    throw error;
  }
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

  if (actor.role === "admin") redirect("/dashboard");

  if (!actor.employeeId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <AppShell actor={actor} activePath="/me" />
        <EmptyState className="mt-8" message="Your account is not yet linked to an employee profile." hint="Ask your admin to add you as an employee." />
      </main>
    );
  }

  const [record, unacknowledgedPolicies, checkInState, documentRequirements, managerDashboard]: [
    Awaited<ReturnType<typeof getEmployeeMasterRecord>>,
    PolicyRecord[],
    Awaited<ReturnType<typeof getMyCheckInState>>,
    Awaited<ReturnType<typeof listDocumentRequirementsForEmployee>>,
    Awaited<ReturnType<typeof getOptionalManagerDashboard>>,
  ] = await Promise.all([
    getEmployeeMasterRecord(actor, actor.employeeId),
    listUnacknowledgedForEmployee(actor),
    getMyCheckInState(actor),
    listDocumentRequirementsForEmployee(actor, actor.employeeId),
    getOptionalManagerDashboard(actor),
  ]);
  const isManager = managerDashboard.directReports.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <AppShell actor={actor} activePath="/me" />

      <div className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">My profile</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">{record.identity.full_name}</h1>
        <p className="mt-1 text-[16px] text-ink-700">{record.employment.role_title} · {record.employment.department}</p>
      </div>

      {successMessage ? <p className="mt-6 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">{successMessage}</p> : null}
      {errorMessage ? <p role="alert" className="mt-6 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">{errorMessage}</p> : null}

      <div className="mt-7">
        <EmployeeSelfRecord record={record} />
      </div>

      <section id="documents" className="mt-6 rounded-xl border border-ink-300/70 bg-white/80 p-5">
        <h2 className="text-[15px] font-bold tracking-tight text-ink-800">Documents</h2>
        <p className="mt-1 text-[13px] text-ink-500">Upload requested evidence here. TeamFrame records receipt and closes matching obligations where evidence is configured.</p>
        <div className="mt-4">
          <DocumentsChecklist requirements={documentRequirements} />
        </div>
      </section>

      {unacknowledgedPolicies.length > 0 ? (
        <section id="policies" className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
          <div className="border-b border-ink-200 px-5 py-4">
            <h2 className="text-[15px] font-bold tracking-tight text-ink-800">Policies to acknowledge — <span className="font-mono tabular-nums">{unacknowledgedPolicies.length}</span></h2>
            <p className="mt-1 text-[13px] text-ink-500">Read each policy, then confirm you have understood it. Your acknowledgement is recorded.</p>
          </div>
          <ul className="divide-y divide-ink-100">
            {unacknowledgedPolicies.map((policy) => (
              <li key={policy.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[15px] font-medium text-ink-900">{policy.title} <span className="font-mono text-[12px] tabular-nums text-ink-500">v{policy.version}</span></p>
                    {policy.effective_date ? <p className="text-[12px] text-ink-500">Effective <span className="font-mono tabular-nums">{formatDay(policy.effective_date)}</span></p> : null}
                    {policy.file_original_name ? (
                      <form action={downloadPolicyFileAction}>
                        <input type="hidden" name="policy_id" value={policy.id} />
                        <input type="hidden" name="return_to" value="/me" />
                        <button type="submit" className="text-[12px] text-accent underline underline-offset-2">Open policy document</button>
                      </form>
                    ) : null}
                    {policy.body ? (
                      <details>
                        <summary className="cursor-pointer text-[12px] text-ink-500 hover:text-ink-900">Read policy text</summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-md border border-ink-200 bg-ink-50/60 px-3 py-2 text-[13px] text-ink-700">{policy.body}</p>
                      </details>
                    ) : null}
                  </div>
                  <form action={acknowledgePolicyAction} className="w-full sm:w-auto">
                    <input type="hidden" name="policy_id" value={policy.id} />
                    <input type="hidden" name="policy_version" value={policy.version} />
                    <input type="hidden" name="return_to" value="/me" />
                    <ConfirmSubmitButton idleLabel="I acknowledge" pendingLabel="Recording…" confirmMessage={`Acknowledge "${policy.title}" v${policy.version}? This confirms you have read and understood it.`} className="w-full rounded-lg bg-brand-signal px-4 py-1.5 text-[13px] font-medium text-ink-800 sm:w-auto" />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {checkInState.state === "not_yet_due" ? (
        <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <h2 className="text-[15px] font-bold tracking-tight text-ink-800">30-day check-in</h2>
          <p className="mt-1 text-[13px] text-ink-500">Your check-in opens on <span className="font-mono tabular-nums">{formatDay(checkInState.checkIn.due_date)}</span> — nothing to do yet.</p>
        </section>
      ) : null}

      {checkInState.state === "submitted" ? (
        <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <h2 className="text-[15px] font-bold tracking-tight text-ink-800">30-day check-in</h2>
          <p className="mt-1 text-[13px] text-ink-500">Submitted{checkInState.checkIn.submitted_at ? <> on <span className="font-mono tabular-nums">{formatDay(checkInState.checkIn.submitted_at)}</span></> : null}. Thank you — no further action needed.</p>
        </section>
      ) : null}

      {checkInState.state === "available" ? (
        <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
          <div className="border-b border-ink-200 px-5 py-4">
            <h2 className="text-[15px] font-bold tracking-tight text-ink-800">30-day check-in</h2>
            <p className="mt-1 text-[13px] text-ink-500">Share factual first-month feedback so the team can remove any blockers.</p>
          </div>
          <form action={submitOnboardingCheckInAction} className="grid gap-4 px-5 py-4">
            <input type="hidden" name="check_in_id" value={checkInState.checkIn.id} />
            {([
              ["role_clarity", "Role and priorities"],
              ["manager_team_clarity", "Manager and team clarity"],
              ["training_clear", "Onboarding information"],
              ["policies_clear", "Policies and processes"],
            ] as const).map(([name, label]) => (
              <label key={name} className="grid gap-1 text-[13px] text-ink-700">
                {label}
                <select name={name} required defaultValue="mostly_clear" className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]">
                  <option value="clear">Clear</option>
                  <option value="mostly_clear">Mostly clear</option>
                  <option value="unclear">Unclear</option>
                  <option value="needs_help">I need help</option>
                </select>
              </label>
            ))}
            {([
              ["tools_ready", "I have the tools and access I need"],
              ["support_available", "I know where to get support"],
              ["has_blockers", "Something is blocking my work"],
            ] as const).map(([name, label]) => (
              <label key={name} className="grid gap-1 text-[13px] text-ink-700">
                {label}
                <select name={name} required defaultValue={name === "has_blockers" ? "no" : "yes"} className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            ))}
            <label className="grid gap-1 text-[13px] text-ink-700">
              What would improve onboarding?
              <textarea name="improvement_note" rows={3} className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]" placeholder="Optional note" />
            </label>
            <PendingSubmitButton
              idleLabel="Submit check-in"
              pendingLabel="Submitting..."
              className="w-full rounded-lg bg-brand-signal px-4 py-2 text-[14px] font-medium text-ink-800 transition hover:bg-[#B4DD00] disabled:cursor-not-allowed disabled:bg-ink-300 sm:w-fit"
            />
          </form>
        </section>
      ) : null}

      {isManager ? (
        <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-ink-800">My Team</h2>
              <p className="mt-1 text-[13px] text-ink-500">Your direct reports — leave decisions, onboarding, and probation input.</p>
            </div>
            <Link href="/manager" className="rounded-lg bg-brand-signal px-4 py-2 text-[13px] font-medium text-ink-800">Open My Team</Link>
          </div>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/onboarding" className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 hover:border-ink-900">View onboarding</Link>
        <Link href="/leaves" className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 hover:border-ink-900">Request leave</Link>
      </div>
    </main>
  );
}
