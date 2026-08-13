import { requireTenantActor } from "@/middleware/rbac";
import {
  listAllOnboardingTasks,
  listOnboardingTasksForEmployee,
  type OnboardingTask,
} from "@/services/onboardingService";
import {
  listEarlyEmploymentForAdmin,
  listMyOnboardingCheckIns,
  type OnboardingCheckIn,
  type ProbationReview,
} from "@/services/earlyEmploymentService";
import { listEmployeesForAdmin } from "@/services/employeeService";
import { isTaskOverdue } from "@/services/onboardingService/templates";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { AssignPackForm } from "./AssignPackForm";
import {
  assignOnboardingTaskAction,
  completeOnboardingTaskAction,
  completeProbationReviewAction,
  submitOnboardingCheckInAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  assigned: "Task assigned and ready for the employee.",
  pack_assigned: "Pack assigned. The employee's checklist is ready.",
  completed: "Task marked complete.",
  check_in_submitted: "30-day check-in submitted.",
  probation_completed: "Probation outcome recorded.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet.",
  NOT_FOUND: "That employee could not be found.",
  STALE_WRITE: "This item changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "This action is out of date. Refresh and retry.",
  INVALID_INPUT: "Check your input and try again.",
  ONBOARDING_ASSIGN_FAILED: "Could not assign task.",
  ONBOARDING_UNKNOWN_PACK: "That template pack does not exist. Refresh and try again.",
  ONBOARDING_PACK_EMPTY: "All tasks were removed from the pack. Keep at least one task, or use the single-task form.",
  ONBOARDING_COMPLETE_FAILED: "Could not complete task.",
  CHECK_IN_NOT_FOUND: "That check-in could not be found.",
  CHECK_IN_RESPONSES_INVALID: "Check your check-in responses and try again.",
  CHECK_IN_SUBMIT_FAILED: "Could not submit check-in.",
  PROBATION_REVIEW_NOT_FOUND: "That probation review could not be found.",
  PROBATION_EXTENSION_DATE_INVALID: "Extended probation date must be after the current probation end date.",
  PROBATION_REVIEW_COMPLETE_FAILED: "Could not record probation outcome.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDueDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function DueDateBadge({ task }: { task: Pick<OnboardingTask, "due_date" | "status"> }) {
  if (!task.due_date) return null;
  return isTaskOverdue(task.due_date, task.status) ? (
    <p>
      <StatusPill tone="amber">
        Overdue — was due <span className="ml-1 font-mono tabular-nums">{formatDueDate(task.due_date)}</span>
      </StatusPill>
    </p>
  ) : (
    <p className="text-[12px] text-ink-500">
      Due <span className="font-mono tabular-nums">{formatDueDate(task.due_date)}</span>
    </p>
  );
}

function TaskStatusBadge({ status }: { status: OnboardingTask["status"] }) {
  return status === "completed" ? (
    <StatusPill tone="green">Completed</StatusPill>
  ) : (
    <StatusPill tone="amber">Needs action</StatusPill>
  );
}

function completionModeLabel(mode: OnboardingTask["completion_mode"]): string {
  switch (mode) {
    case "document_required":
      return "Requires evidence";
    case "policy_acknowledgement":
      return "Awaiting acknowledgement";
    case "form_or_data_required":
      return "Requires data";
    case "manual_confirmation":
    default:
      return "Needs action";
  }
}

function progressCopy(progress: number): string {
  if (progress === 100) return "You are all set.";
  if (progress >= 60) return "You are close to finishing.";
  if (progress > 0) return "A few tasks are still open.";
  return "Your checklist will grow as your setup progresses.";
}

function CheckInStatusBadge({ status }: { status: OnboardingCheckIn["status"] }) {
  if (status === "submitted") return <StatusPill tone="green">Submitted</StatusPill>;
  if (status === "scheduled") return <StatusPill tone="info">Scheduled</StatusPill>;
  return <StatusPill tone="neutral">{status.replace("_", " ")}</StatusPill>;
}

function ProbationStatusBadge({ review }: { review: ProbationReview }) {
  if (review.status === "completed") return <StatusPill tone="green">Completed</StatusPill>;
  const overdue = review.review_due_date < new Date().toISOString().slice(0, 10);
  if (overdue) return <StatusPill tone="amber">Review due</StatusPill>;
  return <StatusPill tone="info">Scheduled</StatusPill>;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role === "admin") {
    const [tasks, employees, earlyEmployment] = await Promise.all([
      listAllOnboardingTasks(actor),
      listEmployeesForAdmin(actor),
      listEarlyEmploymentForAdmin(actor),
    ]);

    const pending = tasks.filter((t) => t.status === "pending");
    const done = tasks.filter((t) => t.status === "completed");
    const employeeMap = new Map(employees.map((e) => [e.id, e.full_name]));
    const pendingCheckIns = earlyEmployment.checkIns.filter((checkIn) => checkIn.status === "scheduled");
    const submittedCheckIns = earlyEmployment.checkIns.filter((checkIn) => checkIn.status === "submitted");
    const openProbationReviews = earlyEmployment.probationReviews.filter((review) => review.status !== "completed");

    return (
      <main className="mx-auto max-w-5xl px-6 py-14">
        <AppShell actor={actor} activePath="/onboarding" />

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
          <div className="space-y-2">
            <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin queue</p>
            <h1 className="text-[34px] leading-tight tracking-tight">Onboarding tasks</h1>
            <p className="text-[14px] text-ink-500">
              Assign first-week tasks so every employee knows what to do next.
            </p>
          </div>
        </div>

        <section className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <p className="text-[12px] text-ink-500">Needs attention</p>
            <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{pending.length}</p>
          </article>
          <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <p className="text-[12px] text-ink-500">Completed</p>
            <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{done.length}</p>
          </article>
          <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <p className="text-[12px] text-ink-500">Completion rate</p>
            <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">
              {tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0}%
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">30-day check-ins</h2>
              <p className="mt-1 text-[13px] text-ink-500">
                Scheduled from each employee start date. Submitted answers close the reminder obligation.
              </p>
            </div>
            {earlyEmployment.checkIns.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-ink-500">No check-ins have been scheduled yet.</p>
            ) : (
              <ul className="divide-y divide-ink-300/40">
                {[...pendingCheckIns, ...submittedCheckIns].slice(0, 6).map((checkIn) => (
                  <li key={checkIn.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink-900">
                        {employeeMap.get(checkIn.employee_id) ?? "Team member"}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-500">
                        Due <span className="font-mono tabular-nums">{formatDueDate(checkIn.due_date)}</span>
                        {checkIn.flagged_follow_up ? " · Follow-up created" : ""}
                      </p>
                    </div>
                    <CheckInStatusBadge status={checkIn.status} />
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">Probation reviews</h2>
              <p className="mt-1 text-[13px] text-ink-500">
                Human outcomes only. Reviews are scheduled by the early-employment defaults.
              </p>
            </div>
            {earlyEmployment.probationReviews.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-ink-500">No probation reviews have been scheduled yet.</p>
            ) : (
              <ul className="divide-y divide-ink-300/40">
                {[...openProbationReviews, ...earlyEmployment.probationReviews.filter((review) => review.status === "completed")]
                  .slice(0, 5)
                  .map((review) => (
                    <li key={review.id} className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-ink-900">
                            {employeeMap.get(review.employee_id) ?? "Team member"}
                          </p>
                          <p className="mt-1 text-[12px] text-ink-500">
                            Review due <span className="font-mono tabular-nums">{formatDueDate(review.review_due_date)}</span>
                            {" "}· Probation ends <span className="font-mono tabular-nums">{formatDueDate(review.probation_end_date)}</span>
                          </p>
                        </div>
                        <ProbationStatusBadge review={review} />
                      </div>
                      {review.status !== "completed" ? (
                        <form action={completeProbationReviewAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input type="hidden" name="review_id" value={review.id} />
                          <label className="sr-only" htmlFor={`outcome-${review.id}`}>Outcome</label>
                          <select
                            id={`outcome-${review.id}`}
                            name="outcome"
                            required
                            className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px]"
                          >
                            <option value="confirmed">Confirmed</option>
                            <option value="extended">Extended</option>
                            <option value="employment_ending">Employment ending</option>
                          </select>
                          <label className="sr-only" htmlFor={`extended-${review.id}`}>Extended until</label>
                          <input
                            id={`extended-${review.id}`}
                            name="extended_until"
                            type="date"
                            className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px]"
                            aria-label="Extended probation date, required only when outcome is extended"
                          />
                          <PendingSubmitButton
                            idleLabel="Record"
                            pendingLabel="Saving..."
                            className="rounded-lg bg-brand-signal px-4 py-2 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300"
                          />
                        </form>
                      ) : null}
                    </li>
                  ))}
              </ul>
            )}
          </article>
        </section>

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

        <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <h2 className="text-[19px] font-medium tracking-tight">Assign a template pack</h2>
          <p className="mt-1 text-[14px] text-ink-500">
            Pre-fill a first-two-weeks checklist. Remove any task before assigning; due dates come from the employee&apos;s start date.
          </p>
          {employees.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-500">
              You do not have employees to assign yet.{" "}
              <Link href="/employees" className="underline hover:text-ink-900">Add an employee</Link> first.
            </p>
          ) : (
            <AssignPackForm
              employees={employees.map((e) => ({
                id: e.id,
                full_name: e.full_name,
                role_title: e.role_title,
                start_date: e.start_date,
                created_at: e.created_at,
              }))}
            />
          )}
        </section>

        <section className="mt-5 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <h2 className="text-[19px] font-medium tracking-tight">Assign a single task</h2>
          {employees.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-500">
              You do not have employees to assign yet.{" "}
              <Link href="/employees" className="underline hover:text-ink-900">Add an employee</Link> first.
            </p>
          ) : (
            <form action={assignOnboardingTaskAction} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="employee_id" className="text-[12px] text-ink-500">Employee</label>
                <select
                  id="employee_id"
                  name="employee_id"
                  required
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px] bg-white"
                >
                  <option value="">Select employee…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} — {e.role_title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <label htmlFor="title" className="text-[12px] text-ink-500">Task</label>
                <input
                  id="title"
                  name="title"
                  placeholder="e.g. Complete payroll setup"
                  required
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="owner_role" className="text-[12px] text-ink-500">Owner</label>
                <select
                  id="owner_role"
                  name="owner_role"
                  defaultValue="employee"
                  className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <PendingSubmitButton
                idleLabel="Assign"
                pendingLabel="Assigning…"
                className="rounded-lg bg-brand-signal px-5 py-2 text-[14px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300"
              />
            </form>
          )}
        </section>

        {pending.length > 0 ? (
          <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">
                Pending — <span className="font-mono tabular-nums">{pending.length}</span>
              </h2>
            </div>
            <ul className="divide-y divide-ink-300/40">
              {pending.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-[15px] text-ink-900">{task.title}</p>
                    <p className="text-[12px] text-ink-500">
                      {employeeMap.get(task.employee_id) ?? task.employee_id} · Assigned{" "}
                      <span className="font-mono tabular-nums">{formatDate(task.created_at)}</span>
                    </p>
                    <DueDateBadge task={task} />
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                    <TaskStatusBadge status={task.status} />
                    {task.completion_mode === "manual_confirmation" ? (
                      <form action={completeOnboardingTaskAction} className="w-full sm:w-auto">
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="expected_updated_at" value={task.updated_at} />
                        <PendingSubmitButton
                          idleLabel="Mark complete"
                          pendingLabel="Saving..."
                          className="w-full rounded-full border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300 sm:w-auto"
                        />
                      </form>
                    ) : (
                      <span className="w-full rounded-full border border-ink-300 bg-ink-50 px-3 py-1.5 text-center text-[12px] font-medium text-ink-700 sm:w-auto">
                        {completionModeLabel(task.completion_mode)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState
            className="mt-6"
            message="No onboarding tasks are waiting on action."
            hint="Assign the next task above. New completions will also feed into the dashboard timeline."
          />
        )}

        {done.length > 0 ? (
          <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight text-ink-500">
                Completed — <span className="font-mono tabular-nums">{done.length}</span>
              </h2>
            </div>
            <ul className="divide-y divide-ink-300/40">
              {done.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-4 px-5 py-4 opacity-60">
                  <div className="space-y-0.5">
                    <p className="text-[15px] text-ink-900 line-through">{task.title}</p>
                    <p className="text-[12px] text-ink-500">
                      {employeeMap.get(task.employee_id) ?? task.employee_id} · Done{" "}
                      <span className="font-mono tabular-nums">{task.completed_at ? formatDate(task.completed_at) : "—"}</span>
                    </p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    );
  }

  // Employee view
  const [myTasks, myCheckIns] = actor.employeeId
    ? await Promise.all([
        listOnboardingTasksForEmployee(actor, actor.employeeId),
        listMyOnboardingCheckIns(actor),
      ])
    : [[], []];

  const pending = myTasks.filter((t) => t.status === "pending");
  const done = myTasks.filter((t) => t.status === "completed");
  const openCheckIn = myCheckIns.find((checkIn) => checkIn.status === "scheduled") ?? null;
  const progress = myTasks.length > 0 ? Math.round((done.length / myTasks.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <AppShell actor={actor} activePath="/onboarding" />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Your checklist</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Onboarding</h1>
          <p className="text-[14px] text-ink-500">Finish each task to complete your setup.</p>
        </div>
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

      {!actor.employeeId ? (
        <EmptyState
          className="mt-8"
          message="Your account is not linked to an employee profile."
          hint="Ask your admin to add you as an employee."
        />
      ) : pending.length === 0 && done.length === 0 ? (
        <EmptyState
          className="mt-8"
          message="Nothing is waiting on you yet."
          hint="Your admin will add your first onboarding step here when it is ready."
        />
      ) : (
        <>
          <section className="mt-7 rounded-xl border border-ink-300/70 bg-white/80 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[19px] font-medium tracking-tight">Your progress</h2>
                <p className="mt-1 text-[14px] text-ink-500">{progressCopy(progress)}</p>
              </div>
              <TaskStatusBadge status={pending.length > 0 ? "pending" : "completed"} />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-brand-signal transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-3">
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">To do</p>
              <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{pending.length}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Completed</p>
              <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{done.length}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Progress</p>
              <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{progress}%</p>
            </article>
          </section>

          {pending.length > 0 ? (
            <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight">
                  To do — <span className="font-mono tabular-nums">{pending.length}</span>
                </h2>
              </div>
              <ul className="divide-y divide-ink-300/40">
                {pending.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[15px] text-ink-900">{task.title}</p>
                      <p className="text-[12px] text-ink-500">
                        Added <span className="font-mono tabular-nums">{formatDate(task.created_at)}</span>
                      </p>
                      <DueDateBadge task={task} />
                      <p className="text-[12px] text-ink-500">Complete this once the step is finished.</p>
                    </div>
                    {task.completion_mode === "manual_confirmation" ? (
                      <form action={completeOnboardingTaskAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="expected_updated_at" value={task.updated_at} />
                        <PendingSubmitButton
                          idleLabel="Mark done"
                          pendingLabel="Saving..."
                          className="rounded-lg bg-brand-signal px-4 py-1.5 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300"
                        />
                      </form>
                    ) : (
                      <span className="rounded-lg border border-ink-300 bg-ink-50 px-4 py-1.5 text-[13px] font-medium text-ink-700">
                        {completionModeLabel(task.completion_mode)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {openCheckIn ? (
            <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight">30-day check-in</h2>
                <p className="mt-1 text-[13px] text-ink-500">
                  Share factual onboarding feedback so the team can remove blockers.
                </p>
              </div>
              <form action={submitOnboardingCheckInAction} className="grid gap-4 px-5 py-4">
                <input type="hidden" name="check_in_id" value={openCheckIn.id} />
                {[
                  ["role_clarity", "Role and priorities"],
                  ["manager_team_clarity", "Manager and team clarity"],
                  ["training_clear", "Training information"],
                  ["policies_clear", "Policies and processes"],
                ].map(([name, label]) => (
                  <label key={name} className="grid gap-1 text-[13px] text-ink-700">
                    {label}
                    <select
                      name={name}
                      required
                      defaultValue="mostly_clear"
                      className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]"
                    >
                      <option value="clear">Clear</option>
                      <option value="mostly_clear">Mostly clear</option>
                      <option value="unclear">Unclear</option>
                      <option value="needs_help">I need help</option>
                    </select>
                  </label>
                ))}
                {[
                  ["tools_ready", "I have the tools and access I need"],
                  ["support_available", "I know where to get support"],
                  ["has_blockers", "Something is blocking my work"],
                ].map(([name, label]) => (
                  <label key={name} className="grid gap-1 text-[13px] text-ink-700">
                    {label}
                    <select
                      name={name}
                      required
                      defaultValue={name === "has_blockers" ? "no" : "yes"}
                      className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                ))}
                <label className="grid gap-1 text-[13px] text-ink-700">
                  What would improve onboarding?
                  <textarea
                    name="improvement_note"
                    rows={3}
                    className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px]"
                    placeholder="Optional note"
                  />
                </label>
                <PendingSubmitButton
                  idleLabel="Submit check-in"
                  pendingLabel="Submitting..."
                  className="w-full rounded-lg bg-brand-signal px-4 py-2 text-[14px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300 sm:w-fit"
                />
              </form>
            </section>
          ) : null}

          {done.length > 0 ? (
            <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight text-ink-500">
                  Completed — <span className="font-mono tabular-nums">{done.length}</span>
                </h2>
              </div>
              <ul className="divide-y divide-ink-300/40">
                {done.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 opacity-60">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[15px] text-ink-900 line-through">{task.title}</p>
                      <p className="text-[12px] text-ink-500">
                        Done <span className="font-mono tabular-nums">{task.completed_at ? formatDate(task.completed_at) : "—"}</span>
                      </p>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
