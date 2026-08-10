import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
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
          <p className="mt-1 text-[13px] text-ink-500">
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
              className="tf-secondary-action h-10 px-4 text-[13px] font-bold"
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
          className="tf-primary-action h-10 px-4 text-[13px]"
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

function PositionNode({
  position,
  selected,
}: {
  position: PositionRecord;
  selected: boolean;
}) {
  return (
    <Link
      href={`/org-chart?position=${position.id}`}
      className="tf-org-node"
      data-selected={selected ? "true" : undefined}
      data-vacant={position.status === "Vacant" ? "true" : undefined}
    >
      <span className="block text-[13px] font-bold tracking-[-0.1px] text-ink-800">{position.title}</span>
      <span className={position.status === "Vacant" ? "mt-2 block text-[12px] font-semibold text-signal-amber" : "mt-2 block text-[12px] text-ink-500"}>
        {position.status === "Filled" ? position.assigned_employee_name : "Vacant"}
      </span>
      <span className="mt-2 block text-[12px] text-ink-500">{position.jd_attached ? "JD attached" : "No JD"}</span>
    </Link>
  );
}

function PositionBranch({
  node,
  selectedId,
  nested = false,
}: {
  node: PositionTreeNode;
  selectedId: string | null;
  nested?: boolean;
}) {
  return (
    <li className="tf-org-branch">
      <PositionNode position={node} selected={node.id === selectedId} />
      {node.children.length > 0 ? (
        <ul className={nested ? "tf-org-nested space-y-3" : "tf-org-children"}>
          {node.children.map((child) => (
            <PositionBranch key={child.id} node={child} selectedId={selectedId} nested />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function OrgTree({
  tree,
  selectedId,
}: {
  tree: PositionTreeNode[];
  selectedId: string | null;
}) {
  return (
    <div className="tf-org-tree" aria-label="Position reporting hierarchy">
      <ul className="tf-org-roots">
        {tree.map((node) => (
          <li key={node.id} className="tf-org-root">
            <PositionNode position={node} selected={node.id === selectedId} />
            {node.children.length > 0 ? (
              <ul className="tf-org-children">
                {node.children.map((child) => (
                  <PositionBranch key={child.id} node={child} selectedId={selectedId} />
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddPositionPanel({
  positions,
  employees,
}: {
  positions: PositionRecord[];
  employees: EmployeeOption[];
}) {
  return (
    <aside id="add-position" className="h-fit rounded-xl border border-ink-300/70 bg-white p-6 shadow-sm">
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-500">Position</p>
      <h2 className="mt-2 text-[23px] font-extrabold tracking-[-0.5px] text-ink-800">Add position</h2>
      <p className="mt-2 text-[14px] text-ink-500">
        A position can sit vacant. Assigning an employee is a separate step.
      </p>
      <form action={createPositionAction} className="mt-5 space-y-4">
        <PositionFields positions={positions} employees={employees} />
        <label className="block rounded-lg border border-dashed border-ink-300 bg-ink-50 px-4 py-3 text-[13px] text-ink-700">
          Job description
          <input
            name="job_description"
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            className="mt-2 block w-full text-[13px]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <PendingSubmitButton
            idleLabel="Add position"
            pendingLabel="Adding..."
            className="tf-primary-action h-11 px-5 text-[14px]"
          />
          <Link href="/org-chart" className="tf-secondary-action inline-flex h-11 items-center px-5 text-[14px] font-bold">
            Cancel
          </Link>
        </div>
      </form>
    </aside>
  );
}

function PositionDetailPanel({
  position,
  positions,
  employees,
}: {
  position: PositionRecord;
  positions: PositionRecord[];
  employees: EmployeeOption[];
}) {
  const hasChildren = positions.some((item) => item.parent_position_id === position.id);
  const canDelete = position.status === "Vacant" && !position.jd_attached && !hasChildren;
  const parent = positions.find((item) => item.id === position.parent_position_id);

  return (
    <aside className="h-fit rounded-xl border border-ink-300/70 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-500">Position</p>
          <h2 className="mt-2 text-[23px] font-extrabold leading-tight tracking-[-0.5px] text-ink-800">{position.title}</h2>
          <p className="mt-2 text-[14px] text-ink-500">
            {position.department} · Reports to {parent?.title ?? "No parent position"}
          </p>
        </div>
        <Link href="/org-chart" aria-label="Close position detail" className="flex h-8 w-8 items-center justify-center rounded-lg text-[20px] text-ink-500 hover:bg-ink-50 hover:text-ink-800">
          ×
        </Link>
      </div>

      <div className="mt-5 divide-y divide-ink-100 border-y border-ink-100">
        <section className="py-4">
          <h3 className="text-[13px] font-bold text-ink-800">Occupancy</h3>
          <p className="mt-2 text-[14px] text-ink-700">
            {position.status === "Filled" ? position.assigned_employee_name : "Vacant"}
          </p>
          {position.assigned_employee_id ? (
            <Link
              href={`/employees?employee=${position.assigned_employee_id}#employee-${position.assigned_employee_id}`}
              className="mt-3 inline-flex text-[13px] font-bold text-ink-800 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-800"
            >
              Open employee
            </Link>
          ) : null}
        </section>

        <section className="py-4">
          <h3 className="text-[13px] font-bold text-ink-800">Edit position</h3>
          <p className="mt-1 text-[13px] text-ink-500">Changes update the position, not the person holding it.</p>
          <form action={updatePositionAction} className="mt-4 space-y-4">
            <input type="hidden" name="position_id" value={position.id} />
            <input type="hidden" name="expected_updated_at" value={position.updated_at} />
            <PositionFields position={position} positions={positions} employees={employees} />
            <PendingSubmitButton
              idleLabel="Save changes"
              pendingLabel="Saving..."
              className="tf-primary-action h-10 px-4 text-[13px]"
            />
          </form>
        </section>

        <section className="py-4">
          <JobDescriptionControls position={position} />
        </section>

        <section className="py-4">
          <form action={deletePositionAction}>
            <input type="hidden" name="position_id" value={position.id} />
            <input type="hidden" name="expected_updated_at" value={position.updated_at} />
            {canDelete ? (
              <ConfirmSubmitButton
                idleLabel="Remove vacant position"
                pendingLabel="Removing..."
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-[13px] text-red-700"
                confirmMessage={`Remove the vacant position ${position.title}?`}
              />
            ) : (
              <p className="text-[12px] text-ink-500">
                Positions can only be removed when vacant, childless and without a JD. Vacating keeps the employee record.
              </p>
            )}
          </form>
        </section>
      </div>
    </aside>
  );
}

export default async function OrgChartPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; position?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error, position: selectedPositionId } = await searchParams;
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role !== "admin") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <AppShell actor={actor} activePath="/org-chart" />
        <div className="space-y-2 border-b border-ink-300/60 pb-5">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Restricted</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Org chart</h1>
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
  const selectedPosition = positions.find((position) => position.id === selectedPositionId) ?? null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <AppShell actor={actor} activePath="/org-chart" />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Design the team</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Org chart</h1>
          <p className="max-w-2xl text-[15px] text-ink-700">
            Define positions, reporting relationships and vacancies before assigning employees into the structure.
          </p>
        </div>
        <Link href="/org-chart#add-position" className="tf-primary-action inline-flex h-11 items-center px-5 text-[14px]">
          Add position
        </Link>
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

      <section className={selectedPosition ? "mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]" : "mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"}>
        <div className="rounded-xl border border-ink-300/70 bg-white/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-extrabold tracking-[-0.3px] text-ink-800">Reporting structure</h2>
              <p className="mt-1 text-[14px] text-ink-500">
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
            <>
              <div className="mt-6">
                <OrgTree tree={tree} selectedId={selectedPosition?.id ?? null} />
              </div>
              {selectedPosition ? (
                <p className="mt-4 text-[13px] text-ink-500">
                  Showing this reporting line. Close the panel to return to the full chart.
                </p>
              ) : null}
            </>
          )}
        </div>

        {selectedPosition ? (
          <PositionDetailPanel position={selectedPosition} positions={positions} employees={employees} />
        ) : (
          <AddPositionPanel positions={positions} employees={employees} />
        )}
      </section>
    </main>
  );
}
