import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  lifecycle_state: "preboarding" | "active" | "on_leave" | "offboarding" | "exited";
  status: "active" | "on_leave" | "inactive";
  setup_status: "incomplete" | "ready" | "active";
  deleted_at: string | null;
};

type RiskSignalRow = { id: string; subject_employee_id: string | null; resolved_at: string | null };
type ActionItemRow = { id: string; risk_signal_id: string; status: string };

export type ActiveAccessAfterExitReconcileResult = {
  scannedEmployees: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

export async function reconcileActiveAccessAfterExitSignals(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<ActiveAccessAfterExitReconcileResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceRoleClient();

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, lifecycle_state, status, setup_status, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null)
    .eq("lifecycle_state", "exited");

  if (employeeError) {
    throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_EMPLOYEE_QUERY_FAILED: ${employeeError.message}`);
  }

  const employees = (employeeData ?? []) as EmployeeRow[];

  const { data: openSignalData, error: openSignalError } = await supabase
    .from("risk_signals")
    .select("id, subject_employee_id, resolved_at")
    .eq("tenant_id", params.tenantId)
    .eq("kind", "active_access_after_exit")
    .is("resolved_at", null);

  if (openSignalError) {
    throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_SIGNAL_QUERY_FAILED: ${openSignalError.message}`);
  }

  const openSignals = (openSignalData ?? []) as RiskSignalRow[];
  const openByEmployeeId = new Map<string, RiskSignalRow>();
  for (const signal of openSignals) {
    if (signal.subject_employee_id) openByEmployeeId.set(signal.subject_employee_id, signal);
  }

  const { data: completedActionData, error: completedActionError } = await supabase
    .from("action_items")
    .select("subject_employee_id")
    .eq("tenant_id", params.tenantId)
    .eq("category", "active_access_after_exit")
    .eq("status", "done");

  if (completedActionError) {
    throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_COMPLETED_ACTION_QUERY_FAILED: ${completedActionError.message}`);
  }

  const completedByEmployeeId = new Set(
    ((completedActionData ?? []) as { subject_employee_id: string | null }[])
      .map((row) => row.subject_employee_id)
      .filter((value): value is string => Boolean(value)),
  );

  const desired = new Set<string>();
  for (const employee of employees) {
    if (completedByEmployeeId.has(employee.id)) {
      continue;
    }

    if (employee.status === "active" || employee.setup_status === "active") {
      desired.add(employee.id);
    }
  }

  let createdSignals = 0;
  let updatedSignals = 0;
  let resolvedSignals = 0;

  for (const employeeId of desired) {
    const existing = openByEmployeeId.get(employeeId);
    const evidence = {
      trigger_reason: "active_access_after_exit",
      subject_employee_id: employeeId,
      rule_version: "active_access_after_exit_v1",
      what_is_wrong: "An exited employee still appears active in access-related status fields.",
      why_it_matters: "Access can remain open after departure and create security and compliance exposure.",
      what_to_do_next: "Resolve access and mark the record inactive.",
    };

    if (!existing) {
      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: "active_access_after_exit",
          trigger_reason: "active_access_after_exit",
          severity: "red",
          subject_employee_id: employeeId,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_SIGNAL_CREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;
      const { error: actionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: employeeId,
          category: "active_access_after_exit",
          title: "Disable remaining access",
          suggested_action: "Disable remaining access",
          status: "open",
        } as never);

      if (actionError) {
        throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_ACTION_CREATE_FAILED: ${actionError.message}`);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        tenant_id: params.tenantId,
        actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        action_type: "signal.active_access_after_exit.created",
        target_id: signalId,
      } as never);

      if (auditError) {
        throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_AUDIT_CREATE_FAILED: ${auditError.message}`);
      }

      createdSignals += 1;
      continue;
    }

    const { error: updateSignalError } = await supabase
      .from("risk_signals")
      .update({ severity: "red", evidence, last_seen_at: nowIso } as never)
      .eq("tenant_id", params.tenantId)
      .eq("id", existing.id)
      .is("resolved_at", null);

    if (updateSignalError) {
      throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_SIGNAL_UPDATE_FAILED: ${updateSignalError.message}`);
    }

    updatedSignals += 1;
  }

  for (const signal of openSignals) {
    const subjectEmployeeId = signal.subject_employee_id;
    if (!subjectEmployeeId) continue;
    if (desired.has(subjectEmployeeId)) continue;

    const { error: resolveSignalError } = await supabase
      .from("risk_signals")
      .update({ resolved_at: nowIso, last_seen_at: nowIso } as never)
      .eq("tenant_id", params.tenantId)
      .eq("id", signal.id)
      .is("resolved_at", null);

    if (resolveSignalError) {
      throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_SIGNAL_RESOLVE_FAILED: ${resolveSignalError.message}`);
    }

    const { data: openActionItems, error: actionFindError } = await supabase
      .from("action_items")
      .select("id, risk_signal_id, status")
      .eq("tenant_id", params.tenantId)
      .eq("risk_signal_id", signal.id)
      .in("status", ["open", "in_progress"]);

    if (actionFindError) {
      throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_ACTION_QUERY_FAILED: ${actionFindError.message}`);
    }

    for (const item of (openActionItems ?? []) as ActionItemRow[]) {
      const { error: actionResolveError } = await supabase
        .from("action_items")
        .update({ status: "done", resolved_at: nowIso } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", item.id)
        .in("status", ["open", "in_progress"]);

      if (actionResolveError) {
        throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_ACTION_RESOLVE_FAILED: ${actionResolveError.message}`);
      }

      const { error: linkSignalError } = await supabase
        .from("risk_signals")
        .update({ resolution_action_item_id: item.id } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", signal.id);

      if (linkSignalError) {
        throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_SIGNAL_LINK_ACTION_FAILED: ${linkSignalError.message}`);
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      action_type: "signal.active_access_after_exit.resolved",
      target_id: signal.id,
    } as never);

    if (auditError) {
      throw new Error(`ACTIVE_ACCESS_AFTER_EXIT_AUDIT_RESOLVE_FAILED: ${auditError.message}`);
    }

    resolvedSignals += 1;
  }

  return { scannedEmployees: employees.length, createdSignals, updatedSignals, resolvedSignals };
}