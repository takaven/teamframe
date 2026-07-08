import { requireTenantActor } from "@/middleware/rbac";
import {
  listAllOnboardingTasks,
  listOnboardingTasksForEmployee,
  type OnboardingTask,
} from "@/services/onboardingService";
import { listEmployeesForAdmin } from "@/services/employeeService";
import { isTaskOverdue } from "@/services/onboardingService/templates";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { AssignPackForm } from "./AssignPackForm";
import { assignOnboardingTaskAction, completeOnboardingTaskAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  assigned: "Task assigned and ready for the employee.",
  pack_assigned: "Pack assigned. The employee's checklist is ready.",
  completed: "Task marked complete.",
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

function progressCopy(progress: number): string {
  if (progress === 100) return "You are all set.";
  if (progress >= 60) return "You are close to finishing.";
  if (progress > 0) return "A few tasks are still open.";
  return "Your checklist will grow as your setup progresses.";
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
    const [tasks, employees] = await Promise.all([
      listAllOnboardingTasks(actor),
      listEmployeesForAdmin(actor),
    ]);

    const pending = tasks.filter((t) => t.status === "pending");
    const done = tasks.filter((t) => t.status === "completed");
    const employeeMap = new Map(employees.map((e) => [e.id, e.full_name]));

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
              <PendingSubmitButton
                idleLabel="Assign"
                pendingLabel="Assigning…"
                className="rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
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
                    <form action={completeOnboardingTaskAction} className="w-full sm:w-auto">
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="expected_updated_at" value={task.updated_at} />
                      <PendingSubmitButton
                        idleLabel="Mark complete"
                        pendingLabel="Saving..."
                        className="w-full rounded-full border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300 sm:w-auto"
                      />
                    </form>
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
  const myTasks = actor.employeeId
    ? await listOnboardingTasksForEmployee(actor, actor.employeeId)
    : [];

  const pending = myTasks.filter((t) => t.status === "pending");
  const done = myTasks.filter((t) => t.status === "completed");
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
                className="h-full rounded-full bg-ink-900 transition-all"
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
                    <form action={completeOnboardingTaskAction}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="expected_updated_at" value={task.updated_at} />
                      <PendingSubmitButton
                        idleLabel="Mark done"
                        pendingLabel="Saving..."
                        className="rounded-full bg-ink-900 px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
                      />
                    </form>
                  </li>
                ))}
              </ul>
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
