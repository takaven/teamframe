import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { StatusPill } from "@/components/StatusPill";
import { listEmployeesForAdmin } from "@/services/employeeService";
import { buildPositionTree, listPositions, type PositionRecord, type PositionTreeNode } from "@/services/positionService";
import {
  createPositionAction,
  deletePositionAction,
  downloadPositionJdAction,
  removePositionJdAction,
  updatePositionAction,
  uploadPositionJdAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  created: "Position created.",
  updated: "Position updated.",
  deleted: "Vacant position removed.",
  jd_uploaded: "Job description attached.",
  jd_removed: "Job description removed.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  INVALID_INPUT: "Check the position details and try again.",
  POSITION_SELF_REPORTING: "A position cannot report to itself.",
  POSITION_REPORTING_CYCLE: "That reporting change would create a loop.",
  POSITION_CREATE_FAILED: "Could not create the position.",
  POSITION_UPDATE_FAILED: "Could not update the position.",
  POSITION_DELETE_FAILED: "Could not remove the position.",
  POSITION_DELETE_UNSAFE: "Only vacant positions with no child positions and no JD can be removed.",
  STALE_WRITE: "This position changed. Refresh and try again.",
  POSITION_JD_EMPTY_FILE: "Attach a non-empty PDF or DOCX file.",
  POSITION_JD_TOO_LARGE: "Job descriptions must be 10 MB or smaller.",
  POSITION_JD_UNSUPPORTED_EXTENSION: "Job descriptions must be PDF or DOCX files.",
  POSITION_JD_MIME_EXTENSION_MISMATCH: "The file type does not match its extension.",
  POSITION_JD_SIGNATURE_MISMATCH: "The file contents do not match a valid PDF or DOCX.",
  POSITION_JD_UPLOAD_FAILED: "Could not upload the job description.",
  POSITION_JD_REMOVE_FAILED: "Could not remove the job description.",
  POSITION_JD_DOWNLOAD_FAILED: "Could not create a private download link.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

type EmployeeOption = Awaited<ReturnType<typeof listEmployeesForAdmin>>[number];

function employeeLabel(employee: EmployeeOption): string {
  return `${employee.full_name} · ${employee.role_title}`;
}

function PositionSelect({
  positions,
  currentId,
  selectedId,
}: {
  positions: PositionRecord[];
  currentId?: string;
  selectedId?: string | null;
}) {
  return (
    <select
      name="parent_position_id"
      defaultValue={selectedId ?? ""}
      className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]"
    >
      <option value="">Top-level position</option>
      {positions
        .filter((position) => position.id !== currentId)
        .map((position) => (
          <option key={position.id} value={position.id}>
            {position.title}
          </option>
        ))}
    </select>
  );
}

function EmployeeSelect({
  employees,
  selectedId,
}: {
  employees: EmployeeOption[];
  selectedId?: string | null;
}) {
  return (
    <select
      name="assigned_employee_id"
      defaultValue={selectedId ?? ""}
      className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]"
    >
      <option value="">Vacant</option>
      {employees
        .filter((employee) => employee.status !== "inactive")
        .map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employeeLabel(employee)}
          </option>
        ))}
    </select>
  );
}

function PositionFields({
  position,
  positions,
  employees,
}: {
  position?: PositionRecord;
  positions: PositionRecord[];
  employees: EmployeeOption[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-[13px] text-ink-700">
        Position title
        <input
          name="title"
          required
          defaultValue={position?.title ?? ""}
          className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]"
        />
      </label>
      <label className="text-[13px] text-ink-700">
        Department / function
        <input
          name="department"
          required
          defaultValue={position?.department ?? ""}
          className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]"
        />
      </label>
      <label className="text-[13px] text-ink-700">
        Reports to
        <PositionSelect positions={positions} currentId={position?.id} selectedId={position?.parent_position_id} />
      </label>
      <label className="text-[13px] text-ink-700">
        Assigned employee
        <EmployeeSelect employees={employees} selectedId={position?.assigned_employee_id} />
      </label>
      <label className="sm:col-span-2 text-[13px] text-ink-700">
        Internal note
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          defaultValue={position?.note ?? ""}
          className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]"
        />
      </label>
    </div>
  );
}

function JobDescriptionControls({ position }: { position: PositionRecord }) {
  return (
    <div className="mt-4 rounded-xl border border-ink-300/70 bg-ink-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink-900">Job description</p>
          <p className="mt-1 text-[13px] text-ink-600">
            {position.jd_attached
              ? `Current file: ${position.jd_original_filename ?? "attached JD"}`
              : "Attach a private PDF or DOCX job description."}
          </p>
        </div>
        {position.jd_attached ? (
          <form action={downloadPositionJdAction}>
            <input type="hidden" name="position_id" value={position.id} />
            <PendingSubmitButton
              idleLabel="Download JD"
              pendingLabel="Preparing..."
              className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-900"
            />
          </form>
        ) : null}
      </div>
      <form action={uploadPositionJdAction} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="position_id" value={position.id} />
        <label className="min-w-0 flex-1 text-[13px] text-ink-700">
          Replace / attach JD
          <input
            name="job_description"
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            className="mt-1 block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px]"
          />
        </label>
        <PendingSubmitButton
          idleLabel="Upload"
          pendingLabel="Uploading..."
          className="rounded-lg bg-brand-charcoal px-4 py-2 text-[13px] font-medium text-white"
        />
      </form>
      {position.jd_attached ? (
        <form action={removePositionJdAction} className="mt-3">
          <input type="hidden" name="position_id" value={position.id} />
          <ConfirmSubmitButton
            idleLabel="Remove JD"
            pendingLabel="Removing..."
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-[13px] text-red-700"
            confirmMessage={`Remove the job description from ${position.title}?`}
          />
        </form>
      ) : null}
    </div>
  );
}

function PositionCard({
  position,
  positions,
  employees,
}: {
  position: PositionRecord;
  positions: PositionRecord[];
  employees: EmployeeOption[];
}) {
  const canDelete = position.status === "Vacant" && !position.jd_attached;

  return (
    <article className="rounded-xl border border-ink-300/75 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold tracking-tight text-ink-900">{position.title}</h3>
          <p className="mt-1 text-[13px] text-ink-600">{position.department}</p>
          <p className="mt-3 text-[14px] text-ink-800">
            {position.status === "Filled" ? position.assigned_employee_name : "Vacant"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill tone={position.status === "Filled" ? "green" : "amber"}>{position.status}</StatusPill>
          <StatusPill tone={position.jd_attached ? "info" : "neutral"}>
            {position.jd_attached ? "JD attached" : "No JD"}
          </StatusPill>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
        {position.assigned_employee_id ? (
          <Link
            href={`/employees?employee=${position.assigned_employee_id}#employee-${position.assigned_employee_id}`}
            className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-900"
          >
            Open employee
          </Link>
        ) : null}
        <details className="w-full rounded-lg border border-ink-300/70 bg-ink-50/60 p-3">
          <summary className="cursor-pointer font-medium text-ink-900">View / edit position</summary>
          <form action={updatePositionAction} className="mt-4 space-y-4">
            <input type="hidden" name="position_id" value={position.id} />
            <input type="hidden" name="expected_updated_at" value={position.updated_at} />
            <PositionFields position={position} positions={positions} employees={employees} />
            <PendingSubmitButton
              idleLabel="Save position"
              pendingLabel="Saving..."
              className="rounded-lg bg-brand-charcoal px-4 py-2 text-[13px] font-medium text-white"
            />
          </form>
          <JobDescriptionControls position={position} />
          <form action={deletePositionAction} className="mt-4 border-t border-ink-300/70 pt-3">
            <input type="hidden" name="position_id" value={position.id} />
            <input type="hidden" name="expected_updated_at" value={position.updated_at} />
            {canDelete ? (
              <ConfirmSubmitButton
                idleLabel="Remove vacant position"
                pendingLabel="Removing..."
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-[13px] text-red-700"
                confirmMessage={`Remove the vacant position ${position.title}?`}
              />
            ) : (
              <p className="mt-2 text-[12px] text-ink-500">
                Positions can only be removed when vacant, childless and without a JD. Use Vacant assignment and remove the JD first.
              </p>
            )}
          </form>
        </details>
      </div>
    </article>
  );
}

function PositionBranch({
  node,
  positions,
  employees,
}: {
  node: PositionTreeNode;
  positions: PositionRecord[];
  employees: EmployeeOption[];
}) {
  return (
    <li className="relative pl-5 before:absolute before:left-1 before:top-6 before:h-[calc(100%-1.5rem)] before:border-l before:border-ink-300/80">
      <PositionCard position={node} positions={positions} employees={employees} />
      {node.children.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {node.children.map((child) => (
            <PositionBranch key={child.id} node={child} positions={positions} employees={employees} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function OrgChartPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role !== "admin") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <AppShell actor={actor} activePath="/org-chart" />
        <div className="space-y-2 border-b border-ink-300/60 pb-5">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Restricted</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Org Chart</h1>
        </div>
        <p className="mt-7 max-w-prose text-[15px] text-ink-700">
          Organisation structure is admin-only in TeamFrame.
        </p>
      </main>
    );
  }

  const [positions, employees] = await Promise.all([
    listPositions(actor),
    listEmployeesForAdmin(actor),
  ]);
  const tree = buildPositionTree(positions);
  const filledCount = positions.filter((position) => position.status === "Filled").length;
  const vacantCount = positions.filter((position) => position.status === "Vacant").length;
  const jdCount = positions.filter((position) => position.jd_attached).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <AppShell actor={actor} activePath="/org-chart" />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Design the team</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Org Chart</h1>
          <p className="max-w-2xl text-[15px] text-ink-700">
            Define positions, reporting relationships and vacancies before assigning employees into the structure.
          </p>
        </div>
      </div>

      {successMessage ? (
        <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="mt-7 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-ink-300/70 bg-white/80 p-4">
          <p className="text-[12px] text-ink-500">Positions</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{positions.length}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/80 p-4">
          <p className="text-[12px] text-ink-500">Filled / vacant</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{filledCount} / {vacantCount}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/80 p-4">
          <p className="text-[12px] text-ink-500">JD attached</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{jdCount}</p>
        </article>
      </section>

      <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-ink-300/70 bg-white/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-medium tracking-tight">Reporting structure</h2>
              <p className="mt-1 text-[14px] text-ink-600">
                Positions report to positions. Employees appear only when a role is currently filled.
              </p>
            </div>
          </div>
          {positions.length === 0 ? (
            <EmptyState
              message="Design your team structure."
              hint="Add the positions your organisation needs, define who reports to whom, then assign employees as roles are filled."
              cta={{ label: "Add first position", href: "#add-position" }}
            />
          ) : (
            <ul className="mt-6 space-y-4" aria-label="Position reporting hierarchy">
              {tree.map((node) => (
                <PositionBranch key={node.id} node={node} positions={positions} employees={employees} />
              ))}
            </ul>
          )}
        </div>

        <aside id="add-position" className="h-fit rounded-2xl border border-ink-300/70 bg-white p-5 shadow-sm">
          <h2 className="text-[22px] font-medium tracking-tight">Add position</h2>
          <p className="mt-2 text-[14px] text-ink-600">
            Create a vacant role first, or assign an existing employee if the role is already filled.
          </p>
          <form action={createPositionAction} className="mt-5 space-y-4">
            <PositionFields positions={positions} employees={employees} />
            <label className="block text-[13px] text-ink-700">
              Job description
              <input
                name="job_description"
                type="file"
                accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
                className="mt-1 block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px]"
              />
            </label>
            <PendingSubmitButton
              idleLabel="Add position"
              pendingLabel="Adding..."
              className="rounded-lg bg-brand-signal px-4 py-2 text-[14px] font-semibold text-brand-charcoal"
            />
          </form>
        </aside>
      </section>
    </main>
  );
}
