import { requireTenantActor } from "@/middleware/rbac";
import {
  getLeaveOverviewForEmployee,
  listActiveLeaveDefinitions,
  listApprovedLeaveInRange,
  listLeaveDefinitionBalances,
  listPendingLeavesWithEmployee,
  listWhoIsAway,
  type LeaveRecord,
  type PendingLeaveWithEmployee,
} from "@/services/leaveService";
import { LeaveCalendar } from "@/components/LeaveCalendar";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill, type StatusPillTone } from "@/components/StatusPill";
import { cancelLeaveAction, decideLeaveAction, downloadLeaveEvidenceAction, submitLeaveAction, withdrawLeaveAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  decided_approved: "Request approved.",
  decided_rejected: "Request declined.",
  leave_withdrawn: "Leave request withdrawn.",
  leave_cancelled: "Approved leave cancelled.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet. Ask your admin.",
  NO_TENANT_CONTEXT: "Session error. Please sign out and back in.",
  STALE_WRITE: "This request changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "This action is out of date. Refresh and retry.",
  INVALID_INPUT: "Check the dates and try again.",
  LEAVE_EMPLOYEE_NOT_ELIGIBLE: "Leave requests are only available to active employees.",
  LEAVE_OVERLAP: "This request overlaps an existing pending or approved leave record.",
  LEAVE_INSUFFICIENT_BALANCE: "Annual leave balance is insufficient. Use an explicit admin override if this is intentional.",
  LEAVE_PERIOD_CROSSING: "Annual Leave must be requested within one calendar-year leave period. Submit separate requests for each year.",
  LEAVE_OVERRIDE_REASON_REQUIRED: "Override requires a reason.",
  LEAVE_SUBMIT_FAILED: "Could not submit leave request.",
  LEAVE_DECISION_FAILED: "Could not record decision.",
  LEAVE_WITHDRAW_FAILED: "Could not withdraw request.",
  LEAVE_CANCEL_FAILED: "Could not cancel approved leave.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

const TYPE_LABEL: Record<string, string> = {
  annual: "Annual Leave",
  sick: "Sick Leave",
  unpaid: "Unpaid Leave",
  other: "Other",
};

const LEAVE_STATUS_TONE: Record<LeaveRecord["status"], StatusPillTone> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
  cancelled: "neutral",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function days(value: number): string {
  return value === 1 ? "1 day" : `${value} days`;
}

function leaveStatusHelp(status: LeaveRecord["status"]): string {
  if (status === "pending") return "Waiting for an admin decision.";
  if (status === "approved") return "Approved and included in absence records.";
  if (status === "cancelled") return "Cancelled; retained in history.";
  return "Declined; retained in history.";
}

function StatusBadge({ status }: { status: LeaveRecord["status"] }) {
  return (
    <StatusPill tone={LEAVE_STATUS_TONE[status]} className="capitalize">
      {status}
    </StatusPill>
  );
}

function parseMonth(raw: string | undefined): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(5, 7));
    if (year >= 2000 && year <= 2200 && month >= 1 && month <= 12) return { year, month };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; view?: string; month?: string; leave?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error, view: viewParam, month: monthParam, leave: leaveParam } = await searchParams;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role === "admin") {
    const view = viewParam === "calendar" ? "calendar" : "requests";
    const { year, month } = parseMonth(monthParam);
    const monthFrom = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthTo = `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;

    const [pending, away, calendarLeaves]: [
      PendingLeaveWithEmployee[],
      Awaited<ReturnType<typeof listWhoIsAway>>,
      Awaited<ReturnType<typeof listApprovedLeaveInRange>>,
    ] = await Promise.all([
      listPendingLeavesWithEmployee(actor),
      listWhoIsAway(actor),
      view === "calendar" ? listApprovedLeaveInRange(actor, monthFrom, monthTo) : Promise.resolve([]),
    ]);

    return (
      <main className="mx-auto max-w-6xl px-6 py-14">
        <AppShell actor={actor} activePath="/leaves" />

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
          <div className="space-y-2">
            <p className="text-[12px] tracking-[0.14em] text-ink-500">Leave administration</p>
            <h1 className="text-[34px] leading-tight tracking-tight">Leave</h1>
            <p className="text-[14px] text-ink-500">Review requests, protect balances and keep absence records truthful.</p>
          </div>
        </div>

        <section className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <p className="text-[12px] text-ink-500">Needs decision</p>
            <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{pending.length}</p>
          </article>
          <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <p className="text-[12px] text-ink-500">Away in next 30 days</p>
            <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{away.length}</p>
          </article>
          <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <p className="text-[12px] text-ink-500">Oldest request age</p>
            <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">
              {pending[0] ? `${Math.max(1, Math.ceil((Date.now() - new Date(pending[0].created_at).getTime()) / 86_400_000))}d` : "0d"}
            </p>
          </article>
        </section>

        {successMessage ? <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">{successMessage}</p> : null}
        {errorMessage ? (
          <p role="alert" className="mt-7 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">
            {errorMessage}
          </p>
        ) : null}

        <nav className="mt-8 flex gap-1 border-b border-ink-300/60" aria-label="Leave admin views">
          <a
            href="/leaves"
            aria-current={view === "requests" ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-[14px] ${view === "requests" ? "border-ink-900 font-medium text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900"}`}
          >
            Requests
          </a>
          <a
            href="/leaves?view=calendar"
            aria-current={view === "calendar" ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-[14px] ${view === "calendar" ? "border-ink-900 font-medium text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900"}`}
          >
            Calendar
          </a>
        </nav>

        {view === "calendar" ? (
          <LeaveCalendar leaves={calendarLeaves} year={year} month={month} selectedLeaveId={leaveParam} basePath="/leaves" />
        ) : (
        <>
        <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
          <div className="border-b border-ink-300/60 px-5 py-4">
            <h2 className="text-[17px] font-medium tracking-tight">
              Pending decisions — <span className="font-mono tabular-nums">{pending.length}</span>
            </h2>
          </div>
          {pending.length === 0 ? (
            <EmptyState className="m-5" message="No pending leave requests." hint="New requests appear here with balance and overlap checks already applied." />
          ) : (
            <ul className="divide-y divide-ink-300/40">
              {pending.map((leave) => {
                const annual = leave.annual_balance;
                const annualShortfall = leave.leave_type === "annual" && annual?.available !== null && annual ? leave.requested_days - annual.available : 0;
                // A non-system entitlement-bearing custom definition is insufficient exactly when its
                // per-definition available (which already nets this pending request) is negative —
                // the same condition the approval engine enforces.
                const defBal = leave.definition_balance;
                const customShortfall = defBal && defBal.available !== null && defBal.available < 0 ? -defBal.available : 0;
                const shortfall = Math.max(annualShortfall, customShortfall, 0);
                const shortfallLabel = customShortfall > 0 ? (leave.leave_definition_name ?? "custom") : "annual";
                return (
                  <li key={leave.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_360px]">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[13px] font-medium text-ink-900">
                        {leave.employee_full_name} <span className="text-[12px] font-normal text-ink-500">({leave.employee_role_title})</span>
                      </p>
                      <p className="font-mono text-[15px] tabular-nums text-ink-900">
                        {formatDate(leave.start_date)} to {formatDate(leave.end_date)}
                      </p>
                      <p className="text-[12px] text-ink-500">
                        {leave.leave_definition_name ?? TYPE_LABEL[leave.leave_type]} · {days(leave.requested_days)}
                        {annual && leave.leave_type === "annual"
                          ? ` · Available before approval: ${annual.available} days`
                          : defBal
                            ? ` · Available before approval: ${defBal.available} days`
                            : ""}
                      </p>
                      {shortfall > 0 ? (
                        <p className="rounded-md border border-signal-red/30 bg-signal-red/10 px-3 py-2 text-[12px] text-signal-red">
                          Insufficient {shortfallLabel} leave by {days(shortfall)}. Approval requires explicit override.
                        </p>
                      ) : null}
                      {leave.attachment_document_id ? (
                        <form action={downloadLeaveEvidenceAction}>
                          <input type="hidden" name="document_id" value={leave.attachment_document_id} />
                          <input type="hidden" name="return_to" value="/leaves" />
                          <button type="submit" className="text-[12px] text-accent underline underline-offset-2">Evidence attached — view</button>
                        </form>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <form action={decideLeaveAction} className="grid gap-2 rounded-lg border border-ink-300/50 p-3">
                        <input type="hidden" name="leave_id" value={leave.id} />
                        <input type="hidden" name="expected_updated_at" value={leave.updated_at} />
                        <input type="hidden" name="decision" value="approved" />
                        {shortfall > 0 ? (
                          <>
                            <label className="flex items-center gap-2 text-[12px] text-ink-700">
                              <input type="checkbox" name="override_insufficient_balance" required />
                              Override insufficient balance
                            </label>
                            <input
                              name="override_reason"
                              required
                              placeholder="Override reason"
                              className="rounded-md border border-ink-300 px-3 py-2 text-[13px]"
                            />
                          </>
                        ) : null}
                        <PendingSubmitButton
                          idleLabel="Approve"
                          pendingLabel="Approving..."
                          className="rounded-lg bg-brand-signal px-4 py-2 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:bg-ink-300"
                        />
                      </form>
                      <form action={decideLeaveAction} className="flex gap-2">
                        <input type="hidden" name="leave_id" value={leave.id} />
                        <input type="hidden" name="expected_updated_at" value={leave.updated_at} />
                        <input type="hidden" name="decision" value="rejected" />
                        <ConfirmSubmitButton
                          idleLabel="Decline"
                          pendingLabel="Declining..."
                          confirmMessage={`Decline leave request from ${leave.employee_full_name}?`}
                          className="w-full rounded-full border border-ink-300 px-4 py-1.5 text-[13px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:border-ink-300/50 disabled:text-ink-300"
                        />
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
          <div className="border-b border-ink-300/60 px-5 py-4">
            <h2 className="text-[17px] font-medium tracking-tight">Who&apos;s away</h2>
            <p className="mt-1 text-[13px] text-ink-500">Approved leave today and in the next 30 days.</p>
          </div>
          {away.length === 0 ? (
            <EmptyState className="m-5" message="No approved absence is scheduled." hint="Approved leave will appear here automatically." />
          ) : (
            <ul className="divide-y divide-ink-300/40">
              {away.map((item) => (
                <li key={item.leave_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-[14px] font-medium text-ink-900">{item.employee_full_name}</p>
                    <p className="text-[12px] text-ink-500">
                      {formatDate(item.start_date)} to {formatDate(item.end_date)} · {TYPE_LABEL[item.leave_type]} · {days(item.requested_days)}
                    </p>
                  </div>
                  <form action={cancelLeaveAction}>
                    <input type="hidden" name="leave_id" value={item.leave_id} />
                    <input type="hidden" name="expected_updated_at" value={item.updated_at} />
                    <ConfirmSubmitButton
                      idleLabel="Cancel"
                      pendingLabel="Cancelling..."
                      confirmMessage={`Cancel approved leave for ${item.employee_full_name}?`}
                      className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
                    />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
        </>
        )}
      </main>
    );
  }

  const overview = actor.employeeId ? await getLeaveOverviewForEmployee(actor, actor.employeeId) : null;
  const [activeDefinitions, definitionBalances] = actor.employeeId
    ? await Promise.all([listActiveLeaveDefinitions(actor), listLeaveDefinitionBalances(actor, actor.employeeId)])
    : [[], []];

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <AppShell actor={actor} activePath="/leaves" />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Self-service</p>
          <h1 className="text-[34px] leading-tight tracking-tight">My leave</h1>
          <p className="text-[14px] text-ink-500">Request time away and see your balance and request history.</p>
        </div>
      </div>

      {successMessage ? <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">{successMessage}</p> : null}
      {errorMessage ? (
        <p role="alert" className="mt-7 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">
          {errorMessage}
        </p>
      ) : null}

      {overview ? (
        <>
          <section className="mt-8 overflow-x-auto rounded-xl border border-ink-300/70 bg-white/80">
            <table className="min-w-full text-left text-[13px]">
              <thead className="border-b border-ink-200 text-[11px] uppercase tracking-[0.1em] text-ink-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Leave type</th>
                  <th className="px-4 py-3 font-medium text-right">Entitlement</th>
                  <th className="px-4 py-3 font-medium text-right">Taken</th>
                  <th className="px-4 py-3 font-medium text-right">Pending approval</th>
                  <th className="px-4 py-3 font-medium text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {definitionBalances.map((b) => (
                  <tr key={b.definition_id}>
                    <td className="px-4 py-2 font-medium text-ink-900">{b.display_name}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{b.entitlement ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{b.taken}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{b.pending}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{b.available ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
            <h2 className="text-[19px] font-medium tracking-tight">Request leave</h2>
            <form action={submitLeaveAction} className="mt-4 grid gap-3 sm:grid-cols-2" encType="multipart/form-data">
              <label className="flex flex-col gap-1 text-[12px] text-ink-500 sm:col-span-2">
                Leave type
                <select name="leave_definition_id" required className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900">
                  {activeDefinitions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.display_name} ({d.counting_basis === "calendar_days" ? "calendar days" : "working days"}
                      {d.attachment_requirement === "required" ? ", evidence required" : ""})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                From
                <input name="start_date" type="date" required className="rounded-md border border-ink-300 px-3 py-2 text-[14px]" />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                To
                <input name="end_date" type="date" required className="rounded-md border border-ink-300 px-3 py-2 text-[14px]" />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-ink-500 sm:col-span-2">
                Reason
                <input name="reason" maxLength={500} className="rounded-md border border-ink-300 px-3 py-2 text-[14px]" />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-ink-500 sm:col-span-2">
                Supporting evidence <span className="text-ink-400">(attach if your leave type requires it)</span>
                <input name="attachment" type="file" className="rounded-md border border-ink-300 px-3 py-2 text-[13px]" />
              </label>
              <PendingSubmitButton
                idleLabel="Submit request"
                pendingLabel="Submitting..."
                className="rounded-lg bg-brand-signal px-5 py-2 text-[14px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:bg-ink-300 sm:w-fit"
              />
            </form>
          </section>

          {overview.requests.length > 0 ? (
            <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight">History</h2>
                <p className="mt-1 text-[13px] text-ink-500">Newest requests appear first.</p>
              </div>
              <ul className="divide-y divide-ink-300/40">
                {overview.requests.map((leave) => (
                  <li key={leave.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-mono text-[15px] tabular-nums text-ink-900">
                        {formatDate(leave.start_date)} to {formatDate(leave.end_date)}
                      </p>
                      <p className="text-[12px] text-ink-500">
                        {leave.leave_definition_name ?? TYPE_LABEL[leave.leave_type]} · {days(leave.requested_days)} · Submitted {formatDate(leave.created_at)}
                      </p>
                      <p className="text-[12px] text-ink-500">{leaveStatusHelp(leave.status)}</p>
                      {leave.attachment_document_id ? (
                        <form action={downloadLeaveEvidenceAction}>
                          <input type="hidden" name="document_id" value={leave.attachment_document_id} />
                          <input type="hidden" name="return_to" value="/leaves" />
                          <button type="submit" className="text-[12px] text-accent underline underline-offset-2">Evidence attached — view</button>
                        </form>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-left sm:text-right">
                      <StatusBadge status={leave.status} />
                      {leave.status === "pending" ? (
                        <form action={withdrawLeaveAction}>
                          <input type="hidden" name="leave_id" value={leave.id} />
                          <input type="hidden" name="expected_updated_at" value={leave.updated_at} />
                          <ConfirmSubmitButton
                            idleLabel="Withdraw"
                            pendingLabel="Withdrawing..."
                            confirmMessage="Withdraw this leave request?"
                            className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700"
                          />
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <EmptyState className="mt-6 py-6" message="You have not requested time off yet." hint="When you do, decisions and updates will appear here." />
          )}
        </>
      ) : (
        <EmptyState className="mt-8" message="Your account is not linked to an employee profile." hint="Ask your admin to add you as an employee." />
      )}
    </main>
  );
}
