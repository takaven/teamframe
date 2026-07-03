/**
 * Onboarding service — server-side only.
 *
 * Scope lock (see docs/drift-guard.md):
 *  - assign task, complete task, list tasks
 *  - static template packs (services/onboardingService/templates.ts) expand
 *    into ordinary tasks at assign time — no template tables, no template UI
 *  - optional per-task due date — NO reminders, NO notifications,
 *    NO multi-step workflows (Wave 2, gap audit 2026-05-30)
 */

import "server-only";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { track } from "@/lib/telemetry/track";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";
import { expandTemplatePack } from "./templates";

export type OnboardingTaskStatus = "pending" | "completed";

export type OnboardingTask = {
  id: string;
  employee_id: string;
  title: string;
  status: OnboardingTaskStatus;
  assigned_by: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const TASK_SELECT =
  "id, tenant_id, employee_id, title, status, assigned_by, due_date, completed_at, created_at, updated_at";

type OnboardingTaskRow = OnboardingTask & { tenant_id: string };

const ACTIVATION_WORKFLOW_EVENTS = [
  "first_employee_added",
  "first_onboarding_assigned",
  "first_onboarding_completed",
  "first_leave_requested",
  "first_leave_approved",
] as const;

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

async function writeAudit(actor: Actor, actionType: string, targetId?: string): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
  if (error) {
    console.error("AUDIT_LOG_WRITE_FAILED", {
      domain: "onboarding",
      action_type: actionType,
      tenant_id: tenantId,
      target_id: targetId ?? null,
      message: error.message,
    });
  }
}

// All events queried in a single round-trip: the 5 prerequisite workflow events plus
// activation_completed itself so we can short-circuit if it has already been inserted.
const ACTIVATION_COMPLETED_CHECK_EVENTS = [
  ...ACTIVATION_WORKFLOW_EVENTS,
  "activation_completed",
] as const;

export async function maybeFireActivationCompleted(tenantId: string, userId: string): Promise<void> {
  const start = Date.now();
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_name")
    .eq("tenant_id", tenantId)
    .in("event_name", ACTIVATION_COMPLETED_CHECK_EVENTS as unknown as string[]);

  if (error) {
    // Non-fatal: activation completion check failing does not break the user flow,
    // but a silent DB failure here would block the activation funnel indefinitely.
    // durationMs distinguishes a fast permission/validation failure from a slow timeout —
    // the diagnostic signal the wider Phase 1C instrumentation pass was added for.
    logAction({
      action: "maybeFireActivationCompleted",
      actorUserId: userId,
      actorTenantId: tenantId,
      durationMs: Date.now() - start,
      outcome: "fail",
      error,
    });
    captureActionError("maybeFireActivationCompleted", error, {
      actor_user_id: userId,
      actor_tenant_id: tenantId,
    });
    return; // Preserve resilience: do not throw to caller.
  }

  const firedNames = new Set((data ?? []).map((r: { event_name: string }) => r.event_name));
  // Idempotency guard: if activation_completed is already in the DB, do nothing.
  if (firedNames.has("activation_completed")) return;
  const allFired = ACTIVATION_WORKFLOW_EVENTS.every((e) => firedNames.has(e));
  if (allFired) {
    await track({
      tenantId,
      userId,
      eventName: "activation_completed",
      properties: {},
    });
  }
}

export async function listOnboardingTasksForEmployee(
  actor: Actor,
  employeeId: string,
): Promise<OnboardingTask[]> {
  const tenantId = requireTenant(actor);
  if (actor.role !== "admin" && actor.employeeId !== employeeId) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .select(TASK_SELECT)
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`ONBOARDING_LIST_FAILED: ${error.message}`);
  return ((data ?? []) as OnboardingTaskRow[]).map(({ tenant_id: _t, ...row }) => row);
}

export async function listAllOnboardingTasks(actor: Actor): Promise<OnboardingTask[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .select(TASK_SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`ONBOARDING_LIST_ALL_FAILED: ${error.message}`);
  return ((data ?? []) as OnboardingTaskRow[]).map(({ tenant_id: _t, ...row }) => row);
}

export async function assignOnboardingTask(
  actor: Actor,
  input: { employeeId: string; title: string },
): Promise<OnboardingTask> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .insert({
      tenant_id: tenantId,
      employee_id: input.employeeId,
      title: input.title.trim(),
      status: "pending",
      assigned_by: actor.authUserId,
    } as never)
    .select(TASK_SELECT)
    .single();

  if (error) throw new Error(`ONBOARDING_ASSIGN_FAILED: ${error.message}`);

  const created = data as OnboardingTaskRow;
  await writeAudit(actor, "onboarding.assigned", created.id);

  // Fire first_onboarding_assigned once per tenant
  const countResult = await supabase
    .from("onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((countResult.count ?? 0) === 1) {
    await track({ tenantId, userId: actor.authUserId, eventName: "first_onboarding_assigned", properties: { task_id: created.id } });
    await maybeFireActivationCompleted(tenantId, actor.authUserId);
  }

  const { tenant_id: _t, ...row } = created;
  return row;
}

/**
 * Assign a static template pack to an employee (Wave 2).
 *
 * Expands the pack server-side — only the pack id and the kept task indexes
 * are trusted from the client. Due dates are computed from the employee's
 * start date (falling back to their created date when start date is unset).
 */
export async function assignOnboardingPack(
  actor: Actor,
  input: { employeeId: string; packId: string; keptIndexes: number[] },
): Promise<OnboardingTask[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, start_date, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", input.employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (employeeError) throw new Error(`ONBOARDING_ASSIGN_FAILED: ${employeeError.message}`);
  if (!employeeData) throw new Error("NOT_FOUND");

  const employee = employeeData as { start_date: string | null; created_at: string };
  const baseDate = employee.start_date ?? employee.created_at;
  const tasks = expandTemplatePack(input.packId, input.keptIndexes, baseDate);
  if (tasks.length === 0) throw new Error("ONBOARDING_PACK_EMPTY");

  const { data, error } = await supabase
    .from("onboarding_tasks")
    .insert(
      tasks.map((task) => ({
        tenant_id: tenantId,
        employee_id: input.employeeId,
        title: task.title,
        status: "pending",
        assigned_by: actor.authUserId,
        due_date: task.due_date,
      })) as never,
    )
    .select(TASK_SELECT);

  if (error) throw new Error(`ONBOARDING_ASSIGN_FAILED: ${error.message}`);

  const created = (data ?? []) as OnboardingTaskRow[];
  await writeAudit(actor, "onboarding.pack_assigned", input.employeeId);

  // Fire first_onboarding_assigned once per tenant — a pack can be the very
  // first assignment, in which case the tenant total equals this batch size.
  const countResult = await supabase
    .from("onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((countResult.count ?? 0) === created.length && created.length > 0) {
    await track({
      tenantId,
      userId: actor.authUserId,
      eventName: "first_onboarding_assigned",
      properties: { pack_id: input.packId, task_count: created.length },
    });
    await maybeFireActivationCompleted(tenantId, actor.authUserId);
  }

  return created.map(({ tenant_id: _tenant, ...row }) => row);
}

export async function completeOnboardingTask(
  actor: Actor,
  taskId: string,
  expectedUpdatedAt: string,
): Promise<OnboardingTask> {
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");

  const supabase = createServiceRoleClient();

  // Employees can only complete their own tasks; admins can complete any
  let query = supabase
    .from("onboarding_tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", taskId)
    .eq("updated_at", expectedUpdatedAt)
    .eq("status", "pending");

  if (actor.role !== "admin" && actor.employeeId) {
    query = query.eq("employee_id", actor.employeeId);
  }

  const { data, error } = await query
    .select(TASK_SELECT)
    .maybeSingle();

  if (error) throw new Error(`ONBOARDING_COMPLETE_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");

  const updated = data as OnboardingTaskRow;
  await writeAudit(actor, "onboarding.completed", taskId);

  // Fire first_onboarding_completed once per tenant
  const countResult = await supabase
    .from("onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "completed");
  if ((countResult.count ?? 0) === 1) {
    await track({ tenantId, userId: actor.authUserId, eventName: "first_onboarding_completed", properties: { task_id: taskId } });
    await maybeFireActivationCompleted(tenantId, actor.authUserId);
  }

  const { tenant_id: _t, ...row } = updated;
  return row;
}
