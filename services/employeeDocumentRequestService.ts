import "server-only";

import { randomUUID } from "node:crypto";
import type { Actor } from "@/middleware/rbac";
import {
  employeeDocumentRequestLabel,
  employeeDocumentType,
  parseEmployeeDocumentRequestInput,
  type EmployeeDocumentRequestInput,
  type EmployeeDocumentRequestStatus,
  type EmployeeDocumentRequestType,
} from "@/lib/employeeDocumentRequests";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { canProcessEmployeeDocumentRequest } from "@/lib/rbac/access";
import {
  getSignedDownloadUrl,
  softDeleteDocument,
  uploadDocument,
} from "@/services/documentService";
import { notifyEmployeeDocumentReady } from "@/services/notificationService";

type EmployeeDocumentRequestRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  request_type: EmployeeDocumentRequestType;
  details: string | null;
  needed_by: string | null;
  status: EmployeeDocumentRequestStatus;
  final_document_id: string | null;
  automation_item_id: string | null;
  requested_by_user_id: string;
  requested_at: string;
  completed_by_user_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeDocumentRequestRecord = Omit<
  EmployeeDocumentRequestRow,
  "tenant_id" | "requested_by_user_id" | "completed_by_user_id" | "automation_item_id"
> & {
  label: string;
};

export type ProcessableEmployeeDocumentRequest = EmployeeDocumentRequestRecord & {
  employee_name: string;
  employee_role_title: string;
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function toRecord(row: EmployeeDocumentRequestRow): EmployeeDocumentRequestRecord {
  const {
    tenant_id: _tenantId,
    requested_by_user_id: _requestedBy,
    completed_by_user_id: _completedBy,
    automation_item_id: _automationItemId,
    ...request
  } = row;
  return { ...request, label: employeeDocumentRequestLabel(row.request_type) };
}

async function findRequest(actor: Actor, requestId: string): Promise<EmployeeDocumentRequestRow> {
  const tenantId = requireTenant(actor);
  const db: any = createServiceRoleClient();
  const { data, error } = await db
    .from("employee_document_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(`EMPLOYEE_DOCUMENT_REQUEST_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error("EMPLOYEE_DOCUMENT_REQUEST_NOT_FOUND");
  return data as EmployeeDocumentRequestRow;
}

export async function canAccessEmployeeDocumentRequest(
  actor: Actor,
  employeeId: string,
): Promise<boolean> {
  if (actor.employeeId === employeeId) return true;
  return canProcessEmployeeDocumentRequest(actor, employeeId);
}

async function requireProcessor(actor: Actor, employeeId: string): Promise<void> {
  if (!(await canProcessEmployeeDocumentRequest(actor, employeeId))) throw new Error("FORBIDDEN");
}

export async function createEmployeeDocumentRequest(
  actor: Actor,
  input: EmployeeDocumentRequestInput,
): Promise<EmployeeDocumentRequestRecord> {
  const tenantId = requireTenant(actor);
  if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
  const parsed = parseEmployeeDocumentRequestInput(input);
  const requestId = randomUUID();
  const db: any = createServiceRoleClient();
  const { data, error } = await db.rpc("teamframe_create_employee_document_request", {
    p_id: requestId,
    p_tenant_id: tenantId,
    p_employee_id: actor.employeeId,
    p_request_type: parsed.requestType,
    p_details: parsed.details ?? null,
    p_needed_by: parsed.neededBy ?? null,
    p_actor_user_id: actor.authUserId,
  });
  if (error || !data) {
    throw new Error(`EMPLOYEE_DOCUMENT_REQUEST_CREATE_FAILED: ${error?.message ?? "no request returned"}`);
  }
  return toRecord(data as EmployeeDocumentRequestRow);
}

export async function listOwnEmployeeDocumentRequests(
  actor: Actor,
): Promise<EmployeeDocumentRequestRecord[]> {
  const tenantId = requireTenant(actor);
  if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
  const db: any = createServiceRoleClient();
  const { data, error } = await db
    .from("employee_document_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("employee_id", actor.employeeId)
    .order("requested_at", { ascending: false });
  if (error) throw new Error(`EMPLOYEE_DOCUMENT_REQUEST_LIST_FAILED: ${error.message}`);
  return ((data ?? []) as EmployeeDocumentRequestRow[]).map(toRecord);
}

export async function listProcessableEmployeeDocumentRequests(
  actor: Actor,
): Promise<ProcessableEmployeeDocumentRequest[]> {
  const tenantId = requireTenant(actor);
  const db: any = createServiceRoleClient();
  const { data, error } = await db
    .from("employee_document_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("requested_at", { ascending: false });
  if (error) throw new Error(`EMPLOYEE_DOCUMENT_REQUEST_LIST_FAILED: ${error.message}`);

  const rows = (data ?? []) as EmployeeDocumentRequestRow[];
  const allowed = (
    await Promise.all(rows.map(async (row) => ({ row, allowed: await canProcessEmployeeDocumentRequest(actor, row.employee_id) })))
  ).filter((entry) => entry.allowed).map((entry) => entry.row);
  const employeeIds = [...new Set(allowed.map((row) => row.employee_id))];
  const employeeById = new Map<string, { full_name: string; role_title: string }>();
  if (employeeIds.length > 0) {
    const { data: employees, error: employeeError } = await db
      .from("employees")
      .select("id, full_name, role_title")
      .eq("tenant_id", tenantId)
      .in("id", employeeIds);
    if (employeeError) throw new Error(`EMPLOYEE_DOCUMENT_REQUEST_EMPLOYEES_FAILED: ${employeeError.message}`);
    for (const employee of employees ?? []) employeeById.set(employee.id, employee);
  }

  return allowed.map((row) => ({
    ...toRecord(row),
    employee_name: employeeById.get(row.employee_id)?.full_name ?? "Unknown person",
    employee_role_title: employeeById.get(row.employee_id)?.role_title ?? "",
  }));
}

export async function markEmployeeDocumentRequestInProgress(
  actor: Actor,
  requestId: string,
): Promise<EmployeeDocumentRequestRecord> {
  const tenantId = requireTenant(actor);
  const existing = await findRequest(actor, requestId);
  await requireProcessor(actor, existing.employee_id);
  const db: any = createServiceRoleClient();
  const { data, error } = await db.rpc("teamframe_mark_employee_document_request_in_progress", {
    p_tenant_id: tenantId,
    p_request_id: requestId,
    p_actor_user_id: actor.authUserId,
  });
  if (error || !data) {
    throw new Error(`EMPLOYEE_DOCUMENT_REQUEST_PROGRESS_FAILED: ${error?.message ?? "no request returned"}`);
  }
  return toRecord(data as EmployeeDocumentRequestRow);
}

export async function completeEmployeeDocumentRequest(
  actor: Actor,
  input: { requestId: string; file: File },
): Promise<EmployeeDocumentRequestRecord> {
  const tenantId = requireTenant(actor);
  const existing = await findRequest(actor, input.requestId);
  await requireProcessor(actor, existing.employee_id);
  if (existing.status === "ready") throw new Error("EMPLOYEE_DOCUMENT_REQUEST_ALREADY_READY");

  const document = await uploadDocument(
    actor,
    {
      employeeId: existing.employee_id,
      type: employeeDocumentType(existing.request_type),
      file: input.file,
    },
    { auditActionType: "employee_document_request.document_uploaded" },
  );

  const db: any = createServiceRoleClient();
  try {
    const { data, error } = await db.rpc("teamframe_complete_employee_document_request", {
      p_tenant_id: tenantId,
      p_request_id: input.requestId,
      p_document_id: document.id,
      p_actor_user_id: actor.authUserId,
    });
    if (error || !data) {
      throw new Error(`EMPLOYEE_DOCUMENT_REQUEST_COMPLETE_FAILED: ${error?.message ?? "no request returned"}`);
    }
    const completed = toRecord(data as EmployeeDocumentRequestRow);
    await notifyEmployeeDocumentReady(tenantId, completed.id);
    return completed;
  } catch (error) {
    // Storage cannot participate in the request transaction. Remove the newly
    // uploaded file if the atomic link loses a concurrent race or otherwise fails.
    try {
      await softDeleteDocument(actor, document.id);
    } catch (compensationError) {
      console.error("EMPLOYEE_DOCUMENT_REQUEST_UPLOAD_COMPENSATION_FAILED", compensationError);
    }
    throw error;
  }
}

export async function getEmployeeDocumentRequestDownloadUrl(
  actor: Actor,
  requestId: string,
): Promise<string> {
  const existing = await findRequest(actor, requestId);
  if (!(await canAccessEmployeeDocumentRequest(actor, existing.employee_id))) throw new Error("FORBIDDEN");
  if (existing.status !== "ready" || !existing.final_document_id) {
    throw new Error("EMPLOYEE_DOCUMENT_REQUEST_NOT_READY");
  }
  return getSignedDownloadUrl(actor, existing.final_document_id);
}
