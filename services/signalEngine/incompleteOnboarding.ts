import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";

import type { SignalSeverity } from "@/services/signalEngine/contracts";

type EmployeeLifecycleState = "preboarding" | "active" | "on_leave" | "offboarding" | "exited";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  lifecycle_state: EmployeeLifecycleState;
  deleted_at: string | null;
};

type OnboardingTaskRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  status: "pending" | "completed";
};

type RiskSignalRow = {
  id: string;
  tenant_id: string;
  kind: string;
  severity: SignalSeverity;
  subject_employee_id: string | null;
  resolved_at: string | null;
};

type ActionItemRow = {
  id: string;
  tenant_id: string;
  risk_signal_id: string;
  status: string;
  resolved_at: string | null;
};

export type IncompleteOnboardingReconcileResult = {
  scannedEmployees: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

export async function reconcileIncompleteOnboardingSignals(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<IncompleteOnboardingReconcileResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceRoleClient();

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, lifecycle_state, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null)
    .in("lifecycle_state", ["preboarding", "active"]);

  if (employeeError) {
    throw new Error(`INCOMPLETE_ONBOARDING_EMPLOYEE_QUERY_FAILED: ${employeeError.message}`);
  }

  const employees = (employeeData ?? []) as EmployeeRow[];

  const { data: taskData, error: taskError } = await supabase
    .from("onboarding_tasks")
    .select("id, tenant_id, employee_id, status")
    .eq("tenant_id", params.tenantId)
    .eq("status", "pending");

  if (taskError) {
    throw new Error(`INCOMPLETE_ONBOARDING_TASK_QUERY_FAILED: ${taskError.message}`);
  }

  const tasks = (taskData ?? []) as OnboardingTaskRow[];
  const pendingCountByEmployeeId = new Map<string, number>();
  for (const task of tasks) {
    pendingCountByEmployeeId.set(task.employee_id, (pendingCountByEmployeeId.get(task.employee_id) ?? 0) + 1);
  }

  const { data: openSignalData, error: openSignalError } = await supabase
    .from("risk_signals")
    .select("id, tenant_id, kind, severity, subject_employee_id, resolved_at")
    .eq("tenant_id", params.tenantId)
    .eq("kind", "incomplete_onboarding")
    .is("resolved_at", null);

  if (openSignalError) {
    throw new Error(`INCOMPLETE_ONBOARDING_SIGNAL_QUERY_FAILED: ${openSignalError.message}`);
  }

  const openSignals = (openSignalData ?? []) as RiskSignalRow[];
  const openByEmployeeId = new Map<string, RiskSignalRow>();
  for (const signal of openSignals) {
    if (signal.subject_employee_id) {
      openByEmployeeId.set(signal.subject_employee_id, signal);
    }
  }

  const desired = new Map<string, { severity: SignalSeverity; count: number }>();
  for (const employee of employees) {
    const count = pendingCountByEmployeeId.get(employee.id) ?? 0;
    if (count <= 0) continue;

    desired.set(employee.id, {
      severity: employee.lifecycle_state === "active" ? "red" : "yellow",
      count,
    });
  }

  let createdSignals = 0;
  let updatedSignals = 0;
  let resolvedSignals = 0;

  for (const [employeeId, entry] of desired.entries()) {
    const existing = openByEmployeeId.get(employeeId);
    const evidence = {
      trigger_reason: "incomplete_onboarding",
      subject_employee_id: employeeId,
      rule_version: "incomplete_onboarding_v1",
      pending_task_count: entry.count,
      what_is_wrong: `${entry.count} onboarding task${entry.count === 1 ? " is" : "s are"} still incomplete.`,
      why_it_matters: "New-joiner setup can stall and leave work, access, or compliance steps unfinished.",
      what_to_do_next: "Resolve the remaining onboarding tasks.",
    };

    if (!existing) {
      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: "incomplete_onboarding",
          trigger_reason: "incomplete_onboarding",
          severity: entry.severity,
          subject_employee_id: employeeId,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`INCOMPLETE_ONBOARDING_SIGNAL_CREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;

      const { error: insertActionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: employeeId,
          category: "incomplete_onboarding",
          title: "Finish onboarding tasks",
          suggested_action: "Finish onboarding tasks",
          status: "open",
        } as never);

      if (insertActionError) {
        throw new Error(`INCOMPLETE_ONBOARDING_ACTION_CREATE_FAILED: ${insertActionError.message}`);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        tenant_id: params.tenantId,
        actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        action_type: "signal.incomplete_onboarding.created",
        target_id: signalId,
      } as never);

      if (auditError) {
        throw new Error(`INCOMPLETE_ONBOARDING_AUDIT_CREATE_FAILED: ${auditError.message}`);
      }

      createdSignals += 1;
      continue;
    }

    const { error: updateSignalError } = await supabase
      .from("risk_signals")
      .update({
        severity: entry.severity,
        evidence,
        last_seen_at: nowIso,
      } as never)
      .eq("tenant_id", params.tenantId)
      .eq("id", existing.id)
      .is("resolved_at", null);

    if (updateSignalError) {
      throw new Error(`INCOMPLETE_ONBOARDING_SIGNAL_UPDATE_FAILED: ${updateSignalError.message}`);
    }

    updatedSignals += 1;
  }

  for (const signal of openSignals) {
    const subjectEmployeeId = signal.subject_employee_id;
    if (!subjectEmployeeId) continue;
    if (desired.has(subjectEmployeeId)) continue;

    const { error: resolveSignalError } = await supabase
      .from("risk_signals")
      .update({
        resolved_at: nowIso,
        last_seen_at: nowIso,
      } as never)
      .eq("tenant_id", params.tenantId)
      .eq("id", signal.id)
      .is("resolved_at", null);

    if (resolveSignalError) {
      throw new Error(`INCOMPLETE_ONBOARDING_SIGNAL_RESOLVE_FAILED: ${resolveSignalError.message}`);
    }

    const { data: openActionItems, error: actionFindError } = await supabase
      .from("action_items")
      .select("id, tenant_id, risk_signal_id, status, resolved_at")
      .eq("tenant_id", params.tenantId)
      .eq("risk_signal_id", signal.id)
      .in("status", ["open", "in_progress"]);

    if (actionFindError) {
      throw new Error(`INCOMPLETE_ONBOARDING_ACTION_QUERY_FAILED: ${actionFindError.message}`);
    }

    const actionItems = (openActionItems ?? []) as ActionItemRow[];
    for (const item of actionItems) {
      const { error: actionResolveError } = await supabase
        .from("action_items")
        .update({
          status: "done",
          resolved_at: nowIso,
        } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", item.id)
        .in("status", ["open", "in_progress"]);

      if (actionResolveError) {
        throw new Error(`INCOMPLETE_ONBOARDING_ACTION_RESOLVE_FAILED: ${actionResolveError.message}`);
      }

      const { error: linkSignalError } = await supabase
        .from("risk_signals")
        .update({ resolution_action_item_id: item.id } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", signal.id);

      if (linkSignalError) {
        throw new Error(`INCOMPLETE_ONBOARDING_SIGNAL_LINK_ACTION_FAILED: ${linkSignalError.message}`);
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      action_type: "signal.incomplete_onboarding.resolved",
      target_id: signal.id,
    } as never);

    if (auditError) {
      throw new Error(`INCOMPLETE_ONBOARDING_AUDIT_RESOLVE_FAILED: ${auditError.message}`);
    }

    resolvedSignals += 1;
  }

  return {
    scannedEmployees: employees.length,
    createdSignals,
    updatedSignals,
    resolvedSignals,
  };
}