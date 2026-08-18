import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { isCurrentEmployee, type LegacyEmployeeLifecycleState } from "@/services/employeeLifecycle";

const DOCUMENT_BUCKET = "documents";
const MAX_JD_BYTES = 10 * 1024 * 1024;
const MAX_FILE_NAME_CHARS = 180;

export type PositionRecord = {
  id: string;
  title: string;
  department: string;
  department_id: string | null;
  work_location_id: string | null;
  budgeted: boolean | null;
  parent_position_id: string | null;
  assigned_employee_id: string | null;
  assigned_employee_name: string | null;
  note: string | null;
  status: "Vacant" | "Filled";
  jd_attached: boolean;
  jd_original_filename: string | null;
  jd_mime_type: string | null;
  jd_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PositionTreeNode = PositionRecord & {
  children: PositionTreeNode[];
};

type PositionRow = {
  id: string;
  tenant_id: string;
  title: string;
  department: string;
  department_id: string | null;
  work_location_id: string | null;
  budgeted: boolean | null;
  parent_position_id: string | null;
  assigned_employee_id: string | null;
  note: string | null;
  jd_storage_bucket: string | null;
  jd_storage_path: string | null;
  jd_original_filename: string | null;
  jd_mime_type: string | null;
  jd_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type EmployeeAssignmentRow = {
  id: string;
  full_name: string;
  status: "active" | "on_leave" | "inactive";
  setup_status: "incomplete" | "ready" | "active";
  lifecycle_state: LegacyEmployeeLifecycleState;
  start_date: string | null;
  end_date: string | null;
  deleted_at: string | null;
};

type JdFileType = {
  extension: "pdf" | "docx";
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  matchesSignature: (bytes: Buffer) => boolean;
};

const JD_FILE_TYPES: readonly JdFileType[] = [
  {
    extension: "pdf",
    mimeType: "application/pdf",
    matchesSignature: (bytes) => bytes.subarray(0, 4).toString("ascii") === "%PDF",
  },
  {
    extension: "docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    matchesSignature: (bytes) =>
      bytes.subarray(0, 4).toString("ascii") === "PK\u0003\u0004" &&
      bytes.indexOf(Buffer.from("[Content_Types].xml", "ascii")) !== -1 &&
      bytes.indexOf(Buffer.from("word/", "ascii")) !== -1,
  },
];

const PositionInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  department: z.string().trim().min(1).max(120),
  parentPositionId: z.string().uuid().nullable().optional(),
  assignedEmployeeId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  // Phase-2B additive references to the configured lists + budgeted flag.
  departmentId: z.string().uuid().nullable().optional(),
  workLocationId: z.string().uuid().nullable().optional(),
  budgeted: z.boolean().nullable().optional(),
});

type PositionConfigInput = Pick<z.infer<typeof PositionInputSchema>, "departmentId" | "workLocationId" | "budgeted">;

async function applyPositionConfigFields(
  supabase: ReturnType<typeof createServiceRoleClient>,
  tenantId: string,
  positionId: string,
  parsed: PositionConfigInput,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (parsed.departmentId !== undefined) patch.department_id = parsed.departmentId;
  if (parsed.workLocationId !== undefined) patch.work_location_id = parsed.workLocationId;
  if (parsed.budgeted !== undefined) patch.budgeted = parsed.budgeted;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("positions").update(patch as never).eq("tenant_id", tenantId).eq("id", positionId);
  if (error) throw new Error(`POSITION_CONFIG_UPDATE_FAILED: ${error.message}`);
}

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

function derivePositionStatus(row: PositionRow, employee?: EmployeeAssignmentRow | null): "Vacant" | "Filled" {
  if (!row.assigned_employee_id || !employee || !isCurrentEmployee(employee)) {
    return "Vacant";
  }
  return "Filled";
}

function toPositionRecord(row: PositionRow, employeesById: Map<string, EmployeeAssignmentRow>): PositionRecord {
  const employee = row.assigned_employee_id ? employeesById.get(row.assigned_employee_id) ?? null : null;
  const status = derivePositionStatus(row, employee);
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    department_id: row.department_id,
    work_location_id: row.work_location_id,
    budgeted: row.budgeted,
    parent_position_id: row.parent_position_id,
    assigned_employee_id: row.assigned_employee_id,
    assigned_employee_name: status === "Filled" ? employee?.full_name ?? null : null,
    note: row.note,
    status,
    jd_attached: Boolean(row.jd_storage_path),
    jd_original_filename: row.jd_original_filename,
    jd_mime_type: row.jd_mime_type,
    jd_uploaded_at: row.jd_uploaded_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function buildPositionTree(positions: PositionRecord[]): PositionTreeNode[] {
  const nodes = new Map<string, PositionTreeNode>();
  for (const position of positions) {
    nodes.set(position.id, { ...position, children: [] });
  }

  const roots: PositionTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_position_id && nodes.has(node.parent_position_id)) {
      nodes.get(node.parent_position_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (items: PositionTreeNode[]) => {
    items.sort((a, b) => a.title.localeCompare(b.title));
    for (const item of items) sort(item.children);
  };
  sort(roots);
  return roots;
}

export function wouldCreateReportingCycle(
  positions: Array<{ id: string; parent_position_id: string | null }>,
  positionId: string,
  nextParentId: string | null,
): boolean {
  if (!nextParentId) return false;
  if (positionId === nextParentId) return true;

  const parentById = new Map(positions.map((position) => [position.id, position.parent_position_id]));
  parentById.set(positionId, nextParentId);
  const seen = new Set<string>();
  let cursor: string | null | undefined = nextParentId;

  while (cursor) {
    if (cursor === positionId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }
  return false;
}

export function validateSingleAssignmentInvariant(positions: Array<{ id: string; assigned_employee_id: string | null }>): boolean {
  const seen = new Set<string>();
  for (const position of positions) {
    if (!position.assigned_employee_id) continue;
    if (seen.has(position.assigned_employee_id)) return false;
    seen.add(position.assigned_employee_id);
  }
  return true;
}

export async function listPositions(actor: Actor): Promise<PositionRecord[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data: positionData, error: positionError } = await supabase
    .from("positions")
    .select("id, tenant_id, title, department, department_id, work_location_id, budgeted, parent_position_id, assigned_employee_id, note, jd_storage_bucket, jd_storage_path, jd_original_filename, jd_mime_type, jd_uploaded_at, created_at, updated_at, deleted_at")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("title", { ascending: true });

  if (positionError) throw new Error(`POSITION_LIST_FAILED: ${positionError.message}`);

  const rows = (positionData ?? []) as PositionRow[];
  const employeeIds = rows.map((row) => row.assigned_employee_id).filter(Boolean) as string[];
  const employeesById = new Map<string, EmployeeAssignmentRow>();

  if (employeeIds.length > 0) {
    const { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, status, setup_status, lifecycle_state, start_date, end_date, deleted_at")
      .eq("tenant_id", tenantId)
      .in("id", employeeIds);
    if (employeeError) throw new Error(`POSITION_EMPLOYEE_LIST_FAILED: ${employeeError.message}`);
    for (const employee of (employeeData ?? []) as EmployeeAssignmentRow[]) {
      employeesById.set(employee.id, employee);
    }
  }

  return rows.map((row) => toPositionRecord(row, employeesById));
}

export async function createPosition(actor: Actor, input: unknown): Promise<PositionRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = PositionInputSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc("teamframe_create_position", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_title: parsed.title,
      p_department: parsed.department,
      p_parent_position_id: parsed.parentPositionId ?? null,
      p_assigned_employee_id: parsed.assignedEmployeeId ?? null,
      p_note: parsed.note ?? null,
    } as never)
    .single();

  if (error || !data) throw new Error(`POSITION_CREATE_FAILED: ${error?.message ?? "no row"}`);
  const createdId = (data as PositionRow).id;
  await applyPositionConfigFields(supabase, tenantId, createdId, parsed);
  return (await listPositions(actor)).find((position) => position.id === createdId)!;
}

export async function updatePosition(
  actor: Actor,
  positionId: string,
  input: unknown,
  expectedUpdatedAt: string,
): Promise<PositionRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");
  const parsed = PositionInputSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc("teamframe_update_position", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_position_id: positionId,
      p_expected_updated_at: expectedUpdatedAt,
      p_title: parsed.title,
      p_department: parsed.department,
      p_parent_position_id: parsed.parentPositionId ?? null,
      p_assigned_employee_id: parsed.assignedEmployeeId ?? null,
      p_note: parsed.note ?? null,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`POSITION_UPDATE_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");
  const updatedId = (data as PositionRow).id;
  await applyPositionConfigFields(supabase, tenantId, updatedId, parsed);
  return (await listPositions(actor)).find((position) => position.id === updatedId)!;
}

export async function deleteVacantPosition(actor: Actor, positionId: string, expectedUpdatedAt: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_delete_position", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_position_id: positionId,
      p_expected_updated_at: expectedUpdatedAt,
    } as never)
    .maybeSingle();
  if (error) throw new Error(`POSITION_DELETE_FAILED: ${error.message}`);
  const deleted = Array.isArray(data) ? (data[0] as PositionRow | undefined) : (data as PositionRow | null);
  if (!deleted || deleted.id !== positionId) throw new Error("POSITION_DELETE_UNSAFE");
}

function extensionFromFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? "" : fileName.slice(lastDot + 1).toLowerCase();
}

function validateJdBeforeBuffer(file: File): JdFileType {
  if (!file.name || file.name.length > MAX_FILE_NAME_CHARS) throw new Error("POSITION_JD_INVALID_FILENAME");
  if (file.size === 0) throw new Error("POSITION_JD_EMPTY_FILE");
  if (file.size > MAX_JD_BYTES) throw new Error("POSITION_JD_TOO_LARGE");
  const extension = extensionFromFileName(file.name);
  const match = JD_FILE_TYPES.find((candidate) => candidate.extension === extension);
  if (!match) throw new Error("POSITION_JD_UNSUPPORTED_EXTENSION");
  if (file.type !== match.mimeType) throw new Error("POSITION_JD_MIME_EXTENSION_MISMATCH");
  return match;
}

export function validatePositionJdFileForTest(input: {
  fileName: string;
  mimeType: string;
  size: number;
  bytes: Buffer;
}): "pdf" | "docx" {
  const file = {
    name: input.fileName,
    type: input.mimeType,
    size: input.size,
  } as File;
  const fileType = validateJdBeforeBuffer(file);
  if (!fileType.matchesSignature(input.bytes)) throw new Error("POSITION_JD_SIGNATURE_MISMATCH");
  return fileType.extension;
}

async function beginFileOperation(input: {
  tenantId: string;
  kind: "position_jd_upload" | "position_jd_delete";
  storagePath: string;
  targetId: string;
  auditActionType: string;
}): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("file_operations")
    .insert({
      tenant_id: input.tenantId,
      operation_kind: input.kind,
      status: "pending",
      idempotency_key: randomUUID(),
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: input.storagePath,
      target_id: input.targetId,
      audit_action_type: input.auditActionType,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`FILE_OPERATION_BEGIN_FAILED: ${error?.message ?? "no row"}`);
  return (data as { id: string }).id;
}

async function finalizeFileOperation(tenantId: string, operationId: string, status: string, errorMessage?: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("file_operations")
    .update({
      status,
      error_message: errorMessage?.slice(0, 1000) ?? null,
      finalized_at: new Date().toISOString(),
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", operationId);
  if (error) throw new Error(`FILE_OPERATION_FINALIZE_FAILED: ${error.message}`);
}

async function writeAudit(actor: Actor, actionType: string, targetId: string): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId,
  } as never);
  if (error) throw new Error(`AUDIT_LOG_FAILED: ${error.message}`);
}

async function getPositionRow(actor: Actor, positionId: string): Promise<PositionRow> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("positions")
    .select("id, tenant_id, title, department, parent_position_id, assigned_employee_id, note, jd_storage_bucket, jd_storage_path, jd_original_filename, jd_mime_type, jd_uploaded_at, created_at, updated_at, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", positionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`POSITION_FETCH_FAILED: ${error.message}`);
  if (!data) throw new Error("POSITION_NOT_FOUND");
  return data as PositionRow;
}

async function verifyStorageConfig(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`POSITION_JD_STORAGE_CONFIG_FAILED: ${error.message}`);
  const bucket = buckets.find((item) => item.name === DOCUMENT_BUCKET);
  if (!bucket) throw new Error("POSITION_JD_STORAGE_BUCKET_MISSING");
  if (bucket.public) throw new Error("POSITION_JD_STORAGE_BUCKET_PUBLIC");
}

export async function uploadPositionJobDescription(actor: Actor, positionId: string, file: File): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const position = await getPositionRow(actor, positionId);
  const fileType = validateJdBeforeBuffer(file);
  await verifyStorageConfig();
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!fileType.matchesSignature(bytes)) throw new Error("POSITION_JD_SIGNATURE_MISMATCH");

  const supabase = createServiceRoleClient();
  const storagePath = `${tenantId}/positions/${positionId}/jd/${randomUUID()}/job-description.${fileType.extension}`;
  const operationId = await beginFileOperation({
    tenantId,
    kind: "position_jd_upload",
    storagePath,
    targetId: positionId,
    auditActionType: position.jd_storage_path ? "position.jd_replaced" : "position.jd_uploaded",
  });

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, {
    contentType: fileType.mimeType,
    upsert: false,
  });
  if (uploadError) {
    await finalizeFileOperation(tenantId, operationId, "failed", uploadError.message);
    throw new Error(`POSITION_JD_UPLOAD_FAILED: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from("positions")
    .update({
      jd_storage_bucket: DOCUMENT_BUCKET,
      jd_storage_path: storagePath,
      jd_original_filename: file.name,
      jd_mime_type: fileType.mimeType,
      jd_uploaded_at: new Date().toISOString(),
      jd_uploaded_by_actor_user_id: actor.authUserId,
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", positionId);

  if (updateError) {
    const { error: removeError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    await finalizeFileOperation(tenantId, operationId, removeError ? "compensation_required" : "compensated", updateError.message);
    throw new Error(`POSITION_JD_RECORD_UPDATE_FAILED: ${updateError.message}`);
  }

  await finalizeFileOperation(tenantId, operationId, "succeeded");
  await writeAudit(actor, position.jd_storage_path ? "position.jd_replaced" : "position.jd_uploaded", positionId);

  if (position.jd_storage_path) {
    const deleteOperationId = await beginFileOperation({
      tenantId,
      kind: "position_jd_delete",
      storagePath: position.jd_storage_path,
      targetId: positionId,
      auditActionType: "position.jd_replaced.old_removed",
    });
    const { error: removeOldError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([position.jd_storage_path]);
    await finalizeFileOperation(tenantId, deleteOperationId, removeOldError ? "compensation_required" : "succeeded", removeOldError?.message);
  }
}

export async function removePositionJobDescription(actor: Actor, positionId: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const position = await getPositionRow(actor, positionId);
  if (!position.jd_storage_path) return;
  const supabase = createServiceRoleClient();
  const operationId = await beginFileOperation({
    tenantId,
    kind: "position_jd_delete",
    storagePath: position.jd_storage_path,
    targetId: positionId,
    auditActionType: "position.jd_removed",
  });

  const { error: removeError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([position.jd_storage_path]);
  if (removeError) {
    await finalizeFileOperation(tenantId, operationId, "failed", removeError.message);
    throw new Error(`POSITION_JD_REMOVE_FAILED: ${removeError.message}`);
  }

  const { error: updateError } = await supabase
    .from("positions")
    .update({
      jd_storage_bucket: null,
      jd_storage_path: null,
      jd_original_filename: null,
      jd_mime_type: null,
      jd_uploaded_at: null,
      jd_uploaded_by_actor_user_id: null,
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", positionId);
  if (updateError) {
    await finalizeFileOperation(tenantId, operationId, "compensation_required", updateError.message);
    throw new Error(`POSITION_JD_RECORD_UPDATE_FAILED: ${updateError.message}`);
  }

  await finalizeFileOperation(tenantId, operationId, "succeeded");
  await writeAudit(actor, "position.jd_removed", positionId);
}

export async function getPositionJobDescriptionUrl(actor: Actor, positionId: string): Promise<string> {
  requireAdmin(actor);
  const position = await getPositionRow(actor, positionId);
  if (!position.jd_storage_path) throw new Error("POSITION_JD_NOT_FOUND");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(position.jd_storage_path, 60 * 15, {
      download: position.jd_original_filename ?? "job-description.pdf",
    });
  if (error || !data?.signedUrl) throw new Error(`POSITION_JD_DOWNLOAD_FAILED: ${error?.message ?? "missing URL"}`);
  return data.signedUrl;
}
