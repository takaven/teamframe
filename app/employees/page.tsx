import { requireTenantActor } from "@/middleware/rbac";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  INVITE_RESEND_COOLDOWN_SECONDS,
  listEmployeesForAdmin,
} from "@/services/employeeService";
import { listDocumentsForEmployee } from "@/services/documentService";
import Link from "next/link";
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
import { SignOutButton } from "@/components/SignOutButton";

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
  INVALID_INPUT: "Input validation failed.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function isInviteExpired(lastSentAt: string | null): boolean {
  if (!lastSentAt) return false;
  const ageMs = Date.now() - new Date(lastSentAt).getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 2;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
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
  searchParams: Promise<{ status?: string; error?: string; employee?: string; activation_link?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error, employee: employeeParam, activation_link: activationLink } = await searchParams;

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role !== "admin") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <nav className="mb-6 flex items-center gap-4 text-[14px] text-ink-500">
          <Link href="/dashboard" className="hover:text-ink-900 transition">Dashboard</Link>
          <span className="text-ink-900 font-medium">Team roster</span>
          <Link href="/onboarding" className="hover:text-ink-900 transition">Onboarding</Link>
          <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
          <SignOutButton className="ml-auto" />
        </nav>
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

  function inviteState(employeeRecord: (typeof employees)[number]): {
    label: "Pending delivery" | "Sent" | "Activated" | "Archived" | "Delivery failed" | "Rate limited";
    tone: string;
    help: string;
  } {
    if (employeeRecord.status === "inactive") {
      return {
        label: "Archived",
        tone: "border-ink-300 bg-ink-100 text-ink-700",
        help: "This profile is archived and hidden from active workflows.",
      };
    }
    if (employeeRecord.setup_status === "active") {
      return {
        label: "Activated",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
        help: employeeRecord.activated_at
          ? `Activated on ${formatDateTime(employeeRecord.activated_at)}.`
          : "Invite accepted and employee can access TeamFrame.",
      };
    }
    if (employeeRecord.invite_last_error === "EMPLOYEE_INVITE_RATE_LIMIT") {
      return {
        label: "Rate limited",
        tone: "border-amber-200 bg-amber-50 text-amber-700",
        help: "Invite provider throttled this address. Wait briefly, then use Re-send invite or the activation link.",
      };
    }
    if (employeeRecord.invite_last_error) {
      return {
        label: "Delivery failed",
        tone: "border-red-200 bg-red-50 text-red-700",
        help: `Last invite error: ${employeeRecord.invite_last_error}. Use Re-send invite or generate a new activation link.`,
      };
    }
    if (employeeRecord.setup_status === "ready") {
      return {
        label: "Sent",
        tone: "border-sky-200 bg-sky-50 text-sky-700",
        help: isInviteExpired(employeeRecord.invite_last_sent_at)
          ? "Invite was sent and may be expiring soon. Re-send invite or generate a fresh activation link."
          : "Invite sent and waiting for first login.",
      };
    }

    return {
      label: "Pending delivery",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      help:
        employeeRecord.invite_attempt_count > 0
          ? "Invite is still pending delivery. Re-send invite if the employee has not received it."
          : "No invite has been sent yet. Use Re-send invite or generate an activation link.",
    };
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <nav className="mb-6 flex items-center gap-4 text-[14px] text-ink-500">
        <Link href="/dashboard" className="hover:text-ink-900 transition">Dashboard</Link>
        <span className="text-ink-900 font-medium">Team roster</span>
        <Link href="/onboarding" className="hover:text-ink-900 transition">Onboarding</Link>
        <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
        <Link href="/policies" className="hover:text-ink-900 transition">Policies</Link>
        <SignOutButton className="ml-auto" />
      </nav>
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
          <p className="mt-2 text-[24px] tracking-tight">{invitePending}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Invite sent</p>
          <p className="mt-2 text-[24px] tracking-tight">{inviteSent}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Signed in and active</p>
          <p className="mt-2 text-[24px] tracking-tight">{inviteActivated}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Archived profiles</p>
          <p className="mt-2 text-[24px] tracking-tight">{archived}</p>
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
          className="mt-7 rounded-lg border border-ink-300/80 bg-white/80 px-4 py-3 text-[14px] text-ink-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <section id="add-employee" className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
        <h2 className="text-[19px] font-medium tracking-tight">Add employee</h2>
        <form action={createEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="full_name"
            placeholder="Full name"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="email"
            type="email"
            placeholder="work@company.com"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="role_title"
            placeholder="Role title"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="department"
            placeholder="Department"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="timezone"
            placeholder="Timezone (e.g. UTC)"
            defaultValue="UTC"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <select
            name="employment_type"
            defaultValue="full_time"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px] bg-white"
          >
            <option value="full_time">full_time</option>
            <option value="part_time">part_time</option>
            <option value="contractor">contractor</option>
            <option value="intern">intern</option>
          </select>
          <input
            name="country"
            placeholder="Country (e.g. UAE)"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="start_date"
            type="date"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="end_date"
            type="date"
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <PendingSubmitButton
            idleLabel="Create employee"
            pendingLabel="Creating..."
            className="rounded-md bg-ink-900 px-4 py-2 text-[14px] font-medium text-paper disabled:cursor-not-allowed disabled:bg-ink-300"
          />
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
              pendingLabel="Preparing export..."
              className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400"
            />
          </form>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {employees.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300/80 bg-white/60 px-5 py-8 text-center">
            <p className="text-[15px] text-ink-700">No employees yet — your first teammate is one form away.</p>
            <a
              href="#add-employee"
              className="mt-2 inline-flex items-center gap-1 text-[14px] text-ink-700 underline decoration-ink-300 underline-offset-4 transition hover:decoration-ink-900"
            >
              &uarr; Use the Add employee form above
            </a>
          </div>
        ) : (
          employees.map((employee) => (
            <article key={employee.id} className="rounded-xl border border-ink-300/70 bg-white/80 p-5">
              {(() => {
                const resendCooldownSeconds = getResendCooldownSeconds(employee.invite_last_attempt_at);
                const resendBlocked = resendCooldownSeconds > 0;
                const documents = documentsByEmployee.get(employee.id) ?? [];
                const state = inviteState(employee);
                const detailOpen = employeeParam === employee.id;
                const resendGuidance = resendBlocked
                  ? `Re-send cooldown active: retry in ${resendCooldownSeconds}s.`
                  : "If delivery is delayed, use Re-send invite first, then activation link as fallback.";

                return (
                  <>
              {status === "reinvited" && employeeParam === employee.id ? (
                <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
                  Invite re-sent to this employee.
                </p>
              ) : null}
              {status === "activation_link_ready" && employeeParam === employee.id && activationLink ? (
                <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
                  <p>Activation link generated for this employee.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={activationLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] underline decoration-emerald-300 underline-offset-4"
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
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] ${state.tone}`}>
                        {state.label}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-[12px] tracking-[0.12em] text-ink-500">
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

                <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-md border border-ink-200 bg-white px-4 py-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Email</dt>
                    <dd className="mt-0.5 text-ink-900">{employee.email}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Role title</dt>
                    <dd className="mt-0.5 text-ink-900">{employee.role_title}</dd>
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
                    <dd className="mt-0.5 text-ink-900">{employee.lifecycle_state.replace("_", " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Invite state</dt>
                    <dd className="mt-0.5 text-ink-900">{state.label}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-500">Employment</dt>
                    <dd className="mt-0.5 text-ink-900">{employee.employment_type.replace("_", " ")}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink-300 bg-ink-50/60 px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900">Due diligence pack</p>
                    <p className="text-[12px] text-ink-500">
                      Employment record, documents, policy acknowledgements, and asset-related logs in one export.
                    </p>
                  </div>
                  <form action={exportEmployeeDueDiligencePackAction}>
                    <input type="hidden" name="employee_id" value={employee.id} />
                    <input type="hidden" name="return_to" value="/employees" />
                    <PendingSubmitButton
                      idleLabel="Export due diligence pack"
                      pendingLabel="Preparing pack..."
                      className="rounded-md bg-ink-900 px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
                    />
                  </form>
                </div>

              <form action={updateEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-4">
                <input type="hidden" name="employee_id" value={employee.id} />
                <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                <input
                  name="role_title"
                  defaultValue={employee.role_title}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
                <input
                  name="department"
                  defaultValue={employee.department}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
                <select
                  name="employment_type"
                  defaultValue={employee.employment_type}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px] bg-white"
                >
                  <option value="full_time">full_time</option>
                  <option value="part_time">part_time</option>
                  <option value="contractor">contractor</option>
                  <option value="intern">intern</option>
                </select>
                <input
                  name="country"
                  defaultValue={employee.country ?? ""}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
                <input
                  name="start_date"
                  type="date"
                  defaultValue={employee.start_date ?? ""}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
                <input
                  name="end_date"
                  type="date"
                  defaultValue={employee.end_date ?? ""}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
                <select
                  name="status"
                  defaultValue={employee.status}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                >
                  <option value="active">active</option>
                  <option value="on_leave">on_leave</option>
                  <option value="inactive">inactive</option>
                </select>
                <PendingSubmitButton
                  idleLabel="Save"
                  pendingLabel="Saving..."
                  className="rounded-md bg-ink-900 px-3 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
                />
              </form>

              <div className="mt-3 rounded-md border border-ink-200 bg-ink-50/50 px-3 py-2 text-[12px] text-ink-600">
                <p>Invite attempts: {employee.invite_attempt_count}</p>
                <p>Last attempt: {formatDateTime(employee.invite_last_attempt_at)}</p>
                <p>Last sent: {formatDateTime(employee.invite_last_sent_at)}</p>
                <p>Activation: {formatDateTime(employee.activated_at)}</p>
              </div>

              <section className="mt-4 rounded-md border border-ink-200 bg-white px-3 py-3">
                <h4 className="text-[13px] font-medium text-ink-900">Documents</h4>

                <form action={uploadEmployeeDocumentAction} className="mt-3 grid gap-2 md:grid-cols-4" encType="multipart/form-data">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="return_to" value="/employees" />
                  <select
                    name="type"
                    defaultValue="contract"
                    className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] bg-white"
                  >
                    <option value="contract">contract</option>
                    <option value="cv">cv</option>
                    <option value="jd">jd</option>
                    <option value="photo">photo</option>
                  </select>
                  <input
                    name="file"
                    type="file"
                    required
                    className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px]"
                  />
                  <input
                    name="signed_at"
                    type="date"
                    className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px]"
                  />
                  <input
                    name="expires_at"
                    type="date"
                    className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px]"
                  />
                  <PendingSubmitButton
                    idleLabel="Upload document"
                    pendingLabel="Uploading..."
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400"
                  />
                </form>

                {documents.length === 0 ? (
                  <p className="mt-3 text-[12px] text-ink-500">
                    No documents uploaded yet. Add a contract or ID with the upload form above.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {documents.map((document) => (
                      <li key={document.id} className="rounded-md border border-ink-200 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[12px] text-ink-700">
                            <p className="font-medium text-ink-900">{document.type.toUpperCase()}</p>
                            <p>Uploaded {formatDateTime(document.created_at)}</p>
                            <p>Signed: {document.signed_at ? formatDateTime(document.signed_at) : "-"}</p>
                            <p>Expires: {document.expires_at ? formatDateTime(document.expires_at) : "-"}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <form action={downloadEmployeeDocumentAction}>
                              <input type="hidden" name="document_id" value={document.id} />
                              <input type="hidden" name="return_to" value="/employees" />
                              <PendingSubmitButton
                                idleLabel="Download"
                                pendingLabel="Preparing..."
                                className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400"
                              />
                            </form>
                            <form action={deleteEmployeeDocumentAction}>
                              <input type="hidden" name="document_id" value={document.id} />
                              <input type="hidden" name="employee_id" value={employee.id} />
                              <input type="hidden" name="return_to" value="/employees" />
                              <ConfirmSubmitButton
                                idleLabel="Delete"
                                pendingLabel="Deleting..."
                                confirmMessage="Delete this document from active records?"
                                className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400"
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
                        pendingLabel="Sending..."
                        disabled={resendBlocked}
                        disabledLabel={`Retry in ${resendCooldownSeconds}s`}
                        className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400 sm:w-auto"
                      />
                    </form>
                    <form action={generateActivationLinkAction} className="w-full sm:w-auto">
                      <input type="hidden" name="employee_id" value={employee.id} />
                      <input type="hidden" name="return_to" value="/employees" />
                      <PendingSubmitButton
                        idleLabel="Generate activation link"
                        pendingLabel="Generating..."
                        className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400 sm:w-auto"
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
                    pendingLabel="Starting..."
                    confirmMessage={`Start offboarding for ${employee.full_name}?`}
                    className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400 sm:w-auto"
                  />
                </form>
                <form action={archiveEmployeeAction} className="w-full sm:w-auto">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                  <input type="hidden" name="return_to" value="/employees" />
                  <ConfirmSubmitButton
                    idleLabel="Archive employee"
                    pendingLabel="Archiving..."
                    confirmMessage={`Archive ${employee.full_name}? This removes them from active workflows.`}
                    className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400 sm:w-auto"
                  />
                </form>
              </div>
              <p className="mt-2 text-[12px] text-ink-500">{resendGuidance}</p>
              </details>
                  </>
                );
              })()}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
