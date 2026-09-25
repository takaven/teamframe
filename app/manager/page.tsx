import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { StatusPill } from "@/components/StatusPill";
import { getManagerDashboard } from "@/services/managerService";
import { getEmployeeMasterRecord } from "@/services/employeeMasterService";
import { listDirectReportCheckIns } from "@/services/earlyEmploymentService";
import {
  completeManagerOffboardingItemAction,
  completeManagerOnboardingTaskAction,
  decideManagerLeaveAction,
  submitManagerProbationInputAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  leave_decided: "Leave decision recorded.",
  task_completed: "Manager-owned task completed.",
  probation_input_submitted: "Probation input submitted.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that item.",
  MANAGER_NOT_ACTIVE: "Manager access is not active for this account.",
  MANAGER_LEAVE_OVERRIDE_FORBIDDEN: "Managers cannot override insufficient annual leave. Ask an admin to review it.",
  LEAVE_INSUFFICIENT_BALANCE: "Annual leave balance is insufficient. Ask an admin to review an override if needed.",
  EVIDENCE_REQUIRED: "This task requires a document and cannot be manually completed.",
  STALE_WRITE: "This item changed. Refresh and try again.",
  INVALID_INPUT: "Check the details and try again.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function upcomingLabel(item: { label: string; date: string; end_date?: string }): string {
  return item.label === "Away" && item.end_date && item.end_date !== item.date
    ? `Away until ${formatDate(item.end_date)}`
    : item.label;
}

function days(value: number): string {
  return `${value} day${value === 1 ? "" : "s"}`;
}

function employmentStatus(lifecycle: string, status: string): string {
  if (lifecycle === "preboarding") return "Pre-start";
  if (lifecycle === "offboarding") return "Offboarding";
  if (lifecycle === "exited" || status === "inactive") return "Former";
  if (lifecycle === "on_leave" || status === "on_leave") return "On leave";
  return lifecycle === "active" ? "Active" : "Onboarding";
}

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; employee?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error, employee: employeeParam } = await searchParams;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;
  const [dashboard, reportCheckIns] = await Promise.all([
    getManagerDashboard(actor),
    listDirectReportCheckIns(actor),
  ]);
  // Manager view of a direct report. getEmployeeMasterRecord enforces manager-derived
  // people_operations: a NON-report throws FORBIDDEN, and compensation/payment stay hidden
  // (canView false) for a manager without explicit salary/finance permission.
  let reportRecord: Awaited<ReturnType<typeof getEmployeeMasterRecord>> | null = null;
  let reportError = false;
  if (employeeParam) {
    try {
      reportRecord = await getEmployeeMasterRecord(actor, employeeParam);
    } catch {
      reportError = true;
    }
  }
  const employeeMap = new Map(dashboard.directReports.map((employee) => [employee.id, employee]));
  const probationEmployeeIds = new Set(dashboard.probationReviews.map((review) => review.employee_id));
  const probationInputNeeded = dashboard.probationReviews.filter((review) => !review.manager_input);
  const hasManagerWork =
    dashboard.pendingLeaves.length > 0 ||
    dashboard.onboardingTasks.length > 0 ||
    probationInputNeeded.length > 0 ||
    dashboard.offboardingItems.length > 0;

  if (employeeParam) {
    const personTasks = dashboard.onboardingTasks.filter((item) => item.employee_id === employeeParam);
    const personProbation = dashboard.probationReviews.find((item) => item.employee_id === employeeParam);
    const personCheckIns = reportCheckIns.filter((item) => item.employee_id === employeeParam);
    const personLeave = dashboard.upcoming.filter((item) => item.kind === "leave" && item.employee_name === reportRecord?.identity.full_name);
    return (
      <main className="mx-auto max-w-5xl px-6 py-14">
        <AppShell actor={actor} activePath="/manager" />
        <Link href="/manager" className="inline-flex items-center text-[13px] font-medium text-ink-600 hover:text-ink-900">← Back to My team</Link>
        {reportRecord ? (
          <>
            <header className="mt-5 border-b border-ink-300/60 pb-5">
              <p className="text-[12px] tracking-[0.14em] text-ink-500">Direct report</p>
              <h1 className="mt-2 text-[34px] leading-tight tracking-tight">{reportRecord.identity.full_name}</h1>
              <p className="mt-1 text-[14px] text-ink-500">{reportRecord.employment.role_title} · {reportRecord.employment.department}</p>
            </header>
            <section className="mt-7 tf-surface-flat p-5">
              <h2 className="tf-h2">Current employment</h2>
              <dl className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-ink-500">Status</dt><dd className="mt-1 font-medium text-ink-900">{employmentStatus(reportRecord.employment.lifecycle_state, reportRecord.employment.status)}</dd></div>
                <div><dt className="text-ink-500">Start date</dt><dd className="mt-1 font-medium text-ink-900">{formatDate(reportRecord.employment.start_date)}</dd></div>
                <div><dt className="text-ink-500">Work location</dt><dd className="mt-1 font-medium text-ink-900">{reportRecord.employment.work_location ?? "—"}</dd></div>
                <div><dt className="text-ink-500">Employment type</dt><dd className="mt-1 font-medium text-ink-900">{reportRecord.employment.employment_type.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())}</dd></div>
              </dl>
            </section>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="tf-surface-flat p-5">
                <h2 className="tf-h2">Onboarding</h2>
                {personTasks.length ? <ul className="mt-3 divide-y divide-ink-100">{personTasks.map((task) => <li key={task.id} className="py-3"><p className="text-[13px] font-medium">{task.title}</p><p className="mt-1 text-[12px] text-ink-500">Manager-owned · Due {formatDate(task.due_date)}</p></li>)}</ul> : <p className="mt-3 text-[13px] text-ink-500">No manager-owned onboarding work is open.</p>}
              </section>
              <section className="tf-surface-flat p-5">
                <h2 className="tf-h2">Probation recommendation</h2>
                {personProbation ? <dl className="mt-3 grid gap-3 text-[13px]"><div><dt className="text-ink-500">Review due</dt><dd>{formatDate(personProbation.review_due_date)}</dd></div><div><dt className="text-ink-500">Probation ends</dt><dd>{formatDate(personProbation.probation_end_date)}</dd></div><div><dt className="text-ink-500">Status</dt><dd>{personProbation.status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())}</dd></div><div><dt className="text-ink-500">Recommendation</dt><dd>{personProbation.manager_recommended_outcome ? personProbation.manager_recommended_outcome.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) : "Not submitted"}</dd></div></dl> : <p className="mt-3 text-[13px] text-ink-500">No probation review is scheduled.</p>}
              </section>
              <section className="tf-surface-flat p-5">
                <h2 className="tf-h2">30-day check-in</h2>
                {personCheckIns.length ? <ul className="mt-3 divide-y divide-ink-100">{personCheckIns.map((item) => <li key={item.id} className="py-3 text-[13px]"><span className="font-medium">{item.status === "submitted" ? "Submitted" : "Scheduled"}</span><span className="ml-2 text-ink-500">{item.submitted_at ? formatDate(item.submitted_at) : `Due ${formatDate(item.due_date)}`}</span></li>)}</ul> : <p className="mt-3 text-[13px] text-ink-500">No check-in is currently available.</p>}
              </section>
              <section className="tf-surface-flat p-5">
                <h2 className="tf-h2">Time off</h2>
                {personLeave.length ? <ul className="mt-3 divide-y divide-ink-100">{personLeave.map((item) => <li key={item.id} className="py-3 text-[13px]"><span className="font-medium">{upcomingLabel(item)}</span><span className="ml-2 text-ink-500">from {formatDate(item.date)}</span></li>)}</ul> : <p className="mt-3 text-[13px] text-ink-500">No approved time off in the next 60 days.</p>}
              </section>
            </div>
            <section className="mt-5 tf-surface-flat p-5">
              <h2 className="tf-h2">Contact</h2>
              <dl className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-ink-500">Company email</dt><dd>{reportRecord.contact.company_email}</dd></div><div><dt className="text-ink-500">Company phone</dt><dd>{reportRecord.contact.company_phone ?? "—"}</dd></div><div><dt className="text-ink-500">Emergency contact</dt><dd>{reportRecord.emergency_contact.name ?? "—"}{reportRecord.emergency_contact.phone ? ` · ${reportRecord.emergency_contact.phone}` : ""}</dd></div></dl>
            </section>
          </>
        ) : <p className="mt-7 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">{reportError ? "You can only open current direct reports." : "Employee not found."}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <AppShell actor={actor} activePath="/manager" />

      <div className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">People</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">My team</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-500">
          Decisions and actions that need you now, followed by your direct reports.
        </p>
      </div>

      {successMessage ? (
        <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mt-7 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">
          {errorMessage}
        </p>
      ) : null}

      <section className="mt-7 tf-surface-flat">
        <div className="border-b border-ink-300/60 px-5 py-4">
          <h2 className="tf-h2">Team calendar &amp; upcoming</h2>
          <p className="mt-1 text-[13px] text-ink-500">Approved leave, new starters, probation reviews and company holidays for the next 60 days.</p>
        </div>
        {dashboard.upcoming.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-ink-500">Nothing scheduled for your team in the next 60 days.</p>
        ) : (
          <ul className="divide-y divide-ink-300/40">
            {dashboard.upcoming.map((item) => (
              <li key={item.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[120px_1fr] sm:items-center">
                <p className="text-[12px] font-medium text-ink-600">{formatDate(item.date)}</p>
                <p className="text-[14px] text-ink-900">{item.employee_name ? `${item.employee_name} · ` : ""}{upcomingLabel(item)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!hasManagerWork ? (
        <EmptyState
          className="mt-8"
          message="No manager work is assigned to you."
          hint="You're up to date. Your direct reports remain available under My Team below."
        />
      ) : (
        <>
          <div className="tf-summary mt-6">
            <div><div className="tf-summary-label">Leave</div><div className="tf-summary-value">{dashboard.pendingLeaves.length}</div></div>
            <div><div className="tf-summary-label">Onboarding</div><div className="tf-summary-value">{dashboard.onboardingTasks.length}</div></div>
            <div><div className="tf-summary-label">Probation recommendations</div><div className="tf-summary-value">{probationInputNeeded.length}</div></div>
            <div><div className="tf-summary-label">Handover</div><div className="tf-summary-value">{dashboard.offboardingItems.length}</div></div>
          </div>

          <section className="mt-7 tf-surface-flat">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="tf-h2">Pending leave</h2>
              <p className="mt-1 text-[13px] text-ink-500">Review the dates and available balance before deciding.</p>
            </div>
            {dashboard.pendingLeaves.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-ink-500">No direct-report leave requests are waiting.</p>
            ) : (
              <ul className="divide-y divide-ink-300/40">
                {dashboard.pendingLeaves.map((leave) => {
                  const annual = leave.annual_balance;
                  const shortfall = leave.leave_type === "annual" && annual?.available !== null && annual ? leave.requested_days - annual.available : 0;
                  return (
                    <li id={`leave-${leave.id}`} key={leave.id} className="scroll-mt-6 grid gap-4 px-5 py-4 lg:grid-cols-[1fr_260px]">
                      <div>
                        <p className="text-[15px] font-medium text-ink-900">{leave.employee_full_name}</p>
                        <p className="mt-1 text-[13px] text-ink-500">
                          {formatDate(leave.start_date)} to {formatDate(leave.end_date)} · {leave.leave_type.replace("_", " ")} · {days(leave.requested_days)}
                        </p>
                        {annual && leave.leave_type === "annual" ? (
                          <p className="mt-1 text-[12px] text-ink-500">
                            Annual available: <span className="tabular-nums">{days(annual.available ?? 0)}</span>
                          </p>
                        ) : null}
                        {shortfall > 0 ? (
                          <p className="mt-2 text-[12px] text-signal-red">
                            Insufficient annual leave by {days(shortfall)}. Ask an admin to review an override.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-start gap-2">
                        <form action={decideManagerLeaveAction}>
                          <input type="hidden" name="leave_id" value={leave.id} />
                          <input type="hidden" name="expected_updated_at" value={leave.updated_at} />
                          <input type="hidden" name="decision" value="rejected" />
                          <PendingSubmitButton
                            idleLabel="Decline"
                            pendingLabel="Declining…"
                            className="rounded-full border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 disabled:cursor-not-allowed disabled:text-ink-300"
                          />
                        </form>
                        <form action={decideManagerLeaveAction}>
                          <input type="hidden" name="leave_id" value={leave.id} />
                          <input type="hidden" name="expected_updated_at" value={leave.updated_at} />
                          <input type="hidden" name="decision" value="approved" />
                          <PendingSubmitButton
                            idleLabel="Approve"
                            pendingLabel="Approving…"
                            className="tf-primary-action px-4 py-1.5 text-[12px] font-medium disabled:cursor-not-allowed disabled:bg-ink-300"
                          />
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-7 grid gap-5 lg:grid-cols-2">
            <article className="tf-surface-flat">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="tf-h2">Manager-owned onboarding</h2>
              </div>
              {dashboard.onboardingTasks.length === 0 ? (
                <p className="px-5 py-4 text-[14px] text-ink-500">No manager-owned onboarding tasks are open.</p>
              ) : (
                <ul className="divide-y divide-ink-300/40">
                  {dashboard.onboardingTasks.map((task) => (
                    <li id={`onboarding-${task.id}`} key={task.id} className="scroll-mt-6 space-y-3 px-5 py-4">
                      <div>
                        <p className="text-[14px] font-medium text-ink-900">{task.title}</p>
                        <p className="mt-1 text-[12px] text-ink-500">
                          {employeeMap.get(task.employee_id)?.full_name ?? "Direct report"} · Due {formatDate(task.due_date)}
                        </p>
                      </div>
                      <form action={completeManagerOnboardingTaskAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="expected_updated_at" value={task.updated_at} />
                        <PendingSubmitButton
                          idleLabel="Mark complete"
                          pendingLabel="Saving..."
                          className="rounded-full border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:text-ink-300"
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="tf-surface-flat">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="tf-h2">Offboarding handover</h2>
                <p className="mt-1 text-[13px] text-ink-500">Only manager-owned handover tasks for current direct reports appear here.</p>
              </div>
              {dashboard.offboardingItems.length === 0 ? (
                <p className="px-5 py-4 text-[14px] text-ink-500">No manager-owned offboarding work is open.</p>
              ) : (
                <ul className="divide-y divide-ink-300/40">
                  {dashboard.offboardingItems.map((item) => (
                    <li id={`offboarding-${item.id}`} key={item.id} className="scroll-mt-6 space-y-3 px-5 py-4">
                      <div>
                        <p className="text-[14px] font-medium text-ink-900">{item.title}</p>
                        <p className="mt-1 text-[12px] text-ink-500">
                          {employeeMap.get(item.employee_id)?.full_name ?? "Direct report"} · Due {formatDate(item.due_date)}
                        </p>
                      </div>
                      <form action={completeManagerOffboardingItemAction}>
                        <input type="hidden" name="task_id" value={item.id} />
                        <input type="hidden" name="expected_updated_at" value={item.updated_at} />
                        <PendingSubmitButton
                          idleLabel="Mark complete"
                          pendingLabel="Saving..."
                          className="rounded-full border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:text-ink-300"
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="tf-surface-flat">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="tf-h2">Probation recommendations</h2>
                <p className="mt-1 text-[13px] text-ink-500">Share your recommendation; an admin records the final outcome.</p>
              </div>
              {probationInputNeeded.length === 0 ? (
                <p className="px-5 py-4 text-[14px] text-ink-500">No probation input is waiting.</p>
              ) : (
                <ul className="divide-y divide-ink-300/40">
                  {probationInputNeeded.map((review) => (
                    <li id={`probation-${review.id}`} key={review.id} className="scroll-mt-6 space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-medium text-ink-900">
                            {employeeMap.get(review.employee_id)?.full_name ?? "Direct report"}
                          </p>
                          <p className="mt-1 text-[12px] text-ink-500">
                            Review due {formatDate(review.review_due_date)} · Probation ends {formatDate(review.probation_end_date)}
                          </p>
                        </div>
                        <StatusPill tone={review.manager_input ? "green" : "amber"}>
                          {review.manager_input ? "Input sent" : "Input needed"}
                        </StatusPill>
                      </div>
                      <form action={submitManagerProbationInputAction} className="grid gap-2">
                        <input type="hidden" name="review_id" value={review.id} />
                        <label className="grid gap-1 text-[12px] text-ink-500">
                          Recommendation
                          <select
                            name="recommended_outcome"
                            defaultValue={review.manager_recommended_outcome ?? ""}
                            className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px] text-ink-900"
                          >
                            <option value="">— No recommendation yet</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="unsuccessful">Unsuccessful</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-[12px] text-ink-500">
                          Reason / notes
                          <textarea
                            name="input"
                            rows={3}
                            required
                            defaultValue={review.manager_input ?? ""}
                            className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px] text-ink-900"
                          />
                        </label>
                        <p className="text-[11px] text-ink-500">A recommendation only — the final probation outcome is recorded by an admin.</p>
                        <PendingSubmitButton
                          idleLabel={review.manager_input ? "Update recommendation" : "Submit recommendation"}
                          pendingLabel="Saving..."
                          className="w-fit tf-primary-action px-4 py-2 text-[13px] font-medium disabled:bg-ink-300"
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          {reportCheckIns.length > 0 ? (
            <section className="mt-7 tf-surface-flat">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="tf-h2">30-day check-ins</h2>
                <p className="mt-1 text-[13px] text-ink-500">Submitted first-month feedback from your direct reports. Read-only.</p>
              </div>
              <ul className="divide-y divide-ink-300/40">
                {reportCheckIns.map((checkIn) => (
                  <li key={checkIn.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[14px] font-medium text-ink-900">{checkIn.employee_full_name}</p>
                      <p className="text-[12px] text-ink-500">Submitted {formatDate(checkIn.submitted_at)}</p>
                    </div>
                    {checkIn.responses ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[12px] text-ink-500 hover:text-ink-900">View responses</summary>
                        <dl className="mt-2 grid gap-1 text-[12px]">
                          {checkIn.questions.map((q) => {
                            const value = checkIn.responses?.[q.key];
                            if (value === undefined || value === null || value === "") return null;
                            const shown = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value).replace(/_/g, " ");
                            return (
                              <div key={q.key} className="flex justify-between gap-4 border-b border-ink-100 py-1">
                                <dt className="text-ink-500">{q.label}</dt>
                                <dd className="text-right">{shown}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

        </>
      )}

      <section className="mt-7 tf-surface-flat">
        <div className="border-b border-ink-300/60 px-5 py-4">
          <h2 className="tf-h2">My team · {dashboard.directReports.length}</h2>
          <p className="mt-1 text-[13px] text-ink-500">Your current one-level direct reports. This directory is not a pending-work count.</p>
        </div>
        {dashboard.directReports.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-ink-500">No current direct reports.</p>
        ) : (
          <ul className="grid gap-3 p-4 sm:grid-cols-2">
            {dashboard.directReports.map((employee) => {
              const initials = employee.full_name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
              const onProbation = probationEmployeeIds.has(employee.id);
              return (
                <li key={employee.id} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[13px] font-bold text-ink-600">{initials}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink-900">{employee.full_name}</p>
                    <p className="line-clamp-2 text-[12px] leading-snug text-ink-500" title={`${employee.role_title} · ${employee.department}${employee.country ? ` · ${employee.country}` : ""}`}>
                      {employee.role_title} · {employee.department}{employee.country ? ` · ${employee.country}` : ""}
                    </p>
                    {onProbation ? (
                      <span className="mt-1 inline-block"><StatusPill tone="amber">Probation</StatusPill></span>
                    ) : null}
                  </div>
                  <Link href={`/manager?employee=${employee.id}`} className="shrink-0 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-[12px] text-ink-700 hover:border-ink-900">View</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </main>
  );
}
