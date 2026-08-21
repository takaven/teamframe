import { redirect } from "next/navigation";
import { DateField } from "@/components/DateField";
import { requireTenantActor } from "@/middleware/rbac";
import {
  listEarlyEmploymentForAdmin,
  type OnboardingCheckIn,
  type ProbationReview,
} from "@/services/earlyEmploymentService";
import { listEmployeesForAdmin } from "@/services/employeeService";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { StatusPill } from "@/components/StatusPill";
import { completeProbationReviewAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  probation_completed: "Probation outcome recorded.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  INVALID_INPUT: "Check the fields and try again.",
  PROBATION_REVIEW_NOT_FOUND: "That review is no longer open.",
  PROBATION_EXTENSION_DATE_INVALID: "An extension needs a date after the current probation end.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function formatDueDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
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

const MANAGER_REC_LABEL: Record<string, string> = { confirmed: "Confirmed", unsuccessful: "Unsuccessful" };

export default async function EarlyEmploymentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  if (actor.role !== "admin") redirect("/me");
  const { status, error } = await searchParams;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  const [early, employees] = await Promise.all([
    listEarlyEmploymentForAdmin(actor),
    listEmployeesForAdmin(actor),
  ]);
  const employeeMap = new Map(employees.map((e) => [e.id, e.full_name]));
  const pendingCheckIns = early.checkIns.filter((c) => c.status === "scheduled");
  const submittedCheckIns = early.checkIns.filter((c) => c.status === "submitted");
  const openProbationReviews = early.probationReviews.filter((r) => r.status !== "completed");
  const completedProbationReviews = early.probationReviews.filter((r) => r.status === "completed");

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <AppShell actor={actor} activePath="/early-employment" />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin lifecycle</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Early employment</h1>
          <p className="text-[14px] text-ink-500">30-day check-in oversight and probation outcomes for employees who have started.</p>
        </div>
      </div>

      {successMessage ? <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">{successMessage}</p> : null}
      {errorMessage ? <p role="alert" className="mt-7 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">{errorMessage}</p> : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="tf-surface-flat">
          <div className="border-b border-ink-300/60 px-5 py-4">
            <h2 className="tf-h2">30-day check-ins</h2>
            <p className="mt-1 text-[13px] text-ink-500">Scheduled from each start date. Submitted answers close the reminder — non-completion never raises an alert.</p>
          </div>
          {early.checkIns.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-ink-500">No check-ins have been scheduled yet.</p>
          ) : (
            <ul className="divide-y divide-ink-300/40">
              {[...pendingCheckIns, ...submittedCheckIns].slice(0, 8).map((checkIn) => (
                <li key={checkIn.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink-900">{employeeMap.get(checkIn.employee_id) ?? "Team member"}</p>
                    <p className="mt-1 text-[12px] text-ink-500">
                      Due <span className="tabular-nums">{formatDueDate(checkIn.due_date)}</span>
                      {checkIn.flagged_follow_up ? " · Follow-up created" : ""}
                    </p>
                  </div>
                  <CheckInStatusBadge status={checkIn.status} />
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="tf-surface-flat">
          <div className="border-b border-ink-300/60 px-5 py-4">
            <h2 className="tf-h2">Probation reviews</h2>
            <p className="mt-1 text-[13px] text-ink-500">Final outcome is an authorised Admin decision. The manager recommendation (from My Team) is shown for context.</p>
          </div>
          {early.probationReviews.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-ink-500">No probation reviews have been scheduled yet.</p>
          ) : (
            <ul className="divide-y divide-ink-300/40">
              {[...openProbationReviews, ...completedProbationReviews].slice(0, 8).map((review) => (
                <li key={review.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink-900">{employeeMap.get(review.employee_id) ?? "Team member"}</p>
                      <p className="mt-1 text-[12px] text-ink-500">
                        Review due <span className="tabular-nums">{formatDueDate(review.review_due_date)}</span>
                        {" "}· Probation ends <span className="tabular-nums">{formatDueDate(review.probation_end_date)}</span>
                      </p>
                    </div>
                    <ProbationStatusBadge review={review} />
                  </div>
                  {review.manager_recommended_outcome ? (
                    <p className="rounded-md border border-ink-200 bg-ink-50/60 px-3 py-2 text-[12px] text-ink-700">
                      Manager recommendation: <span className="font-medium">{MANAGER_REC_LABEL[review.manager_recommended_outcome] ?? review.manager_recommended_outcome}</span>
                      {review.manager_input ? <> — “{review.manager_input}”</> : null}
                    </p>
                  ) : null}
                  {review.status !== "completed" ? (
                    <form action={completeProbationReviewAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input type="hidden" name="review_id" value={review.id} />
                      <label className="sr-only" htmlFor={`outcome-${review.id}`}>Outcome</label>
                      <select id={`outcome-${review.id}`} name="outcome" required className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px]">
                        <option value="confirmed">Confirmed</option>
                        <option value="extended">Extended</option>
                        <option value="employment_ending">Employment ending</option>
                      </select>
                      <label className="sr-only" htmlFor={`extended-${review.id}`}>Extended until</label>
                      <DateField name="extended_until" id={`extended-${review.id}`} aria-label="Extended probation date, required only when outcome is extended" dense />
                      <PendingSubmitButton idleLabel="Record" pendingLabel="Saving..." className="tf-primary-action px-4 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:bg-ink-300" />
                    </form>
                  ) : (
                    <p className="text-[12px] text-ink-500">Outcome: <span className="font-medium capitalize">{review.outcome?.replace("_", " ")}</span>{review.outcome_notes ? <> — {review.outcome_notes}</> : null}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {early.checkIns.length === 0 && early.probationReviews.length === 0 ? (
        <EmptyState className="mt-6 py-8" message="Nothing to show yet." hint="Check-ins and probation reviews appear here once employees start." />
      ) : null}
    </main>
  );
}
