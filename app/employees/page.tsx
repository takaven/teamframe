import { requireTenantActor } from "@/middleware/rbac";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  INVITE_RESEND_COOLDOWN_SECONDS,
  getEmployeeWorkCountry,
  listEmployeesForAdmin,
} from "@/services/employeeService";
import { UAE_COUNTRY, UAE_RECORD_TYPES, isUaeRecordType, uaeRecordLabel } from "@/lib/countryRecords";
import { listDocumentRequirementsForEmployee, listDocumentsForEmployee } from "@/services/documentService";
import { listEmploymentChangesForEmployee } from "@/services/employmentChangeService";
import { getOffboardingLeaveReconciliation, listOffboardingForEmployee } from "@/services/offboardingService";
import { listPositions } from "@/services/positionService";
import { listEarlyEmploymentForAdmin } from "@/services/earlyEmploymentService";
import { getEmployeeMasterRecord, listEmployeePhotoUrls } from "@/services/employeeMasterService";
import { listAssignmentsForEmployee } from "@/services/positionAssignmentService";
import { listDepartments } from "@/services/configurationService";
import {
  RecordHeader,
  PersonalPanel,
  EmploymentReadPanel,
  CompensationReadPanel,
  PaymentReadPanel,
  EmergencyReadPanel,
} from "@/components/EmployeeMasterSections";
import { SectionTabs } from "@/components/SectionTabs";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { CopyInviteEmailButton } from "./CopyInviteEmailButton";
import {
  createEmployeeAction,
  createDocumentRequirementAction,
  deleteEmployeeDocumentAction,
  downloadEmployeeDocumentAction,
  exportFinanceHandoffAction,
  exportEmployeeDueDiligencePackAction,
  generateActivationLinkAction,
  cancelEmploymentChangeAction,
  cancelOffboardingAction,
  completeOffboardingItemAction,
  recordEmploymentChangeAction,
  startOffboardingAction,
  updateEmployeeAction,
  archiveEmployeeAction,
  reinviteEmployeeAction,
  reviewDocumentRequirementAction,
  uploadEmployeeDocumentAction,
  uploadUaeRecordAction,
} from "./actions";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill, type StatusPillTone } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  created: "Employee created.",
  updated: "Employee updated.",
  offboarding_started: "Offboarding started.",
  offboarding_cancelled: "Offboarding cancelled.",
  offboarding_item_completed: "Offboarding item completed.",
  archived: "Employee archived.",
  reinvited: "Invite link sent. The employee should use the newest email only.",
  activation_link_ready: "Activation link generated.",
  document_uploaded: "Document uploaded.",
  photo_updated: "Profile photo updated.",
  document_deleted: "Document deleted.",
  document_requested: "Document request created.",
  document_reviewed: "Document evidence reviewed.",
  due_diligence_pack_exported: "Due diligence pack prepared.",
  employment_change_recorded: "Employment change recorded.",
  employment_change_cancelled: "Employment change cancelled.",
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
  OFFBOARDING_START_FAILED: "Could not start offboarding.",
  OFFBOARDING_END_DATE_REQUIRED: "Choose an effective end date before starting offboarding.",
  OFFBOARDING_EMPLOYEE_NOT_ELIGIBLE: "This employee is not eligible for offboarding.",
  OFFBOARDING_ITEM_COMPLETE_FAILED: "Could not complete offboarding item.",
  OFFBOARDING_CANCEL_FAILED: "Could not cancel offboarding.",
  OFFBOARDING_NOT_FOUND: "No active offboarding workflow was found.",
  EVIDENCE_REQUIRED: "This offboarding item requires configured evidence and cannot be manually completed.",
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
  DOCUMENT_REQUIREMENT_CREATE_FAILED: "Could not create document request.",
  DOCUMENT_REQUIREMENT_LIST_FAILED: "Could not load document requests.",
  DOCUMENT_REQUIREMENT_REVIEW_FAILED: "Could not review document evidence.",
  DOCUMENT_REQUIREMENT_NOT_REVIEWABLE: "That document request is not ready for review.",
  DOCUMENT_FETCH_FAILED: "Document could not be found.",
  DOCUMENT_SIGNED_URL_FAILED: "Could not generate document download link.",
  DOCUMENT_DELETE_FAILED: "Could not delete document.",
  EMPLOYMENT_CHANGE_RECORD_FAILED: "Could not record the employment change.",
  EMPLOYMENT_CHANGE_CANCEL_FAILED: "Could not cancel the employment change.",
  EMPLOYMENT_CHANGE_CONFLICT: "A pending change already exists for that employee, date, and field.",
  EMPLOYMENT_CHANGE_EMPTY: "Choose at least one employment field to change.",
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

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatChangeKey(key: string): string {
  const labels: Record<string, string> = {
    role_title: "Role title",
    department: "Department",
    manager_id: "Manager",
    position_id: "Position",
    employment_type: "Employment type",
    country: "Country",
    grade: "Grade",
    start_date: "Start date",
    end_date: "End date",
    compensation: "Compensation",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

function formatChangeValue(key: string, value: unknown, lookup: Map<string, string>): string {
  if (value === null || value === undefined) return "None";
  if (typeof value !== "string") return JSON.stringify(value);
  if (key === "manager_id" || key === "position_id") return lookup.get(value) ?? value;
  if (key === "employment_type") return value.replace("_", " ");
  if (key === "start_date" || key === "end_date") return formatDate(value);
  return value;
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
  // Open probation reviews → drives the "Active · Probation" roster tag (probation is a
  // tag, never an employment status).
  const earlyEmployment = await listEarlyEmploymentForAdmin(actor);
  const probationEmployeeIds = new Set(
    earlyEmployment.probationReviews
      .filter((review) => review.status === "scheduled" || review.status === "due")
      .map((review) => review.employee_id),
  );
  const positions = await listPositions(actor);
  const departmentOptions = (await listDepartments(actor)).filter((d) => d.active);
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
  const employeeDocumentRequirements = await Promise.all(
    employees.map(async (employee) => ({
      employeeId: employee.id,
      requirements: await listDocumentRequirementsForEmployee(actor, employee.id),
    })),
  );
  const documentRequirementsByEmployee = new Map(
    employeeDocumentRequirements.map((item) => [item.employeeId, item.requirements]),
  );
  const detailEmployees = employeeParam
    ? employees.filter((employee) => employee.id === employeeParam)
    : [];
  const employmentChanges = await Promise.all(
    detailEmployees.map(async (employee) => ({
      employeeId: employee.id,
      changes: await listEmploymentChangesForEmployee(actor, employee.id),
    })),
  );
  const changesByEmployee = new Map(employmentChanges.map((item) => [item.employeeId, item.changes]));
  const offboardingWorkflows = await Promise.all(
    detailEmployees.map(async (employee) => ({
      employeeId: employee.id,
      workflow: await listOffboardingForEmployee(actor, employee.id),
      leaveReconciliation: await getOffboardingLeaveReconciliation(actor, employee.id),
    })),
  );
  const offboardingByEmployee = new Map(offboardingWorkflows.map((item) => [item.employeeId, item.workflow]));
  const offboardingLeaveByEmployee = new Map(offboardingWorkflows.map((item) => [item.employeeId, item.leaveReconciliation]));
  const employeeNameById = new Map(employees.map((employee) => [employee.id, employee.full_name]));
  // Structured master record (capability-gated compensation/payment) + position history
  // for the opened employee.
  const masterRecords = await Promise.all(
    detailEmployees.map(async (employee) => ({
      employeeId: employee.id,
      record: await getEmployeeMasterRecord(actor, employee.id),
      assignments: await listAssignmentsForEmployee(actor, employee.id),
    })),
  );
  const masterByEmployee = new Map(masterRecords.map((item) => [item.employeeId, item]));
  // Work country (ISO) for the opened employee — gates the UAE country-specific records section.
  const workCountries = await Promise.all(
    detailEmployees.map(async (employee) => ({ employeeId: employee.id, country: await getEmployeeWorkCountry(actor, employee.id) })),
  );
  const workCountryByEmployee = new Map(workCountries.map((item) => [item.employeeId, item.country]));
  const employeePhotos = await listEmployeePhotoUrls(actor);
  const photoByEmployeeId = new Map(employeePhotos.map((p) => [p.employee_id, p.photo_url]));
  const positionTitleById = new Map(positions.map((position) => [position.id, position.title]));
  const changeLookup = new Map([...employeeNameById, ...positionTitleById]);
  const currentEmployees = employees.filter((e) => e.canonical_lifecycle !== "FORMER");
  const invitePending = currentEmployees.filter((e) => e.setup_status === "incomplete").length;
  const inviteSent = currentEmployees.filter((e) => e.setup_status === "ready").length;
  const inviteActivated = currentEmployees.filter((e) => e.setup_status === "active").length;
  const archived = employees.filter((e) => e.canonical_lifecycle === "FORMER").length;
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
      employee.canonical_lifecycle !== "FORMER" &&
      (employee.setup_status !== "active" || Boolean(employee.invite_last_error));
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "attention" && hasAttention) ||
      (activeFilter === "active" && employee.canonical_lifecycle !== "FORMER") ||
      (activeFilter === "archived" && employee.canonical_lifecycle === "FORMER");
    return matchesQuery && matchesFilter;
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <AppShell actor={actor} activePath="/employees" />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-ink-800">Employees</h1>
          <p className="mt-1.5 text-[14px] text-ink-500">
            Your people, their records and onboarding progress — in one place.
          </p>
        </div>
      </div>

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
          <ul className="divide-y divide-ink-300/40">
            {filteredEmployees.map((employee) => {
              const state = inviteState(employee);
              const position = positionByEmployeeId.get(employee.id);
              const positionTitle = position?.title ?? null;
              const roleDiverges =
                !!positionTitle && employee.role_title.trim().toLowerCase() !== positionTitle.trim().toLowerCase();
              const primaryRole = positionTitle ?? employee.role_title;
              const needsAttention =
                employee.status !== "inactive" &&
                (employee.setup_status !== "active" || Boolean(employee.invite_last_error));
              return (
                <li key={employee.id}>
                  <a
                    href={`/employees?employee=${employee.id}#employee-${employee.id}`}
                    className="group grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 transition hover:bg-ink-50/70 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <EmployeeAvatar name={employee.full_name} photoUrl={photoByEmployeeId.get(employee.id) ?? null} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink-900">{employee.full_name}</p>
                        <p className="truncate text-[12.5px] text-ink-500">
                          {primaryRole}
                          {roleDiverges ? <span className="text-ink-400"> · Title: {employee.role_title}</span> : null}
                        </p>
                      </div>
                    </div>
                    <div className="hidden min-w-0 md:block">
                      <p className="truncate text-[13px] text-ink-700">{employee.department || "—"}</p>
                      <p className="truncate text-[12px] text-ink-500">{employee.work_location || "No work location"}</p>
                    </div>
                    <div className="flex items-center gap-3 justify-self-end">
                      <div className="text-right">
                        <StatusPill
                          tone={
                            employee.canonical_lifecycle === "FORMER"
                              ? "neutral"
                              : employee.canonical_lifecycle === "OFFBOARDING"
                                ? "amber"
                                : "green"
                          }
                        >
                          {employee.canonical_lifecycle_label}
                          {probationEmployeeIds.has(employee.id) && employee.canonical_lifecycle === "ACTIVE" ? " · Probation" : ""}
                        </StatusPill>
                        {needsAttention ? <p className="mt-1 text-[11px] text-ink-500">{state.label}</p> : null}
                      </div>
                      <span className="text-[13px] font-medium text-ink-300 transition group-hover:text-ink-900" aria-hidden>→</span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 space-y-4">
        {employees.length === 0 ? (
          null
        ) : detailEmployees.length === 0 ? (
          <EmptyState
            message="Select an employee to view their record."
            hint="Open a record from the directory table above to manage documents, invite state, and exports."
          />
        ) : (
          detailEmployees.map((employee) => (
            <article id={`employee-${employee.id}`} key={employee.id} className="rounded-xl border border-ink-300/70 bg-white/80 p-5">
              {(() => {
                const resendCooldownSeconds = getResendCooldownSeconds(employee.invite_last_attempt_at);
                const resendBlocked = resendCooldownSeconds > 0;
                const documents = documentsByEmployee.get(employee.id) ?? [];
                const documentRequirements = documentRequirementsByEmployee.get(employee.id) ?? [];
                const changes = changesByEmployee.get(employee.id) ?? [];
                const offboarding = offboardingByEmployee.get(employee.id) ?? null;
                const offboardingLeave = offboardingLeaveByEmployee.get(employee.id) ?? null;
                const position = positionByEmployeeId.get(employee.id);
                const resendGuidance = resendBlocked
                  ? `Re-send cooldown active: retry in ${resendCooldownSeconds}s.`
                  : "If delivery is delayed, use Re-send invite first, then activation link as fallback.";

                const master = masterByEmployee.get(employee.id);
                return (
                  <>
              {master ? (
                <RecordHeader
                  master={master.record}
                  photoUrl={photoByEmployeeId.get(employee.id) ?? null}
                  positionTitle={position?.title ?? null}
                  managerName={master.record.employment.manager_id ? employeeNameById.get(master.record.employment.manager_id) ?? null : null}
                />
              ) : null}
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
              <div className="mt-6">
              <SectionTabs
                ariaLabel="Employee record sections"
                initialId="employment"
                tabs={[
                  { id: "employment", label: "Employment" },
                  { id: "personal", label: "Personal" },
                  { id: "compensation", label: "Compensation" },
                  { id: "payment", label: "Bank & payment" },
                  { id: "emergency", label: "Emergency contact" },
                  { id: "documents", label: "Documents", badge: documents.length },
                  { id: "account", label: "Account & lifecycle" },
                ]}
              >
                {master ? (
                  <div data-tab="employment" className="space-y-4">
                    <EmploymentReadPanel
                      master={master.record}
                      positionTitle={position?.title ?? null}
                      managerName={master.record.employment.manager_id ? employeeNameById.get(master.record.employment.manager_id) ?? null : null}
                      assignments={master.assignments}
                    />
                  </div>
                ) : null}
                {master ? <div data-tab="personal"><PersonalPanel master={master.record} /></div> : null}
                {master ? <div data-tab="compensation"><CompensationReadPanel master={master.record} /></div> : null}
                {master ? <div data-tab="payment"><PaymentReadPanel master={master.record} /></div> : null}
                {master ? <div data-tab="emergency"><EmergencyReadPanel master={master.record} /></div> : null}

                <div data-tab="account" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white/70 p-5">
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
                      className="tf-secondary-action px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:text-ink-300"
                    />
                  </form>
                </div>

              <form action={updateEmployeeAction} data-tab="employment" className="grid gap-3 rounded-xl border border-ink-200 bg-white/70 p-5 md:grid-cols-4">
                <p className="text-[13px] font-bold text-ink-800 md:col-span-4">Edit employment</p>
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
                  <select
                    name="department"
                    defaultValue={employee.department}
                    className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px] text-ink-900"
                  >
                    {departmentOptions.some((d) => d.name === employee.department) ? null : (
                      <option value={employee.department}>{employee.department || "— Select department"}</option>
                    )}
                    {departmentOptions.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
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
                    className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px] font-medium text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300"
                  />
                </div>
              </form>

              <section data-tab="account" className="rounded-xl border border-ink-200 bg-white/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[13px] font-medium text-ink-900">Offboarding</h4>
                    <p className="mt-1 text-[12px] text-ink-500">
                      Departure workflow, handover work, final evidence and access closeout.
                    </p>
                  </div>
                  <StatusPill tone={offboarding ? "amber" : "neutral"}>
                    {offboarding ? `Ends ${formatDate(offboarding.case.effective_end_date)}` : "Not started"}
                  </StatusPill>
                </div>

                {offboarding ? (
                  <div className="mt-3 space-y-3">
                    {offboardingLeave ? (
                      <div className="rounded-md border border-ink-300/50 bg-ink-100/30 px-3 py-2 text-[12px] text-ink-700">
                        Leave reconciliation: {offboardingLeave.pending_leave_count} pending ·{" "}
                        {offboardingLeave.approved_crossing_end_count + offboardingLeave.approved_post_end_count} approved after end date
                      </div>
                    ) : null}
                    <ul className="divide-y divide-ink-300/40 rounded-md border border-ink-300/50">
                      {offboarding.items.map((item) => (
                        <li key={item.id} className="grid gap-3 px-3 py-2 text-[12px] md:grid-cols-[1fr_auto] md:items-center">
                          <div>
                            <p className="font-medium text-ink-900">{item.title}</p>
                            <p className="text-ink-500">
                              Owner: {item.owner_role} · Due: {formatDate(item.due_date)} · Mode: {item.completion_mode.replace(/_/g, " ")}
                            </p>
                          </div>
                          {item.status === "pending" && item.completion_mode === "manual_confirmation" ? (
                            <form action={completeOffboardingItemAction}>
                              <input type="hidden" name="item_id" value={item.id} />
                              <input type="hidden" name="expected_updated_at" value={item.updated_at} />
                              <input type="hidden" name="employee_id" value={employee.id} />
                              <input type="hidden" name="return_to" value="/employees" />
                              <PendingSubmitButton
                                idleLabel="Mark complete"
                                pendingLabel="Saving..."
                                className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:text-ink-300"
                              />
                            </form>
                          ) : (
                            <StatusPill tone={item.status === "completed" ? "green" : item.completion_mode === "document_required" ? "amber" : "neutral"}>
                              {item.status === "pending" && item.completion_mode === "document_required" ? "Needs evidence" : item.status}
                            </StatusPill>
                          )}
                        </li>
                      ))}
                    </ul>
                    <form action={cancelOffboardingAction}>
                      <input type="hidden" name="case_id" value={offboarding.case.id} />
                      <input type="hidden" name="employee_id" value={employee.id} />
                      <input type="hidden" name="return_to" value="/employees" />
                      <ConfirmSubmitButton
                        idleLabel="Cancel offboarding"
                        pendingLabel="Cancelling..."
                        confirmMessage={`Cancel offboarding for ${employee.full_name}?`}
                        className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:text-ink-300"
                      />
                    </form>
                  </div>
                ) : (
                  <form action={startOffboardingAction} className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                    <input type="hidden" name="employee_id" value={employee.id} />
                    <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                    <input type="hidden" name="return_to" value="/employees" />
                    <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                      Effective end date
                      <input
                        name="effective_end_date"
                        type="date"
                        required
                        defaultValue={employee.end_date ?? ""}
                        className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900"
                      />
                    </label>
                    <ConfirmSubmitButton
                      idleLabel="Start offboarding"
                      pendingLabel="Starting..."
                      confirmMessage={`Start offboarding for ${employee.full_name}?`}
                      className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:text-ink-300"
                    />
                  </form>
                )}
              </section>

              <section data-tab="employment" className="rounded-xl border border-ink-200 bg-white/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[13px] font-medium text-ink-900">Employment changes</h4>
                    <p className="mt-1 text-[12px] text-ink-500">
                      Record effective-dated changes without overwriting the previous employment facts.
                    </p>
                  </div>
                  <StatusPill tone={changes.some((change) => change.status === "pending") ? "amber" : "neutral"}>
                    {changes.filter((change) => change.status === "pending").length} pending
                  </StatusPill>
                </div>

                <form action={recordEmploymentChangeAction} className="mt-3 grid gap-2 md:grid-cols-3">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="return_to" value="/employees" />
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Effective date
                    <input
                      name="effective_date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    New role title
                    <input
                      name="role_title"
                      placeholder={employee.role_title}
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    New department
                    <select
                      name="department"
                      defaultValue=""
                      className="rounded-md border border-ink-300 bg-white px-2 py-1.5 text-[12px] text-ink-900"
                    >
                      <option value="">No change</option>
                      {departmentOptions.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Employment type
                    <select
                      name="employment_type"
                      defaultValue=""
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900 bg-white"
                    >
                      <option value="">No change</option>
                      <option value="full_time">Full time</option>
                      <option value="part_time">Part time</option>
                      <option value="contractor">Contractor</option>
                      <option value="intern">Intern</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Country/location
                    <input
                      name="country"
                      placeholder={employee.country ?? "No change"}
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Manager
                    <select
                      name="manager_id"
                      defaultValue=""
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900 bg-white"
                    >
                      <option value="">No change</option>
                      {employees
                        .filter((candidate) => candidate.id !== employee.id && candidate.canonical_lifecycle !== "FORMER")
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.full_name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Position
                    <select
                      name="position_id"
                      defaultValue=""
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900 bg-white"
                    >
                      <option value="">No change</option>
                      {positions
                        .filter((candidate) => !candidate.assigned_employee_id || candidate.assigned_employee_id === employee.id)
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="flex flex-col justify-end md:col-span-2">
                    <PendingSubmitButton
                      idleLabel="Record employment change"
                      pendingLabel="Recording…"
                      className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px] font-medium text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300"
                    />
                  </div>
                </form>

                {changes.length === 0 ? (
                  <p className="mt-3 rounded-md border border-ink-300/50 bg-ink-100/40 px-3 py-2 text-[12px] text-ink-500">
                    No employment changes have been recorded for this employee yet.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-[12px]">
                      <thead className="border-b border-ink-300/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Effective</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                          <th className="px-2 py-2 font-medium">Change</th>
                          <th className="px-2 py-2 font-medium">Applied by</th>
                          <th className="py-2 pl-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-300/40">
                        {changes.slice(0, 6).map((change) => (
                          <tr key={change.id} className="align-top">
                            <td className="py-2 pr-4 font-mono text-ink-700">{formatDate(change.effective_date)}</td>
                            <td className="px-2 py-2">
                              <StatusPill
                                tone={
                                  change.status === "applied"
                                    ? "green"
                                    : change.status === "pending"
                                      ? "amber"
                                      : change.status === "failed"
                                        ? "red"
                                        : "neutral"
                                }
                              >
                                {change.status}
                              </StatusPill>
                            </td>
                            <td className="px-2 py-2 text-ink-700">
                              <div className="space-y-1">
                                {change.change_keys.map((key) => (
                                  <p key={key}>
                                    <span className="font-medium text-ink-900">{formatChangeKey(key)}:</span>{" "}
                                    {formatChangeValue(key, change.old_values[key], changeLookup)} →{" "}
                                    {formatChangeValue(key, change.new_values[key], changeLookup)}
                                  </p>
                                ))}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-ink-500">
                              {change.applied_by_actor_type ? change.applied_by_actor_type : "-"}
                            </td>
                            <td className="py-2 pl-2">
                              {change.status === "pending" ? (
                                <form action={cancelEmploymentChangeAction}>
                                  <input type="hidden" name="employee_id" value={employee.id} />
                                  <input type="hidden" name="change_id" value={change.id} />
                                  <input type="hidden" name="return_to" value="/employees" />
                                  <ConfirmSubmitButton
                                    idleLabel="Cancel"
                                    pendingLabel="Cancelling…"
                                    confirmMessage="Cancel this pending employment change?"
                                    className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-ink-700 disabled:cursor-not-allowed disabled:text-ink-500"
                                  />
                                </form>
                              ) : (
                                <span className="text-ink-500">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <dl data-tab="account" className="grid gap-x-6 gap-y-2 rounded-xl border border-ink-200 bg-white/70 p-5 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
                <p className="text-[13px] font-bold text-ink-800 sm:col-span-2 lg:col-span-4">Invite diagnostics</p>
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

              <section data-tab="documents" className="rounded-xl border border-ink-200 bg-white/70 p-5">
                <h4 className="text-[13px] font-medium text-ink-900">Documents</h4>

                <form action={createDocumentRequirementAction} className="mt-3 grid gap-2 md:grid-cols-5">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="return_to" value="/employees" />
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Request type
                    <select
                      name="document_type"
                      defaultValue="contract"
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900 bg-white"
                    >
                      <option value="contract">Contract</option>
                      <option value="right_to_work">Right to work</option>
                      <option value="passport">Passport</option>
                      <option value="emirates_id">Emirates ID</option>
                      <option value="jd">Job description</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                    Due date
                    <input
                      name="due_date"
                      type="date"
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900"
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-[11px] text-ink-500">
                    <input name="expiry_required" type="checkbox" className="h-4 w-4 rounded border-ink-300" />
                    Expiry monitored
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-[11px] text-ink-500">
                    <input name="review_required" type="checkbox" className="h-4 w-4 rounded border-ink-300" />
                    Admin review
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-[11px] text-ink-500">
                    <input name="employee_upload_allowed" type="checkbox" defaultChecked className="h-4 w-4 rounded border-ink-300" />
                    Employee upload
                  </label>
                  <div className="md:col-span-5">
                    <PendingSubmitButton
                      idleLabel="Request evidence"
                      pendingLabel="Requesting…"
                      className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300"
                    />
                  </div>
                </form>

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
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-600 file:mr-2 file:rounded file:border file:border-ink-300 file:bg-white file:px-2 file:py-1 file:text-[12px] file:font-medium file:text-ink-700"
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

                {documentRequirements.length > 0 ? (
                  <div className="mt-3 rounded-md border border-ink-300/50 bg-ink-100/30">
                    <div className="border-b border-ink-300/40 px-3 py-2 text-[12px] font-medium text-ink-900">
                      Evidence requests
                    </div>
                    <ul className="divide-y divide-ink-300/40">
                      {documentRequirements.slice(0, 6).map((requirement) => (
                        <li key={requirement.id} className="grid gap-2 px-3 py-2 text-[12px] md:grid-cols-[1fr_auto] md:items-center">
                          <div>
                            <p className="font-medium text-ink-900">{requirement.document_type.replace(/_/g, " ")}</p>
                            <p className="text-ink-500">
                              State: {requirement.state} · Due: {requirement.due_date ? formatDate(requirement.due_date) : "-"}
                              {requirement.review_required ? " · Admin review required" : ""}
                            </p>
                          </div>
                          {requirement.state === "received" ? (
                            <div className="flex gap-2">
                              <form action={reviewDocumentRequirementAction}>
                                <input type="hidden" name="requirement_id" value={requirement.id} />
                                <input type="hidden" name="decision" value="accepted" />
                                <input type="hidden" name="return_to" value="/employees" />
                                <PendingSubmitButton
                                  idleLabel="Accept"
                                  pendingLabel="Accepting…"
                                  className="rounded-md bg-brand-signal px-3 py-1.5 text-[12px] font-medium text-ink-800 disabled:bg-ink-300"
                                />
                              </form>
                              <form action={reviewDocumentRequirementAction}>
                                <input type="hidden" name="requirement_id" value={requirement.id} />
                                <input type="hidden" name="decision" value="rejected" />
                                <input type="hidden" name="return_to" value="/employees" />
                                <PendingSubmitButton
                                  idleLabel="Reject"
                                  pendingLabel="Rejecting…"
                                  className="rounded-md border border-signal-red/40 px-3 py-1.5 text-[12px] font-medium text-signal-red disabled:text-ink-300"
                                />
                              </form>
                            </div>
                          ) : (
                            <StatusPill tone={requirement.state === "accepted" ? "green" : requirement.state === "expired" ? "red" : "amber"}>
                              {requirement.state}
                            </StatusPill>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

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

              {workCountryByEmployee.get(employee.id) === UAE_COUNTRY ? (
                <section data-tab="documents" className="rounded-xl border border-ink-200 bg-white/70 p-5">
                  <h4 className="text-[13px] font-medium text-ink-900">Country-specific records — UAE</h4>
                  <p className="mt-1 text-[12px] text-ink-500">
                    Factual record-keeping only. Store the document, its reference and dates, and evidence — TeamFrame does not assess legal compliance.
                  </p>

                  <form action={uploadUaeRecordAction} className="mt-3 grid gap-2 md:grid-cols-3" encType="multipart/form-data">
                    <input type="hidden" name="employee_id" value={employee.id} />
                    <input type="hidden" name="return_to" value="/employees" />
                    <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                      Record type
                      <select name="type" defaultValue="emirates_id" className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900 bg-white">
                        {UAE_RECORD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                      Reference number (optional)
                      <input name="reference_number" maxLength={120} placeholder="e.g. 784-XXXX-XXXXXXX-X" className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900" />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                      Evidence file
                      <input name="file" type="file" required className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-600 file:mr-2 file:rounded file:border file:border-ink-300 file:bg-white file:px-2 file:py-1 file:text-[12px] file:font-medium file:text-ink-700" />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                      Issue date (optional)
                      <input name="issued_at" type="date" className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900" />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                      Expiry date (optional)
                      <input name="expires_at" type="date" className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900" />
                    </label>
                    <div className="flex items-end">
                      <PendingSubmitButton
                        idleLabel="Save UAE record"
                        pendingLabel="Saving…"
                        className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300"
                      />
                    </div>
                  </form>

                  <form action={createDocumentRequirementAction} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="employee_id" value={employee.id} />
                    <input type="hidden" name="return_to" value="/employees" />
                    <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                      Request a UAE record
                      <select name="document_type" defaultValue="emirates_id" className="rounded-md border border-ink-300 px-2 py-1.5 text-[12px] text-ink-900 bg-white">
                        {UAE_RECORD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-[11px] text-ink-500">
                      <input name="expiry_required" type="checkbox" defaultChecked className="h-4 w-4 rounded border-ink-300" />
                      Expiry monitored
                    </label>
                    <PendingSubmitButton
                      idleLabel="Request record"
                      pendingLabel="Requesting…"
                      className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300"
                    />
                  </form>

                  {documents.filter((d) => isUaeRecordType(d.document_type)).length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {documents.filter((d) => isUaeRecordType(d.document_type)).map((document) => (
                        <li key={document.id} className="rounded-md border border-ink-300/50 px-3 py-2 text-[12px] text-ink-700">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-ink-900">{uaeRecordLabel(document.document_type)}</p>
                              {document.reference_number ? <p>Reference: <span className="font-mono">{document.reference_number}</span></p> : null}
                              <p>
                                Issued: <span className="font-mono tabular-nums">{document.issued_at ? formatDate(document.issued_at) : "-"}</span>
                                {" · "}Expires: <span className="font-mono tabular-nums">{document.expires_at ? formatDate(document.expires_at) : "-"}</span>
                              </p>
                            </div>
                            <form action={downloadEmployeeDocumentAction}>
                              <input type="hidden" name="document_id" value={document.id} />
                              <input type="hidden" name="return_to" value="/employees" />
                              <PendingSubmitButton
                                idleLabel="Download"
                                pendingLabel="Preparing…"
                                className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300"
                              />
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[12px] text-ink-500">No UAE records saved yet.</p>
                  )}
                </section>
              ) : null}

              <div data-tab="account" className="rounded-xl border border-ink-200 bg-white/70 p-5">
                <p className="mb-3 text-[13px] font-bold text-ink-800">Account actions</p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                  <p className="mt-3 text-[12px] text-ink-500">{resendGuidance}</p>
                ) : null}
              </div>
              </SectionTabs>
              </div>
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
            {departmentOptions.length > 0 ? (
              <select
                name="department"
                required
                defaultValue=""
                className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[14px] text-ink-900"
              >
                <option value="" disabled>— Select department</option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            ) : (
              <input
                name="department"
                placeholder="e.g. Engineering"
                required
                className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
              />
            )}
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
