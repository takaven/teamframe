import { redirect } from "next/navigation";
import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { listDocumentRequirementsForEmployee } from "@/services/documentService";
import { listUnacknowledgedForEmployee } from "@/services/policyService";
import { getMyCheckInState } from "@/services/earlyEmploymentService";
import { getManagerDashboard } from "@/services/managerService";
import { listOnboardingTasksForEmployee } from "@/services/onboardingService";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { submitOnboardingCheckInAction } from "@/app/onboarding/actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  check_in_submitted: "Thanks — your 30-day check-in was submitted.",
  task_completed: "Onboarding task completed.",
  leave_submitted: "Your time-off request was submitted.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet. Ask your admin.",
  INVALID_INPUT: "Check the details and try again.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function humanLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  const known: Record<string, string> = {
    medical_fitness: "Medical fitness certificate",
    employment_contract: "Employment contract",
    emirates_id: "Emirates ID",
    right_to_work: "Right-to-work document",
  };
  return known[normalized] ?? normalized.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function formatDay(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

async function optionalManagerDashboard(actor: Awaited<ReturnType<typeof requireTenantActor>>) {
  try {
    return await getManagerDashboard(actor);
  } catch (error) {
    if (error instanceof Error && ["MANAGER_NOT_ACTIVE", "NO_EMPLOYEE_RECORD"].includes(error.message)) return null;
    throw error;
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;
  if (actor.role === "admin") redirect("/dashboard");

  if (!actor.employeeId) {
    return <main className="mx-auto max-w-3xl px-6 py-14"><AppShell actor={actor} activePath="/home" /><EmptyState className="mt-8" message="Your account is not linked to an employee profile." hint="Ask your admin to add you as an employee." /></main>;
  }

  const [requirements, policies, checkIn, onboarding, manager] = await Promise.all([
    listDocumentRequirementsForEmployee(actor, actor.employeeId),
    listUnacknowledgedForEmployee(actor),
    getMyCheckInState(actor),
    listOnboardingTasksForEmployee(actor, actor.employeeId),
    optionalManagerDashboard(actor),
  ]);
  const documents = requirements.filter((item) => !["accepted", "replaced", "cancelled"].includes(item.state));
  const onboardingTasks = onboarding.filter((item) => item.status === "pending");
  const managerProbation = manager?.probationReviews.filter((item) => !item.manager_input) ?? [];
  const managerWorkCount = manager ? manager.pendingLeaves.length + manager.onboardingTasks.length + managerProbation.length + manager.offboardingItems.length : 0;
  const personalCount = documents.length + policies.length + onboardingTasks.length + (checkIn.state === "available" ? 1 : 0);
  const total = personalCount + managerWorkCount;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <AppShell actor={actor} activePath="/home" />
      <header className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Home</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">What you need to do</h1>
        <p className="mt-1 text-[14px] text-ink-500">{manager ? "Your team decisions and personal tasks in one place." : "Your tasks, documents and time off in one place."}</p>
      </header>
      {successMessage ? <p role="status" aria-live="polite" className="mt-6 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">{successMessage}</p> : null}
      {errorMessage ? <p role="alert" className="mt-6 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">{errorMessage}</p> : null}

      <section className="mt-7 tf-surface-flat" aria-labelledby="home-attention">
        <div className="border-b border-ink-200 px-5 py-4">
          <h2 id="home-attention" className="tf-h2">Needs your attention</h2>
          <p className="mt-1 text-[13px] text-ink-500">{total === 0 ? "You're up to date." : `${total} ${total === 1 ? "item" : "items"} to complete.`}</p>
        </div>
        {total === 0 ? <p className="px-5 py-5 text-[14px] text-ink-500">Nothing needs action right now.</p> : (
          <ul className="divide-y divide-ink-100">
            {manager?.pendingLeaves.map((leave) => <li key={`leave-${leave.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[14px] font-medium">Review {leave.employee_full_name}&apos;s time off</p><p className="text-[12px] text-ink-500">{formatDay(leave.start_date)} to {formatDay(leave.end_date)}</p></div><Link href={`/manager#leave-${leave.id}`} className="tf-secondary-action px-3 py-1.5 text-[12px]">Review request</Link></li>)}
            {manager?.onboardingTasks.map((task) => <li key={`manager-task-${task.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[14px] font-medium">{task.title}</p><p className="text-[12px] text-ink-500">Manager-owned onboarding{task.due_date ? ` · Due ${formatDay(task.due_date)}` : ""}</p></div><Link href={`/manager#onboarding-${task.id}`} className="tf-secondary-action px-3 py-1.5 text-[12px]">Open task</Link></li>)}
            {managerProbation.map((review) => <li key={`probation-${review.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[14px] font-medium">Probation recommendation</p><p className="text-[12px] text-ink-500">Due {formatDay(review.review_due_date)}</p></div><Link href={`/manager#probation-${review.id}`} className="tf-secondary-action px-3 py-1.5 text-[12px]">Review probation</Link></li>)}
            {manager?.offboardingItems.map((item) => <li key={`offboarding-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[14px] font-medium">{item.title}</p><p className="text-[12px] text-ink-500">Handover{item.due_date ? ` · Due ${formatDay(item.due_date)}` : ""}</p></div><Link href={`/manager#offboarding-${item.id}`} className="tf-secondary-action px-3 py-1.5 text-[12px]">Open task</Link></li>)}
            {documents.map((document) => <li key={`document-${document.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[14px] font-medium">Upload {humanLabel(document.document_type)}</p><p className="text-[12px] text-ink-500">{document.due_date ? `Due ${formatDay(document.due_date)}` : "Requested by your HR team"}</p></div><Link href={`/documents-and-policies#documents`} className="tf-secondary-action px-3 py-1.5 text-[12px]">Upload document</Link></li>)}
            {policies.map((policy) => <li key={`policy-${policy.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[14px] font-medium">Acknowledge {policy.title}</p><p className="text-[12px] text-ink-500">Version {policy.version}{policy.effective_date ? ` · Effective ${formatDay(policy.effective_date)}` : ""}</p></div><Link href="/documents-and-policies#policies" className="tf-secondary-action px-3 py-1.5 text-[12px]">View policy</Link></li>)}
            {onboardingTasks.map((task) => <li key={`own-task-${task.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[14px] font-medium">{task.title}</p><p className="text-[12px] text-ink-500">Onboarding{task.due_date ? ` · Due ${formatDay(task.due_date)}` : ""}</p></div><Link href="/onboarding" className="tf-secondary-action px-3 py-1.5 text-[12px]">Open task</Link></li>)}
            {checkIn.state === "available" ? <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[14px] font-medium">Complete your 30-day check-in</p><p className="text-[12px] text-ink-500">Share your first-month feedback.</p></div><a href="#check-in" className="tf-secondary-action px-3 py-1.5 text-[12px]">Start check-in</a></li> : null}
          </ul>
        )}
      </section>

      {manager && manager.upcoming.length > 0 ? <section className="mt-6 tf-surface-flat"><div className="border-b border-ink-200 px-5 py-4"><h2 className="tf-h2">Coming up</h2><p className="mt-1 text-[13px] text-ink-500">Your team over the next 60 days.</p></div><ul className="divide-y divide-ink-100">{manager.upcoming.slice(0, 6).map((item) => <li key={item.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[120px_1fr]"><p className="text-[12px] font-medium text-ink-600">{formatDay(item.date)}</p><p className="text-[14px]">{item.employee_name ? `${item.employee_name} · ` : ""}{item.label}</p></li>)}</ul></section> : null}

      {checkIn.state === "available" ? <section id="check-in" className="mt-6 scroll-mt-6 tf-surface-flat"><div className="border-b border-ink-200 px-5 py-4"><h2 className="tf-h2">30-day check-in</h2><p className="mt-1 text-[13px] text-ink-500">Share factual first-month feedback so the team can remove any blockers.</p></div><form action={submitOnboardingCheckInAction} className="grid gap-4 px-5 py-4"><input type="hidden" name="check_in_id" value={checkIn.checkIn.id} />{([['role_clarity','Role and priorities'],['manager_team_clarity','Manager and team clarity'],['training_clear','Onboarding information'],['policies_clear','Policies and processes']] as const).map(([name,label]) => <label key={name} className="grid gap-1 text-[13px] text-ink-700">{label}<select name={name} required defaultValue="mostly_clear" className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]"><option value="clear">Clear</option><option value="mostly_clear">Mostly clear</option><option value="unclear">Unclear</option><option value="needs_help">I need help</option></select></label>)}{([['tools_ready','I have the tools and access I need'],['support_available','I know where to get support'],['has_blockers','Something is blocking my work']] as const).map(([name,label]) => <label key={name} className="grid gap-1 text-[13px] text-ink-700">{label}<select name={name} required defaultValue={name === 'has_blockers' ? 'no' : 'yes'} className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]"><option value="yes">Yes</option><option value="no">No</option></select></label>)}<label className="grid gap-1 text-[13px] text-ink-700">What would improve onboarding?<textarea name="improvement_note" rows={3} className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]" placeholder="Optional note" /></label><PendingSubmitButton idleLabel="Submit check-in" pendingLabel="Submitting…" className="w-full tf-primary-action px-4 py-2 text-[14px] font-medium sm:w-fit" /></form></section> : null}
    </main>
  );
}
