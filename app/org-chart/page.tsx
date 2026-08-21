import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { EmptyState } from "@/components/EmptyState";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FileInput } from "@/components/FileInput";
import { listEmployeesForAdmin } from "@/services/employeeService";
import { buildPositionTree, listPositions, type PositionRecord, type PositionTreeNode } from "@/services/positionService";
import { listPositionAssignments } from "@/services/positionAssignmentService";
import { listDepartments, listWorkLocations, type DepartmentOption, type WorkLocationOption } from "@/services/configurationService";
import { resolveAvatar, listEmployeePhotoUrls } from "@/services/employeeMasterService";
import { OccupancyHistory, type OccupancyRow } from "@/components/OccupancyHistory";
import {
  createPositionAction,
  deletePositionAction,
  downloadPositionJdAction,
  removePositionJdAction,
  updatePositionAction,
  uploadPositionJdAction,
} from "./actions";

// Per-position display data resolved from configured lists + assigned-employee photo.
type PositionDisplay = { deptName: string; locName: string | null; initials: string; photoUrl: string | null };

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
  departments,
  workLocations,
}: {
  position?: PositionRecord;
  positions: PositionRecord[];
  employees: EmployeeOption[];
  departments: DepartmentOption[];
  workLocations: WorkLocationOption[];
}) {
  const inputClass = "mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]";
  const budgetedDefault = position?.budgeted === true ? "budgeted" : position?.budgeted === false ? "non_budgeted" : "";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-[13px] text-ink-700">
        Position title
        <input name="title" required defaultValue={position?.title ?? ""} className={inputClass} />
      </label>
      <label className="text-[13px] text-ink-700">
        Department
        {departments.length > 0 ? (
          <select name="department" required defaultValue={position?.department ?? ""} className={inputClass}>
            <option value="" disabled>— Select department</option>
            {/* Preserve a legacy free-text value that is no longer in the active list. */}
            {position?.department && !departments.some((d) => d.name === position.department) ? (
              <option value={position.department}>{position.department}</option>
            ) : null}
            {departments.filter((d) => d.active || d.name === position?.department).map((d) => (
              <option key={d.id} value={d.name}>{d.name}{d.active ? "" : " (inactive)"}</option>
            ))}
          </select>
        ) : (
          <input name="department" required defaultValue={position?.department ?? ""} className={inputClass} />
        )}
      </label>
      {workLocations.length > 0 ? (
        <label className="text-[13px] text-ink-700">
          Work location
          <select name="work_location_id" defaultValue={position?.work_location_id ?? ""} className={inputClass}>
            <option value="">— No work location</option>
            {workLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.country}){l.active ? "" : " (inactive)"}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-[13px] text-ink-700">
        Budgeted status
        <select name="budgeted" defaultValue={budgetedDefault} className={inputClass}>
          <option value="">Unspecified</option>
          <option value="budgeted">Budgeted</option>
          <option value="non_budgeted">Non-budgeted</option>
        </select>
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
        <textarea name="note" rows={3} maxLength={500} defaultValue={position?.note ?? ""} className={inputClass} />
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
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[13px] text-ink-700">{position.jd_attached ? "Replace job description" : "Attach job description"}</p>
          <FileInput
            name="job_description"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            label="Choose PDF or DOCX"
          />
        </div>
        <PendingSubmitButton
          idleLabel={position.jd_attached ? "Replace" : "Upload"}
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
            className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-700 transition hover:border-signal-red hover:text-signal-red"
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
  display,
}: {
  position: PositionRecord;
  selected: boolean;
  display?: PositionDisplay;
}) {
  const vacant = position.status === "Vacant";
  const deptName = display?.deptName ?? position.department;
  return (
    <Link
      href={`/org-chart?position=${position.id}`}
      className="tf-org-node"
      data-selected={selected ? "true" : undefined}
      data-vacant={vacant ? "true" : undefined}
    >
      {vacant ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-400 text-[11px] text-ink-400" aria-hidden>+</span>
      ) : (
        <EmployeeAvatar name={position.assigned_employee_name ?? ""} photoUrl={display?.photoUrl ?? null} size={32} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink-800">{position.title}</span>
        <span className="block truncate text-[12px] text-ink-500">
          {vacant ? <span className="font-medium text-signal-amber">Vacant</span> : position.assigned_employee_name}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1 text-[11px] font-medium text-ink-600 sm:inline-flex">
        {deptName}
      </span>
    </Link>
  );
}

function PositionBranch({
  node,
  selectedId,
  displayById,
}: {
  node: PositionTreeNode;
  selectedId: string | null;
  displayById: Map<string, PositionDisplay>;
}) {
  return (
    <li className="tf-org-branch">
      <PositionNode position={node} selected={node.id === selectedId} display={displayById.get(node.id)} />
      {node.children.length > 0 ? (
        <ul className="tf-org-children">
          {node.children.map((child) => (
            <PositionBranch key={child.id} node={child} selectedId={selectedId} displayById={displayById} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}


function OrgTree({
  tree,
  selectedId,
  displayById,
}: {
  tree: PositionTreeNode[];
  selectedId: string | null;
  displayById: Map<string, PositionDisplay>;
}) {
  return (
    <div className="tf-org-tree" aria-label="Position reporting hierarchy">
      <ul className="tf-org-roots">
        {tree.map((node) => (
          <li key={node.id} className="tf-org-root">
            <PositionNode position={node} selected={node.id === selectedId} display={displayById.get(node.id)} />
            {node.children.length > 0 ? (
              <ul className="tf-org-children">
                {node.children.map((child) => (
                  <PositionBranch key={child.id} node={child} selectedId={selectedId} displayById={displayById} />
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
  departments,
  workLocations,
}: {
  positions: PositionRecord[];
  employees: EmployeeOption[];
  departments: DepartmentOption[];
  workLocations: WorkLocationOption[];
}) {
  return (
    <div id="add-position" className="tf-drawer">
      <a href="/org-chart" className="tf-drawer-backdrop" aria-label="Close add position" />
      <aside className="tf-drawer-panel p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-500">Position</p>
          <h2 className="mt-2 text-[23px] font-extrabold tracking-[-0.5px] text-ink-800">Add position</h2>
        </div>
        <a href="/org-chart" aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-[20px] text-ink-500 hover:bg-ink-50 hover:text-ink-800">×</a>
      </div>
      <p className="mt-2 text-[14px] text-ink-500">
        A position can sit vacant. Assigning an employee is a separate step.
      </p>
      <form action={createPositionAction} className="mt-5 space-y-4">
        <PositionFields positions={positions} employees={employees} departments={departments} workLocations={workLocations} />
        <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50 px-4 py-3">
          <p className="text-[13px] text-ink-700">Job description (optional)</p>
          <FileInput
            name="job_description"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            label="Choose PDF or DOCX"
            className="mt-2"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <PendingSubmitButton
            idleLabel="Add position"
            pendingLabel="Adding..."
            className="tf-primary-action h-11 px-5 text-[14px]"
          />
          <a href="/org-chart" className="tf-secondary-action inline-flex h-11 items-center px-5 text-[14px] font-bold">
            Cancel
          </a>
        </div>
      </form>
      </aside>
    </div>
  );
}

function PositionDetailPanel({
  position,
  positions,
  employees,
  departments,
  workLocations,
  display,
  assignments,
}: {
  position: PositionRecord;
  positions: PositionRecord[];
  employees: EmployeeOption[];
  departments: DepartmentOption[];
  workLocations: WorkLocationOption[];
  display?: PositionDisplay;
  assignments: OccupancyRow[];
}) {
  const hasChildren = positions.some((item) => item.parent_position_id === position.id);
  const canDelete = position.status === "Vacant" && !position.jd_attached && !hasChildren;
  const parent = positions.find((item) => item.id === position.parent_position_id);
  const deptName = display?.deptName ?? position.department;
  const budgetedLabel = position.budgeted === true ? "Budgeted" : position.budgeted === false ? "Non-budgeted" : "Unspecified";

  return (
    <div className="tf-drawer">
      <a href="/org-chart" className="tf-drawer-backdrop" aria-label="Close position detail" />
      <aside className="tf-drawer-panel p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-500">Position</p>
          <h2 className="mt-2 text-[23px] font-extrabold leading-tight tracking-[-0.5px] text-ink-800">{position.title}</h2>
          <p className="mt-2 text-[14px] text-ink-500">
            {deptName} · Reports to {parent?.title ?? "No parent position"}
          </p>
        </div>
        <Link href="/org-chart" aria-label="Close position detail" className="flex h-8 w-8 items-center justify-center rounded-lg text-[20px] text-ink-500 hover:bg-ink-50 hover:text-ink-800">
          ×
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <div><dt className="text-ink-500">Work location</dt><dd className="text-ink-800">{display?.locName ?? "—"}</dd></div>
        <div><dt className="text-ink-500">Budgeted</dt><dd className="text-ink-800">{budgetedLabel}</dd></div>
        <div><dt className="text-ink-500">State</dt><dd className="text-ink-800">{position.status}</dd></div>
        <div><dt className="text-ink-500">Job description</dt><dd className="text-ink-800">{position.jd_attached ? "Attached" : "None"}</dd></div>
      </dl>

      <div className="mt-5 divide-y divide-ink-100 border-y border-ink-100">
        <section className="py-4">
          <h3 className="text-[13px] font-bold text-ink-800">Current occupant</h3>
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
          <h3 className="text-[13px] font-bold text-ink-800">Occupancy history</h3>
          <div className="mt-3">
            <OccupancyHistory assignments={assignments} />
          </div>
        </section>

        {position.note ? (
          <section className="py-4">
            <h3 className="text-[13px] font-bold text-ink-800">Internal note</h3>
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink-700">{position.note}</p>
          </section>
        ) : null}

        <section className="py-4">
          <h3 className="text-[13px] font-bold text-ink-800">Edit position</h3>
          <p className="mt-1 text-[13px] text-ink-500">Changes update the position, not the person holding it.</p>
          <form action={updatePositionAction} className="mt-4 space-y-4">
            <input type="hidden" name="position_id" value={position.id} />
            <input type="hidden" name="expected_updated_at" value={position.updated_at} />
            <PositionFields position={position} positions={positions} employees={employees} departments={departments} workLocations={workLocations} />
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
                className="rounded-lg border border-ink-300 bg-white px-4 py-2 text-[13px] text-ink-700 transition hover:border-signal-red hover:text-signal-red"
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
    </div>
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

  const [positions, employees, departments, workLocations, photos] = await Promise.all([
    listPositions(actor),
    listEmployeesForAdmin(actor),
    listDepartments(actor),
    listWorkLocations(actor),
    listEmployeePhotoUrls(actor),
  ]);
  const tree = buildPositionTree(positions);
  const filledCount = positions.filter((position) => position.status === "Filled").length;
  const vacantCount = positions.filter((position) => position.status === "Vacant").length;
  const jdCount = positions.filter((position) => position.jd_attached).length;
  const selectedPosition = positions.find((position) => position.id === selectedPositionId) ?? null;

  // Resolve per-position display data (names from configured lists, occupant avatar).
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  const locNameById = new Map(workLocations.map((l) => [l.id, l.name]));
  const photoByEmployeeId = new Map(photos.map((p) => [p.employee_id, p.photo_url]));
  const displayById = new Map<string, PositionDisplay>(
    positions.map((p) => {
      const avatar = resolveAvatar({
        full_name: p.assigned_employee_name ?? "",
        photo_url: p.assigned_employee_id ? photoByEmployeeId.get(p.assigned_employee_id) ?? null : null,
      });
      return [
        p.id,
        {
          deptName: (p.department_id ? deptNameById.get(p.department_id) : null) ?? p.department,
          locName: p.work_location_id ? locNameById.get(p.work_location_id) ?? null : null,
          initials: avatar.initials,
          photoUrl: avatar.photoUrl,
        },
      ];
    }),
  );
  const selectedAssignments = selectedPosition ? await listPositionAssignments(actor, selectedPosition.id) : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <AppShell actor={actor} activePath="/org-chart" />
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
        <div>
          <h1 className="tf-h1">Org chart</h1>
          <p className="tf-meta mt-1 tf-num">
            {positions.length} position{positions.length === 1 ? "" : "s"} · {filledCount} filled · {vacantCount} vacant{jdCount > 0 ? ` · ${jdCount} with JD` : ""}
          </p>
        </div>
        <Link href="/org-chart#add-position" className="tf-primary-action inline-flex h-9 items-center px-4 text-[13.5px]">
          Add position
        </Link>
      </div>

      {successMessage ? (
        <p className="mb-5 rounded-lg border border-signal-green/25 bg-signal-green/5 px-4 py-2.5 text-[13.5px] text-signal-green">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mb-5 rounded-lg border border-signal-red/25 bg-signal-red/5 px-4 py-2.5 text-[13.5px] text-signal-red">
          {errorMessage}
        </p>
      ) : null}

      <section className="tf-org-layout">
        {positions.length === 0 ? (
          <div className="tf-surface-flat">
            <EmptyState
              message="Design your team structure."
              hint="Add the positions your organisation needs, define who reports to whom, then assign employees as roles are filled."
              cta={{ label: "Add first position", href: "#add-position" }}
            />
          </div>
        ) : (
          <div className="tf-surface px-4 py-5 sm:px-6">
            <OrgTree tree={tree} selectedId={selectedPosition?.id ?? null} displayById={displayById} />
          </div>
        )}
      </section>

      {/* Add position is a slide-over drawer (CSS :target), never a permanent sidebar. */}
      <AddPositionPanel positions={positions} employees={employees} departments={departments} workLocations={workLocations} />
      {/* Position detail opens as a drawer when a card is selected. */}
      {selectedPosition ? (
        <PositionDetailPanel
          position={selectedPosition}
          positions={positions}
          employees={employees}
          departments={departments}
          workLocations={workLocations}
          display={displayById.get(selectedPosition.id)}
          assignments={selectedAssignments}
        />
      ) : null}
    </main>
  );
}
