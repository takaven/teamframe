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
  EVIDENCE_REQUIRED: "This task needs configured evidence and cannot be manually completed.",
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

function days(value: number): string {
  return `${value} day${value === 1 ? "" : "s"}`;
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
  const hasManagerWork =
    dashboard.directReports.length > 0 ||
    dashboard.pendingLeaves.length > 0 ||
    dashboard.onboardingTasks.length > 0 ||
    dashboard.probationReviews.length > 0 ||
    dashboard.offboardingItems.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <AppShell actor={actor} activePath="/manager" />

      <div className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Your direct reports</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">My Team</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-500">
          Your current direct reports and the work they need from you. Salary, payment details, private documents and organisation changes remain restricted.
        </p>
      </div>

      {employeeParam ? (
        <section className="mt-7 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <Link href="/manager" className="text-[13px] text-ink-600 hover:text-ink-900">← Back to My Team</Link>
          {reportRecord ? (
            <div className="mt-3">
              <h2 className="text-[20px] font-bold text-ink-900">{reportRecord.identity.full_name}</h2>
              <p className="text-[13px] text-ink-500">Direct-report record. Salary, payment details and private documents are not visible to managers.</p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-[13px]">
                <div><dt className="text-ink-500">Role / job title</dt><dd className="text-ink-900">{reportRecord.employment.role_title}</dd></div>
                <div><dt className="text-ink-500">Department</dt><dd className="text-ink-900">{reportRecord.employment.department}</dd></div>
                <div><dt className="text-ink-500">Work location</dt><dd className="text-ink-900">{reportRecord.employment.work_location ?? "—"}</dd></div>
                <div><dt className="text-ink-500">Employment type</dt><dd className="text-ink-900">{reportRecord.employment.employment_type.replace(/_/g, " ")}</dd></div>
                <div><dt className="text-ink-500">Lifecycle / status</dt><dd className="text-ink-900">{reportRecord.employment.lifecycle_state} · {reportRecord.employment.status}</dd></div>
                <div><dt className="text-ink-500">Company email</dt><dd className="text-ink-900">{reportRecord.contact.company_email}</dd></div>
                <div><dt className="text-ink-500">Company phone</dt><dd className="text-ink-900">{reportRecord.contact.company_phone ?? "—"}</dd></div>
                <div><dt className="text-ink-500">Emergency contact</dt><dd className="text-ink-900">{reportRecord.emergency_contact.name ?? "—"}{reportRecord.emergency_contact.phone ? ` · ${reportRecord.emergency_contact.phone}` : ""}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
                <span className="rounded-lg border border-dashed border-ink-300 bg-ink-50/50 px-3 py-1.5 text-ink-500">Compensation: not visible to managers</span>
                <span className="rounded-lg border border-dashed border-ink-300 bg-ink-50/50 px-3 py-1.5 text-ink-500">Payment details: not visible to managers</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">
              {reportError ? "You do not have access to that employee — managers can only open their current direct reports." : "Employee not found."}
            </p>
          )}
        </section>
      ) : null}

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

      {!hasManagerWork ? (
        <EmptyState
          className="mt-8"
          message="No manager work is assigned to you."
          hint="Manager controls appear only when current direct-report work exists."
        />
      ) : (
        <>
          <section className="mt-7 grid gap-4 sm:grid-cols-5">
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Direct reports</p>
              <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{dashboard.directReports.length}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Leave decisions</p>
              <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{dashboard.pendingLeaves.length}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Onboarding tasks</p>
              <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{dashboard.onboardingTasks.length}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Probation input</p>
              <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{dashboard.probationReviews.length}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Handover</p>
              <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{dashboard.offboardingItems.length}</p>
            </article>
          </section>

          <section className="mt-7 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">Pending leave</h2>
              <p className="mt-1 text-[13px] text-ink-500">Approval uses the same TeamFrame leave balance and overlap rules. Manager override is not available.</p>
            </div>
            {dashboard.pendingLeaves.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-ink-500">No direct-report leave requests are waiting.</p>
            ) : (
              <ul className="divide-y divide-ink-300/40">
                {dashboard.pendingLeaves.map((leave) => {
                  const annual = leave.annual_balance;
                  const shortfall = leave.leave_type === "annual" && annual?.available !== null && annual ? leave.requested_days - annual.available : 0;
                  return (
                    <li key={leave.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_260px]">
                      <div>
                        <p className="text-[15px] font-medium text-ink-900">{leave.employee_full_name}</p>
                        <p className="mt-1 text-[13px] text-ink-500">
                          {formatDate(leave.start_date)} to {formatDate(leave.end_date)} · {leave.leave_type.replace("_", " ")} · {days(leave.requested_days)}
                        </p>
                        {annual && leave.leave_type === "annual" ? (
                          <p className="mt-1 text-[12px] text-ink-500">
                            Annual available: <span className="font-mono tabular-nums">{days(annual.available ?? 0)}</span>
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
                            className="rounded-full bg-brand-signal px-4 py-1.5 text-[12px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300"
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
            <article className="rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight">Manager-owned onboarding</h2>
              </div>
              {dashboard.onboardingTasks.length === 0 ? (
                <p className="px-5 py-4 text-[14px] text-ink-500">No manager-owned onboarding tasks are open.</p>
              ) : (
                <ul className="divide-y divide-ink-300/40">
                  {dashboard.onboardingTasks.map((task) => (
                    <li key={task.id} className="space-y-3 px-5 py-4">
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

            <article className="rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight">Offboarding handover</h2>
                <p className="mt-1 text-[13px] text-ink-500">Only manager-owned handover tasks for current direct reports appear here.</p>
              </div>
              {dashboard.offboardingItems.length === 0 ? (
                <p className="px-5 py-4 text-[14px] text-ink-500">No manager-owned offboarding work is open.</p>
              ) : (
                <ul className="divide-y divide-ink-300/40">
                  {dashboard.offboardingItems.map((item) => (
                    <li key={item.id} className="space-y-3 px-5 py-4">
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

            <article className="rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight">Probation input</h2>
                <p className="mt-1 text-[13px] text-ink-500">Input only. Admin records the final probation outcome.</p>
              </div>
              {dashboard.probationReviews.length === 0 ? (
                <p className="px-5 py-4 text-[14px] text-ink-500">No probation input is waiting.</p>
              ) : (
                <ul className="divide-y divide-ink-300/40">
                  {dashboard.probationReviews.map((review) => (
                    <li key={review.id} className="space-y-3 px-5 py-4">
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
                          idleLabel={review.manager_input ? "Update input" : "Submit input"}
                          pendingLabel="Saving..."
                          className="w-fit rounded-lg bg-brand-signal px-4 py-2 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:bg-ink-300"
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          {reportCheckIns.length > 0 ? (
            <section className="mt-7 rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight">30-day check-ins</h2>
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
                                <dd className="text-right text-ink-800">{shown}</dd>
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

          <section className="mt-7 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">Direct reports</h2>
              <p className="mt-1 text-[13px] text-ink-500">Your current one-level direct reports.</p>
            </div>
            <ul className="grid gap-3 p-4 sm:grid-cols-2">
              {dashboard.directReports.map((employee) => {
                const initials = employee.full_name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
                const onProbation = probationEmployeeIds.has(employee.id);
                return (
                  <li key={employee.id} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[13px] font-bold text-ink-600">{initials}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink-900">{employee.full_name}</p>
                      <p className="truncate text-[12px] text-ink-500">
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
          </section>
        </>
      )}

      <div className="mt-8">
        <Link href="/me" className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900">
          Back to my profile
        </Link>
      </div>
    </main>
  );
}
