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

type ActionSourceRow = {
  id: string;
  subject_employee_id: string | null;
  category: string;
  title: string;
  suggested_action: string;
  status: "open" | "in_progress" | "done" | "dismissed";
};

type RiskSignalRow = {
  id: string;
  subject_employee_id: string | null;
  resolved_at: string | null;
};

type ActionItemRow = {
  id: string;
  risk_signal_id: string;
  status: string;
};

export type IncompleteOffboardingReconcileResult = {
  scannedEmployees: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

export async function reconcileIncompleteOffboardingSignals(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<IncompleteOffboardingReconcileResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceRoleClient();

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, lifecycle_state, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null)
    .in("lifecycle_state", ["offboarding", "exited"]);

  if (employeeError) {
    throw new Error(`INCOMPLETE_OFFBOARDING_EMPLOYEE_QUERY_FAILED: ${employeeError.message}`);
  }

  const employees = (employeeData ?? []) as EmployeeRow[];

  const { data: actionSourceData, error: actionSourceError } = await supabase
    .from("action_items")
    .select("id, subject_employee_id, category, title, suggested_action, status")
    .eq("tenant_id", params.tenantId)
    .in("status", ["open", "in_progress"]);

  if (actionSourceError) {
    throw new Error(`INCOMPLETE_OFFBOARDING_ACTION_SOURCE_QUERY_FAILED: ${actionSourceError.message}`);
  }

  const actionSources = (actionSourceData ?? []) as ActionSourceRow[];
  const openCountByEmployeeId = new Map<string, number>();
  for (const item of actionSources) {
    if (!item.subject_employee_id) continue;
    if (item.category === "incomplete_offboarding") continue;
    openCountByEmployeeId.set(item.subject_employee_id, (openCountByEmployeeId.get(item.subject_employee_id) ?? 0) + 1);
  }

  const { data: openSignalData, error: openSignalError } = await supabase
    .from("risk_signals")
    .select("id, subject_employee_id, resolved_at")
    .eq("tenant_id", params.tenantId)
    .eq("kind", "incomplete_offboarding")
    .is("resolved_at", null);

  if (openSignalError) {
    throw new Error(`INCOMPLETE_OFFBOARDING_SIGNAL_QUERY_FAILED: ${openSignalError.message}`);
  }

  const openSignals = (openSignalData ?? []) as RiskSignalRow[];
  const openByEmployeeId = new Map<string, RiskSignalRow>();
  for (const signal of openSignals) {
    if (signal.subject_employee_id) openByEmployeeId.set(signal.subject_employee_id, signal);
  }

  const desired = new Map<string, { severity: SignalSeverity; count: number }>();
  for (const employee of employees) {
    const count = openCountByEmployeeId.get(employee.id) ?? 0;
    if (count <= 0) continue;
    desired.set(employee.id, {
      severity: employee.lifecycle_state === "exited" ? "red" : "yellow",
      count,
    });
  }

  let createdSignals = 0;
  let updatedSignals = 0;
  let resolvedSignals = 0;

  for (const [employeeId, entry] of desired.entries()) {
    const existing = openByEmployeeId.get(employeeId);
    const evidence = {
      trigger_reason: "incomplete_offboarding",
      subject_employee_id: employeeId,
      rule_version: "incomplete_offboarding_v1",
      open_action_count: entry.count,
      what_is_wrong: `${entry.count} offboarding item${entry.count === 1 ? " is" : "s are"} still open.`,
      why_it_matters: "Unfinished offboarding leaves gaps in handover, recovery, and compliance closure.",
      what_to_do_next: "Resolve the remaining offboarding actions.",
    };

    if (!existing) {
      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: "incomplete_offboarding",
          trigger_reason: "incomplete_offboarding",
          severity: entry.severity,
          subject_employee_id: employeeId,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`INCOMPLETE_OFFBOARDING_SIGNAL_CREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;
      const { error: insertActionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: employeeId,
          category: "incomplete_offboarding",
          title: "Complete offboarding actions",
          suggested_action: "Complete offboarding actions",
          status: "open",
        } as never);

      if (insertActionError) {
        throw new Error(`INCOMPLETE_OFFBOARDING_ACTION_CREATE_FAILED: ${insertActionError.message}`);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        tenant_id: params.tenantId,
        actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        action_type: "signal.incomplete_offboarding.created",
        target_id: signalId,
      } as never);

      if (auditError) {
        throw new Error(`INCOMPLETE_OFFBOARDING_AUDIT_CREATE_FAILED: ${auditError.message}`);
      }

      createdSignals += 1;
      continue;
    }

    const { error: updateSignalError } = await supabase
      .from("risk_signals")
      .update({ severity: entry.severity, evidence, last_seen_at: nowIso } as never)
      .eq("tenant_id", params.tenantId)
      .eq("id", existing.id)
      .is("resolved_at", null);

    if (updateSignalError) {
      throw new Error(`INCOMPLETE_OFFBOARDING_SIGNAL_UPDATE_FAILED: ${updateSignalError.message}`);
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
      throw new Error(`INCOMPLETE_OFFBOARDING_SIGNAL_RESOLVE_FAILED: ${resolveSignalError.message}`);
    }

    const { data: openActionItems, error: actionFindError } = await supabase
      .from("action_items")
      .select("id, risk_signal_id, status")
      .eq("tenant_id", params.tenantId)
      .eq("risk_signal_id", signal.id)
      .in("status", ["open", "in_progress"]);

    if (actionFindError) {
      throw new Error(`INCOMPLETE_OFFBOARDING_ACTION_QUERY_FAILED: ${actionFindError.message}`);
    }

    for (const item of (openActionItems ?? []) as ActionItemRow[]) {
      const { error: actionResolveError } = await supabase
        .from("action_items")
        .update({ status: "done", resolved_at: nowIso } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", item.id)
        .in("status", ["open", "in_progress"]);

      if (actionResolveError) {
        throw new Error(`INCOMPLETE_OFFBOARDING_ACTION_RESOLVE_FAILED: ${actionResolveError.message}`);
      }

      const { error: linkSignalError } = await supabase
        .from("risk_signals")
        .update({ resolution_action_item_id: item.id } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", signal.id);

      if (linkSignalError) {
        throw new Error(`INCOMPLETE_OFFBOARDING_SIGNAL_LINK_ACTION_FAILED: ${linkSignalError.message}`);
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      action_type: "signal.incomplete_offboarding.resolved",
      target_id: signal.id,
    } as never);

    if (auditError) {
      throw new Error(`INCOMPLETE_OFFBOARDING_AUDIT_RESOLVE_FAILED: ${auditError.message}`);
    }

    resolvedSignals += 1;
  }

  return { scannedEmployees: employees.length, createdSignals, updatedSignals, resolvedSignals };
}