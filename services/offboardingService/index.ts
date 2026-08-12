import "server-only";

import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { assertCurrentDirectManager, listCurrentDirectReports } from "@/services/managerAuthorization";

export type OffboardingCaseStatus = "active" | "cancelled" | "completed";
export type OffboardingItemStatus = "pending" | "completed" | "cancelled";
export type OffboardingOwnerRole = "admin" | "manager" | "employee" | "system";
export type OffboardingCompletionMode =
  | "manual_confirmation"
  | "document_required"
  | "policy_acknowledgement"
  | "form_or_data_required";

export type OffboardingCase = {
  id: string;
  employee_id: string;
  effective_end_date: string;
  status: OffboardingCaseStatus;
  started_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  closure_automation_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OffboardingItem = {
  id: string;
  offboarding_case_id: string;
  employee_id: string;
  item_key: string;
  title: string;
  owner_role: OffboardingOwnerRole;
  owner_employee_id: string | null;
  due_date: string | null;
  required: boolean;
  completion_mode: OffboardingCompletionMode;
  required_document_type: string | null;
  status: OffboardingItemStatus;
  completed_at: string | null;
  automation_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OffboardingWorkflow = {
  case: OffboardingCase;
  items: OffboardingItem[];
};

export type OffboardingLeaveReconciliation = {
  effective_end_date: string;
  pending_leave_count: number;
  approved_post_end_count: number;
  approved_crossing_end_count: number;
  pending_leaves: LeaveRecord[];
  approved_conflicts: LeaveRecord[];
};

type LeaveRecord = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: "annual" | "sick" | "unpaid" | "other";
  requested_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_by_user_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  override_insufficient_balance: boolean;
  override_reason: string | null;
  cancelled_by_user_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  approval_automation_item_id: string | null;
  created_at: string;
  updated_at: string;
};

type OffboardingCaseRow = OffboardingCase & {
  tenant_id: string;
  started_by_user_id: string;
  cancelled_by_user_id: string | null;
  completed_by_actor_type: string | null;
};

type OffboardingItemRow = OffboardingItem & {
  tenant_id: string;
  completed_by_user_id: string | null;
};

type LeaveRow = Omit<LeaveRecord, "requested_days"> & {
  tenant_id: string;
  requested_days: string | number;
};

const OFFBOARDING_CASE_COLUMNS =
  "id, tenant_id, employee_id, effective_end_date, status, started_at, started_by_user_id, cancelled_at, cancelled_by_user_id, completed_at, completed_by_actor_type, closure_automation_item_id, created_at, updated_at";
const OFFBOARDING_ITEM_COLUMNS =
  "id, tenant_id, offboarding_case_id, employee_id, item_key, title, owner_role, owner_employee_id, due_date, required, completion_mode, required_document_type, status, completed_at, completed_by_user_id, automation_item_id, created_at, updated_at";
const LEAVE_COLUMNS =
  "id, tenant_id, employee_id, start_date, end_date, leave_type, requested_days, reason, status, decided_by_user_id, decided_at, decision_note, override_insufficient_balance, override_reason, cancelled_by_user_id, cancelled_at, cancellation_reason, approval_automation_item_id, created_at, updated_at";

const StartOffboardingSchema = z.object({
  employeeId: z.string().uuid(),
  effectiveEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedUpdatedAt: z.string().trim().min(1),
});

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

function toCase(row: OffboardingCaseRow): OffboardingCase {
  const {
    tenant_id: _tenantId,
    started_by_user_id: _startedBy,
    cancelled_by_user_id: _cancelledBy,
    completed_by_actor_type: _completedByType,
    ...record
  } = row;
  return record;
}

function isEmptyCaseRow(row: Partial<OffboardingCaseRow> | null | undefined): boolean {
  return !row?.id;
}

function toItem(row: OffboardingItemRow): OffboardingItem {
  const { tenant_id: _tenantId, completed_by_user_id: _completedBy, ...record } = row;
  return record;
}

function toLeave(row: LeaveRow): LeaveRecord {
  const { tenant_id: _tenantId, requested_days, ...record } = row;
  return {
    ...record,
    requested_days: Number(requested_days),
  };
}

async function fetchWorkflow(tenantId: string, caseId: string): Promise<OffboardingWorkflow> {
  const supabase = createServiceRoleClient();
  const [{ data: caseData, error: caseError }, { data: itemsData, error: itemsError }] = await Promise.all([
    supabase
      .from("offboarding_cases")
      .select(OFFBOARDING_CASE_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("id", caseId)
      .maybeSingle(),
    supabase
      .from("offboarding_items")
      .select(OFFBOARDING_ITEM_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("offboarding_case_id", caseId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (caseError) throw new Error(`OFFBOARDING_CASE_FETCH_FAILED: ${caseError.message}`);
  if (itemsError) throw new Error(`OFFBOARDING_ITEMS_FETCH_FAILED: ${itemsError.message}`);
  if (!caseData) throw new Error("OFFBOARDING_NOT_FOUND");

  return {
    case: toCase(caseData as OffboardingCaseRow),
    items: ((itemsData ?? []) as OffboardingItemRow[]).map(toItem),
  };
}

export async function startOffboarding(
  actor: Actor,
  input: { employeeId: string; effectiveEndDate: string; expectedUpdatedAt: string },
): Promise<OffboardingWorkflow> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = StartOffboardingSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("teamframe_start_offboarding", {
    p_tenant_id: tenantId,
    p_actor_user_id: actor.authUserId,
    p_employee_id: parsed.employeeId,
    p_effective_end_date: parsed.effectiveEndDate,
    p_expected_updated_at: parsed.expectedUpdatedAt,
  } as never);

  if (error) throw new Error(`OFFBOARDING_START_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");

  return fetchWorkflow(tenantId, (data as { id: string }).id);
}

export async function listOffboardingForEmployee(actor: Actor, employeeId: string): Promise<OffboardingWorkflow | null> {
  const tenantId = requireTenant(actor);
  if (actor.role !== "admin" && actor.employeeId !== employeeId) {
    await assertCurrentDirectManager(actor, employeeId);
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("offboarding_cases")
    .select(OFFBOARDING_CASE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`OFFBOARDING_CASE_FETCH_FAILED: ${error.message}`);
  if (!data) return null;
  return fetchWorkflow(tenantId, (data as OffboardingCaseRow).id);
}

export async function listManagerOffboardingItems(actor: Actor): Promise<OffboardingItem[]> {
  const tenantId = requireTenant(actor);
  const reports = await listCurrentDirectReports(actor);
  const reportIds = reports.map((employee) => employee.id);
  if (reportIds.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("offboarding_items")
    .select(OFFBOARDING_ITEM_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("owner_role", "manager")
    .eq("status", "pending")
    .in("employee_id", reportIds)
    .order("due_date", { ascending: true });

  if (error) throw new Error(`MANAGER_OFFBOARDING_LIST_FAILED: ${error.message}`);
  return ((data ?? []) as OffboardingItemRow[]).map(toItem);
}

export async function completeOffboardingItem(
  actor: Actor,
  itemId: string,
  expectedUpdatedAt: string,
): Promise<OffboardingItem> {
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");
  const supabase = createServiceRoleClient();
  const { data: itemData, error: itemError } = await supabase
    .from("offboarding_items")
    .select(OFFBOARDING_ITEM_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .eq("status", "pending")
    .maybeSingle();

  if (itemError) throw new Error(`OFFBOARDING_ITEM_FETCH_FAILED: ${itemError.message}`);
  if (!itemData) throw new Error("OFFBOARDING_ITEM_NOT_FOUND");
  const item = itemData as OffboardingItemRow;

  if (actor.role === "admin") {
    // Admin owns final HR closeout and remains fallback for stranded work.
  } else if (item.owner_role === "manager") {
    await assertCurrentDirectManager(actor, item.employee_id);
  } else if (item.owner_role === "employee" && actor.employeeId === item.employee_id) {
    // Own employee task.
  } else {
    throw new Error("FORBIDDEN");
  }

  const { data, error } = await supabase
    .rpc("teamframe_complete_offboarding_item", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_item_id: itemId,
      p_expected_updated_at: expectedUpdatedAt,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`OFFBOARDING_ITEM_COMPLETE_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");
  return toItem(data as OffboardingItemRow);
}

export async function cancelOffboarding(actor: Actor, caseId: string): Promise<OffboardingCase> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_cancel_offboarding", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_case_id: caseId,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`OFFBOARDING_CANCEL_FAILED: ${error.message}`);
  if (!data || isEmptyCaseRow(data as Partial<OffboardingCaseRow>)) throw new Error("OFFBOARDING_NOT_FOUND");
  return toCase(data as OffboardingCaseRow);
}

export async function evaluateOffboardingClosure(input: {
  tenantId: string;
  caseId: string;
  actorUserId?: string;
  actorType?: "human" | "system";
  asOf?: string;
}): Promise<OffboardingCase | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_evaluate_offboarding_closure", {
      p_tenant_id: input.tenantId,
      p_case_id: input.caseId,
      p_actor_user_id: input.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      p_actor_type: input.actorType ?? "system",
      p_as_of: input.asOf ?? new Date().toISOString().slice(0, 10),
    } as never)
    .maybeSingle();

  if (error) throw new Error(`OFFBOARDING_CLOSURE_FAILED: ${error.message}`);
  if (data && !isEmptyCaseRow(data as Partial<OffboardingCaseRow>)) return toCase(data as OffboardingCaseRow);

  const { data: caseData, error: fetchError } = await supabase
    .from("offboarding_cases")
    .select(OFFBOARDING_CASE_COLUMNS)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.caseId)
    .maybeSingle();

  if (fetchError) throw new Error(`OFFBOARDING_CLOSURE_FETCH_FAILED: ${fetchError.message}`);
  return caseData ? toCase(caseData as OffboardingCaseRow) : null;
}

export async function assertLeaveDoesNotExceedActiveOffboardingEndDate(
  actor: Actor,
  employeeId: string,
  requestEndDate: string,
): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("offboarding_cases")
    .select("effective_end_date")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`OFFBOARDING_LEAVE_CHECK_FAILED: ${error.message}`);
  const endDate = (data as { effective_end_date: string } | null)?.effective_end_date;
  if (endDate && requestEndDate > endDate) {
    throw new Error("LEAVE_AFTER_OFFBOARDING_END_DATE");
  }
}

export async function getOffboardingLeaveReconciliation(
  actor: Actor,
  employeeId: string,
): Promise<OffboardingLeaveReconciliation | null> {
  requireAdmin(actor);
  const workflow = await listOffboardingForEmployee(actor, employeeId);
  if (!workflow) return null;
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select(LEAVE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .in("status", ["pending", "approved"])
    .order("start_date", { ascending: true });

  if (error) throw new Error(`OFFBOARDING_LEAVE_RECONCILIATION_FAILED: ${error.message}`);
  const leaves = ((data ?? []) as LeaveRow[]).map(toLeave);
  const pendingLeaves = leaves.filter((leave) => leave.status === "pending");
  const approvedConflicts = leaves.filter(
    (leave) =>
      leave.status === "approved" &&
      (leave.start_date > workflow.case.effective_end_date || leave.end_date > workflow.case.effective_end_date),
  );

  return {
    effective_end_date: workflow.case.effective_end_date,
    pending_leave_count: pendingLeaves.length,
    approved_post_end_count: approvedConflicts.filter((leave) => leave.start_date > workflow.case.effective_end_date).length,
    approved_crossing_end_count: approvedConflicts.filter((leave) => leave.start_date <= workflow.case.effective_end_date).length,
    pending_leaves: pendingLeaves,
    approved_conflicts: approvedConflicts,
  };
}
