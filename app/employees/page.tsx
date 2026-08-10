import { requireTenantActor } from "@/middleware/rbac";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  INVITE_RESEND_COOLDOWN_SECONDS,
  listEmployeesForAdmin,
} from "@/services/employeeService";
import { listDocumentsForEmployee } from "@/services/documentService";
import { listPositions } from "@/services/positionService";
import { CopyInviteEmailButton } from "./CopyInviteEmailButton";
import {
  createEmployeeAction,
  deleteEmployeeDocumentAction,
  downloadEmployeeDocumentAction,
  exportFinanceHandoffAction,
  exportEmployeeDueDiligencePackAction,
  generateActivationLinkAction,
  startOffboardingAction,
  updateEmployeeAction,
  archiveEmployeeAction,
  reinviteEmployeeAction,
  uploadEmployeeDocumentAction,
} from "./actions";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill, type StatusPillTone } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  created: "Employee created.",
  updated: "Employee updated.",
  offboarding_started: "Offboarding started.",
  archived: "Employee archived.",
  reinvited: "Invite link sent. The employee should use the newest email only.",
  activation_link_ready: "Activation link generated.",
  document_uploaded: "Document uploaded.",
  document_deleted: "Document deleted.",
  due_diligence_pack_exported: "Due diligence pack prepared.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NOT_FOUND: "That employee could not be found.",
  STALE_WRITE: "This record changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "This action is out of date. Refresh and retry.",
  NO_PATCH_FIELDS: "No editable fields were provided.",
  EMPLOYEE_CREATE_FAILED: "Could not create employee.",
  EMPLOYEE_UPDATE_FAILED: "Could not update employee.",
  EMPLOYEE_DELETE_FAILED: "Could not archive employee.",
  EMPLOYEE_INVITE_TENANT_CONFLICT: "Invite blocked: this email is already linked to another company.",
  EMPLOYEE_INVITE_FAILED: "Employee saved, but invite delivery failed. Try Re-send invite.",
  EMPLOYEE_INVITE_RATE_LIMIT: "Invite rate limit reached. Wait briefly, then try Re-send invite.",
  EMPLOYEE_RESEND_COOLDOWN: "Re-send is cooling down. Wait briefly before trying again.",
  EMPLOYEE_INVITE_REDIRECT_MISMATCH: "Invite blocked by redirect configuration. Check SITE_URL and Supabase redirect allow-list.",
  EMPLOYEE_INVITE_PROVIDER_CONFIG: "Invite provider is not fully configured. Ask an admin to check Supabase email settings.",
  EMPLOYEE_INVITE_USER_LOOKUP_FAILED: "Invite could not be linked to an existing auth user. Re-send invite.",
  EMPLOYEE_INVITE_METADATA_FAILED: "Invite was sent but metadata sync failed. Re-send invite.",
  EMPLOYEE_ACTIVATION_LINK_FAILED: "Could not generate an activation link. Re-send invite and retry.",
  EMPLOYEE_ALREADY_ACTIVE: "This employee is already activated.",
  AUDIT_LOG_FAILED: "Could not record required audit trail. No change was applied.",
  DOCUMENT_UPLOAD_FAILED: "Document upload failed.",
  DOCUMENT_RECORD_CREATE_FAILED: "Document could not be saved.",
  DOCUMENT_LIST_FAILED: "Could not load documents for this employee.",
  DOCUMENT_FETCH_FAILED: "Document could not be found.",
  DOCUMENT_SIGNED_URL_FAILED: "Could not generate document download link.",
  DOCUMENT_DELETE_FAILED: "Could not delete document.",
  INVALID_INPUT: "Could not save — check the email address and the other fields, then try again.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

// Plain-English reasons for a failed invite delivery. Shown to admins in the
// roster — never surface raw error codes to customers.
const INVITE_FAILURE_COPY: Record<string, string> = {
  EMPLOYEE_INVITE_FAILED: "The last invite email could not be delivered.",
  EMPLOYEE_INVITE_TENANT_CONFLICT: "This email is already linked to another company.",
  EMPLOYEE_INVITE_REDIRECT_MISMATCH: "Invite delivery is blocked by the sign-in redirect configuration.",
  EMPLOYEE_INVITE_PROVIDER_CONFIG: "The invite email provider is not fully configured.",
  EMPLOYEE_INVITE_USER_LOOKUP_FAILED: "The invite could not be linked to this person's account.",
  EMPLOYEE_INVITE_METADATA_FAILED: "The invite was sent but account setup did not finish.",
};

function isInviteExpired(lastSentAt: string | null): boolean {
  if (!lastSentAt) return false;
  const ageMs = Date.now() - new Date(lastSentAt).getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 2;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getResendCooldownSeconds(lastAttemptAt: string | null): number {
  if (!lastAttemptAt) return 0;
  const elapsedSeconds = Math.floor((Date.now() - new Date(lastAttemptAt).getTime()) / 1000);
  return Math.max(0, INVITE_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; employee?: string; activation_link?: string; q?: string; filter?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error, employee: employeeParam, activation_link: activationLink, q, filter } = await searchParams;

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role !== "admin") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <AppShell actor={actor} activePath="/employees" />
        <div className="space-y-2 border-b border-ink-300/60 pb-5">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Restricted</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Team roster</h1>
        </div>
        <p className="mt-7 max-w-prose text-[15px] text-ink-700">
          The team roster is admin-only in TeamFrame. Ask your founder or admin to share what you need.
        </p>
      </main>
    );
  }

  const employees = await listEmployeesForAdmin(actor);
  const positions = await listPositions(actor);
  const positionByEmployeeId = new Map(
    positions
      .filter((position) => position.assigned_employee_id)
      .map((position) => [position.assigned_employee_id!, position]),
  );
  const employeeDocuments = await Promise.all(
    employees.map(async (employee) => ({
      employeeId: employee.id,
      documents: await listDocumentsForEmployee(actor, employee.id),
    })),
  );
  const documentsByEmployee = new Map(
    employeeDocuments.map((item) => [item.employeeId, item.documents]),
  );
  const invitePending = employees.filter((e) => e.status !== "inactive" && e.setup_status === "incomplete").length;
  const inviteSent = employees.filter((e) => e.status !== "inactive" && e.setup_status === "ready").length;
  const inviteActivated = employees.filter((e) => e.setup_status === "active").length;
  const archived = employees.filter((e) => e.status === "inactive").length;
  const query = (q ?? "").trim().toLowerCase();
  const activeFilter = filter === "attention" || filter === "active" || filter === "archived" ? filter : "all";

  function inviteState(employeeRecord: (typeof employees)[number]): {
    label: "Pending delivery" | "Sent" | "Activated" | "Archived" | "Delivery failed" | "Rate limited";
    tone: StatusPillTone;
    help: string;
  } {
    if (employeeRecord.status === "inactive") {
      return {
        label: "Archived",
        tone: "neutral",
        help: "This profile is archived and hidden from active workflows.",
      };
    }
    if (employeeRecord.setup_status === "active") {
      return {
        label: "Activated",
        tone: "green",
        help: employeeRecord.activated_at
          ? `Activated on ${formatDateTime(employeeRecord.activated_at)}.`
          : "Invite accepted and employee can access TeamFrame.",
      };
    }
    if (employeeRecord.invite_last_error === "EMPLOYEE_INVITE_RATE_LIMIT") {
      return {
        label: "Rate limited",
        tone: "amber",
        help: "Invite provider throttled this address. Wait briefly, then use Re-send invite or the activation link.",
      };
    }
    if (employeeRecord.invite_last_error) {
      const reason =
        INVITE_FAILURE_COPY[employeeRecord.invite_last_error] ??
        "The last invite email could not be delivered.";
      return {
        label: "Delivery failed",
        tone: "red",
        help: `${reason} Use Re-send invite or generate a new activation link.`,
      };
    }
    if (employeeRecord.setup_status === "ready") {
      return {
        label: "Sent",
        tone: "info",
        help: isInviteExpired(employeeRecord.invite_last_sent_at)
          ? "Invite was sent and may be expiring soon. Re-send invite or generate a fresh activation link."
          : "Invite sent and waiting for first login.",
      };
    }

    return {
      label: "Pending delivery",
      tone: "amber",
      help:
        employeeRecord.invite_attempt_count > 0
          ? "Invite is still pending delivery. Re-send invite if the employee has not received it."
          : "No invite has been sent yet. Use Re-send invite or generate an activation link.",
    };
  }

  const filteredEmployees = employees.filter((employee) => {
    const matchesQuery =
      !query ||
      employee.full_name.toLowerCase().includes(query) ||
      employee.email.toLowerCase().includes(query) ||
      employee.role_title.toLowerCase().includes(query) ||
      employee.department.toLowerCase().includes(query);
    const hasAttention =
      employee.status !== "inactive" &&
      (employee.setup_status !== "active" || Boolean(employee.invite_last_error));
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "attention" && hasAttention) ||
      (activeFilter === "active" && employee.status !== "inactive") ||
      (activeFilter === "archived" && employee.status === "inactive");
    return matchesQuery && matchesFilter;
  });
  const detailEmployees = employeeParam
    ? employees.filter((employee) => employee.id === employeeParam)
    : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <AppShell actor={actor} activePath="/employees" />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin queue</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Team roster</h1>
        </div>
      </div>

      <p className="mt-7 max-w-2xl text-[15px] text-ink-700">
        Add teammates, track invite progress, and keep onboarding moving from one place.
      </p>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Invite pending</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{invitePending}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Invite sent</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{inviteSent}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Signed in and active</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{inviteActivated}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Archived profiles</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{archived}</p>
        </article>
      </section>

      {successMessage ? (
        <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="mt-7 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red"
        >
          {errorMessage}
        </p>
      ) : null}

      <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
        <div className="border-b border-ink-300/60 px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[17px] font-medium tracking-tight">Directory</h2>
              <p className="mt-1 text-[13px] text-ink-500">
                Search the team and open one record for documents, exports, and account actions.
              </p>
            </div>
            <form className="flex w-full flex-wrap gap-2 lg:w-auto">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search name, role, department"
                className="min-w-0 flex-1 rounded-md border border-ink-300 px-3 py-2 text-[13px] text-ink-900 lg:w-64"
              />
              <select
                name="filter"
                defaultValue={activeFilter}
                className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-900"
              >
                <option value="all">All</option>
                <option value="attention">Needs attention</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <button
                type="submit"
                className="rounded-md bg-brand-signal px-4 py-2 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F]"
              >
                Apply
              </button>
            </form>
          </div>
        </div>

        {employees.length === 0 ? (
          <EmptyState
            message="No employees yet — your first teammate is one form away."
            cta={{ label: "↓ Use the Add employee form below", href: "#add-employee" }}
            className="m-5"
          />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            message="No employees match this view."
            hint="Clear the search or switch the status filter."
            className="m-5"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="border-b border-ink-300/60 text-[11px] uppercase tracking-[0.1em] text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-5 py-3 font-medium">Function</th>
                  <th className="px-5 py-3 font-medium">Position</th>
                  <th className="px-5 py-3 font-medium">Employee state</th>
                  <th className="px-5 py-3 font-medium">Account</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-300/40">
                {filteredEmployees.map((employee) => {
                  const state = inviteState(employee);
                  const position = positionByEmployeeId.get(employee.id);
                  const needsAttention =
                    employee.status !== "inactive" &&
                    (employee.setup_status !== "active" || Boolean(employee.invite_last_error));
                  return (
                    <tr key={employee.id} className="align-top">
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink-900">{employee.full_name}</p>
                        <p className="text-[12px] text-ink-500">{employee.email}</p>
                      </td>
                      <td className="px-5 py-3 text-ink-700">
                        <p>{employee.role_title}</p>
                        <p className="text-[12px] text-ink-500">{employee.department}</p>
                      </td>
                      <td className="px-5 py-3 text-ink-700">
                        {position ? (
                          <a
                            href="/org-chart"
                            className="text-[12px] font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
                          >
                            {position.title}
                          </a>
                        ) : (
                          <span className="text-[12px] text-ink-500">No assigned position</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill tone={needsAttention ? "amber" : employee.status === "inactive" ? "neutral" : "green"}>
                          {needsAttention ? "Needs attention" : employee.status.replace("_", " ")}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      </td>
                      <td className="px-5 py-3">
                        <a
                          href={`/employees?employee=${employee.id}#employee-${employee.id}`}
                          className="text-[12px] font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
                        >
                          Open record
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 space-y-4">
        {employees.length === 0 ? (
          null
        ) : detailEmployees.length === 0 ? (
          <EmptyState
            message="Select an employee to view readiness evidence."
            hint="Open a record from the directory table above to manage documents, invite state, and exports."
          />
        ) : (
          detailEmployees.map((employee) => (
            <article id={`employee-${employee.id}`} key={employee.id} className="rounded-xl border border-ink-300/70 bg-white/80 p-5">
              {(() => {
                const resendCooldownSeconds = getResendCooldownSeconds(employee.invite_last_attempt_at);
                const resendBlocked = resendCooldownSeconds > 0;
                const documents = documentsByEmployee.get(employee.id) ?? [];
                const position = positionByEmployeeId.get(employee.id);
                const state = inviteState(employee);
                const detailOpen = employeeParam === employee.id;
                const resendGuidance = resendBlocked
                  ? `Re-send cooldown active: retry in ${resendCooldownSeconds}s.`
                  : "If delivery is delayed, use Re-send invite first, then activation link as fallback.";

                return (
                  <>
              {status === "reinvited" && employeeParam === employee.id ? (
                <p className="mb-3 rounded-md border border-signal-green/30 bg-signal-green/10 px-3 py-2 text-[13px] text-signal-green">
                  Invite re-sent to this employee.
                </p>
              ) : null}
              {status === "activation_link_ready" && employeeParam === employee.id && activationLink ? (
                <div className="mb-3 rounded-md border border-signal-green/30 bg-signal-green/10 px-3 py-2 text-[13px] text-signal-green">
                  <p>Activation link generated for this employee.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={activationLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] underline decoration-signal-green/40 underline-offset-4"
                    >
                      Open activation link
                    </a>
                    <CopyInviteEmailButton
                      email={activationLink}
                      copyValue={activationLink}
                      idleLabel="Copy activation link"
                      copiedLabel="Activation link copied"
                    />
                  </div>
                </div>
              ) : null}
              <details open={detailOpen} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <div>
                    <h3 className="text-[19px] font-medium tracking-tight">{employee.full_name}</h3>
                    <p className="text-[13px] text-ink-500">{employee.email}</p>
                    <p className="mt-2">
                      <StatusPill tone={state.tone} className="uppercase tracking-[0.08em]">
                        {state.label}
                      </StatusPill>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-[12px] capitalize tracking-[0.12em] text-ink-500">
                      {employee.status.replace("_", " ")}
                    </span>
                    <span className="text-[12px] text-ink-700 underline decoration-ink-300 underline-offset-4 group-open:hidden">
                      View details
                    </span>
                    <span className="hidden text-[12px] text-ink-700 underline decoration-ink-300 underline-offset-4 group-open:inline">
                      Hide details
                    </span>
                  </div>
                </summary>

                <p className="mt-2 text-[12px] text-ink-500">{state.help}</p>

                <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-md border border-ink-300/50 bg-white px-4 py-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Email</dt>
                    <dd className="mt-0.5 text-ink-900">{employee.email}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Role title</dt>
                    <dd className="mt-0.5 text-ink-900">{employee.role_title}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Position</dt>
                    <dd className="mt-0.5 text-ink-900">
                      {position ? (
                        <a href="/org-chart" className="underline decoration-ink-300 underline-offset-4">
                          {position.title}
                        </a>
                      ) : (
                        "No assigned position"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Department</dt>
                    <dd className="mt-0.5 text-ink-900">{employee.department}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Timezone</dt>
                    <dd className="mt-0.5 text-ink-900">{employee.timezone}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Country</dt>
                    <dd className="mt-0.5 text-ink-900">{employee.country ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Lifecycle state</dt>
                    <dd className="mt-0.5 capitalize text-ink-900">{employee.lifecycle_state.replace("_", " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Invite state</dt>
                    <dd className="mt-0.5 text-ink-900">{state.label}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Employment</dt>
                    <dd className="mt-0.5 capitalize text-ink-900">{employee.employment_type.replace("_", " ")}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink-300 bg-ink-100/50 px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900">Due diligence pack</p>
                    <p className="text-[12px] text-ink-500">
                      Employment record, documents, policy acknowledgements, and relevant action records in one export.
                    </p>
                  </div>
                  <form action={exportEmployeeDueDiligencePackAction}>
                    <input type="hidden" name="employee_id" value={employee.id} />
                    <input type="hidden" name="return_to" value="/employees" />
                    <PendingSubmitButton
                      idleLabel="Export due diligence pack"
                      pendingLabel="Preparing pack…"
                      className="rounded-md bg-brand-signal px-4 py-2 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300"
                    />
                  </form>
                </div>

              <form action={updateEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-4">
                <input type="hidden" name="employee_id" value={employee.id} />
                <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                  Role title
                  <input
                    name="role_title"
                    defaultValue={employee.role_title}
                    className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                  Department
                  <input
                    name="department"
                    defaultValue={employee.department}
                    className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                  Employment type
                  <select
                    name="employment_type"
                    defaultValue={employee.employment_type}
                    className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900 bg-white"
                  >
                    <option value="full_time">Full time</option>
                    <option value="part_time">Part time</option>
                    <option value="contractor">Contractor</option>
                    <option value="intern">Intern</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                  Country
                  <input
                    name="country"
                    defaultValue={employee.country ?? ""}
                    className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                  Start date
                  <input
                    name="start_date"
                    type="date"
                    defaultValue={employee.start_date ?? ""}
                    className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                  End date
                  <input
                    name="end_date"
                    type="date"
                    defaultValue={employee.end_date ?? ""}
                    className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                  Status
                  <select
                    name="status"
                    defaultValue={employee.status}
                    className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <div className="flex flex-col justify-end">
                  <PendingSubmitButton
                    idleLabel="Save"
                    pendingLabel="Saving…"
                    className="rounded-md bg-brand-signal px-3 py-2 text-[14px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300"
                  />
                </div>
              </form>

              <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-md border border-ink-300/50 bg-ink-100/40 px-4 py-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Invite attempts</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-ink-700">{employee.invite_attempt_count}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Last attempted</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-ink-700">{formatDateTime(employee.invite_last_attempt_at)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Last delivered</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-ink-700">{formatDateTime(employee.invite_last_sent_at)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Activated</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-ink-700">{formatDateTime(employee.activated_at)}</dd>
                </div>
              </dl>

              <section className="mt-4 rounded-md border border-ink-300/50 bg-white px-3 py-3">
                <h4 className="text-[13px] font-medium text-ink-900">Documents</h4>

                <form action={uploadEmployeeDocumentAction} className="mt-3 grid gap-2 md:grid-cols-4" encType="multipart/form-data">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="return_to" value="/employees" />
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Document type
                    <select
                      name="type"
                      defaultValue="contract"
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900 bg-white"
                    >
                      <option value="contract">Contract</option>
                      <option value="cv">CV</option>
                      <option value="jd">Job description</option>
                      <option value="photo">Photo</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    File
                    <input
                      name="file"
                      type="file"
                      required
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Signed on (optional)
                    <input
                      name="signed_at"
                      type="date"
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Expires on (optional)
                    <input
                      name="expires_at"
                      type="date"
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900"
                    />
                  </label>
                  <PendingSubmitButton
                    idleLabel="Upload document"
                    pendingLabel="Uploading…"
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300"
                  />
                </form>

                {documents.length === 0 ? (
                  <EmptyState
                    message="No documents uploaded yet. Add a contract or ID with the upload form above."
                    className="mt-3 px-3 py-4"
                  />
                ) : (
                  <ul className="mt-3 space-y-2">
                    {documents.map((document) => (
                      <li key={document.id} className="rounded-md border border-ink-300/50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[12px] text-ink-700">
                            <p className="font-medium text-ink-900">{document.type.toUpperCase()}</p>
                            <p>Uploaded <span className="font-mono tabular-nums">{formatDateTime(document.created_at)}</span></p>
                            <p>Signed: <span className="font-mono tabular-nums">{document.signed_at ? formatDateTime(document.signed_at) : "-"}</span></p>
                            <p>Expires: <span className="font-mono tabular-nums">{document.expires_at ? formatDateTime(document.expires_at) : "-"}</span></p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <form action={downloadEmployeeDocumentAction}>
                              <input type="hidden" name="document_id" value={document.id} />
                              <input type="hidden" name="return_to" value="/employees" />
                              <PendingSubmitButton
                                idleLabel="Download"
                                pendingLabel="Preparing…"
                                className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300"
                              />
                            </form>
                            <form action={deleteEmployeeDocumentAction}>
                              <input type="hidden" name="document_id" value={document.id} />
                              <input type="hidden" name="employee_id" value={employee.id} />
                              <input type="hidden" name="return_to" value="/employees" />
                              <ConfirmSubmitButton
                                idleLabel="Delete"
                                pendingLabel="Deleting…"
                                confirmMessage="Delete this document from active records?"
                                className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300"
                              />
                            </form>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

              </section>

              <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="w-full sm:w-auto">
                  <CopyInviteEmailButton email={employee.email} />
                </div>
                {employee.setup_status !== "active" && employee.status !== "inactive" ? (
                  <>
                    <form action={reinviteEmployeeAction} className="w-full sm:w-auto">
                      <input type="hidden" name="employee_id" value={employee.id} />
                      <input type="hidden" name="return_to" value="/employees" />
                      <PendingSubmitButton
                        idleLabel="Re-send invite"
                        pendingLabel="Sending…"
                        disabled={resendBlocked}
                        disabledLabel={`Retry in ${resendCooldownSeconds}s`}
                        className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300 sm:w-auto"
                      />
                    </form>
                    <form action={generateActivationLinkAction} className="w-full sm:w-auto">
                      <input type="hidden" name="employee_id" value={employee.id} />
                      <input type="hidden" name="return_to" value="/employees" />
                      <PendingSubmitButton
                        idleLabel="Generate activation link"
                        pendingLabel="Generating…"
                        className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300 sm:w-auto"
                      />
                    </form>
                  </>
                ) : null}
                <form action={startOffboardingAction} className="w-full sm:w-auto">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                  <input type="hidden" name="return_to" value="/employees" />
                  <ConfirmSubmitButton
                    idleLabel="Start offboarding"
                    pendingLabel="Starting…"
                    confirmMessage={`Start offboarding for ${employee.full_name}?`}
                    className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300 sm:w-auto"
                  />
                </form>
                <form action={archiveEmployeeAction} className="w-full sm:w-auto">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                  <input type="hidden" name="return_to" value="/employees" />
                  <ConfirmSubmitButton
                    idleLabel="Archive employee"
                    pendingLabel="Archiving…"
                    confirmMessage={`Archive ${employee.full_name}? This removes them from active workflows.`}
                    className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300 sm:w-auto"
                  />
                </form>
              </div>
              {employee.setup_status !== "active" && employee.status !== "inactive" ? (
                <p className="mt-2 text-[12px] text-ink-500">{resendGuidance}</p>
              ) : null}
              </details>
                  </>
                );
              })()}
            </article>
          ))
        )}
      </section>
      <section id="add-employee" className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
        <h2 className="text-[19px] font-medium tracking-tight">Add employee</h2>
        <form action={createEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Full name
            <input
              name="full_name"
              placeholder="e.g. Amina Rahman"
              required
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Work email
            <input
              name="email"
              type="email"
              placeholder="work@company.com"
              required
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Role title
            <input
              name="role_title"
              placeholder="e.g. Software Engineer"
              required
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Department
            <input
              name="department"
              placeholder="e.g. Engineering"
              required
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Timezone
            <input
              name="timezone"
              placeholder="e.g. UTC"
              defaultValue="UTC"
              required
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Employment type
            <select
              name="employment_type"
              defaultValue="full_time"
              required
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900 bg-white"
            >
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contractor">Contractor</option>
              <option value="intern">Intern</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Country
            <input
              name="country"
              placeholder="e.g. UAE"
              required
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Start date
            <input
              name="start_date"
              type="date"
              required
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            End date (optional)
            <input
              name="end_date"
              type="date"
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
            />
          </label>
          <div className="flex flex-col justify-end">
            <PendingSubmitButton
              idleLabel="Create employee"
              pendingLabel="Creating…"
              className="rounded-md bg-brand-signal px-4 py-2 text-[14px] font-medium text-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
            />
          </div>
        </form>
      </section>

      <section className="mt-5 rounded-xl border border-ink-300/70 bg-white/75 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] tracking-[0.12em] text-ink-500">Finance export</p>
            <p className="mt-1 text-[14px] text-ink-700">Download a finance handoff package (CSV + spreadsheet-friendly TSV).</p>
          </div>
          <form action={exportFinanceHandoffAction}>
            <input type="hidden" name="return_to" value="/employees" />
            <PendingSubmitButton
              idleLabel="Export finance handoff"
              pendingLabel="Preparing export…"
              className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300"
            />
          </form>
        </div>
      </section>

    </main>
  );
}
