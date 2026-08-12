import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { StatusPill } from "@/components/StatusPill";
import { getManagerDashboard } from "@/services/managerService";
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
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;
  const dashboard = await getManagerDashboard(actor);
  const employeeMap = new Map(dashboard.directReports.map((employee) => [employee.id, employee]));
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
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Manager work</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">Direct-report decisions</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-500">
          Limited operational work for employees who currently report to you. Admin HR records, documents, policies and organisation changes remain restricted.
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
                      <form action={decideManagerLeaveAction} className="flex items-start gap-2">
                        <input type="hidden" name="leave_id" value={leave.id} />
                        <input type="hidden" name="expected_updated_at" value={leave.updated_at} />
                        <button
                          type="submit"
                          name="decision"
                          value="rejected"
                          className="rounded-full border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900"
                        >
                          Decline
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="approved"
                          className="rounded-full bg-brand-signal px-4 py-1.5 text-[12px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:bg-ink-300"
                        >
                          Approve
                        </button>
                      </form>
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
                          Manager input
                          <textarea
                            name="input"
                            rows={3}
                            required
                            defaultValue={review.manager_input ?? ""}
                            className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px] text-ink-900"
                          />
                        </label>
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

          <section className="mt-7 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">Direct reports</h2>
            </div>
            <ul className="divide-y divide-ink-300/40">
              {dashboard.directReports.map((employee) => (
                <li key={employee.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-[14px] font-medium text-ink-900">{employee.full_name}</p>
                    <p className="mt-1 text-[12px] text-ink-500">
                      {employee.role_title} · {employee.department}{employee.country ? ` · ${employee.country}` : ""}
                    </p>
                  </div>
                </li>
              ))}
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
