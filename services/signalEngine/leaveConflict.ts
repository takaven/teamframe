import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";

type LeaveRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected";
};

type RiskSignalRow = { id: string; subject_employee_id: string | null; resolved_at: string | null };
type ActionItemRow = { id: string; risk_signal_id: string; status: string };

function hasOverlap(a: LeaveRow, b: LeaveRow): boolean {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

export type LeaveConflictReconcileResult = {
  scannedEmployees: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

export async function reconcileLeaveConflictSignals(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<LeaveConflictReconcileResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceRoleClient();

  const { data: leaveData, error: leaveError } = await supabase
    .from("leaves")
    .select("id, tenant_id, employee_id, start_date, end_date, status")
    .eq("tenant_id", params.tenantId)
    .in("status", ["pending", "approved"]);

  if (leaveError) {
    throw new Error(`LEAVE_CONFLICT_LEAVE_QUERY_FAILED: ${leaveError.message}`);
  }

  const leaves = (leaveData ?? []) as LeaveRow[];
  const leavesByEmployeeId = new Map<string, LeaveRow[]>();
  for (const leave of leaves) {
    if (!leavesByEmployeeId.has(leave.employee_id)) {
      leavesByEmployeeId.set(leave.employee_id, []);
    }
    leavesByEmployeeId.get(leave.employee_id)?.push(leave);
  }

  const { data: openSignalData, error: openSignalError } = await supabase
    .from("risk_signals")
    .select("id, subject_employee_id, resolved_at")
    .eq("tenant_id", params.tenantId)
    .eq("kind", "leave_conflict")
    .is("resolved_at", null);

  if (openSignalError) {
    throw new Error(`LEAVE_CONFLICT_SIGNAL_QUERY_FAILED: ${openSignalError.message}`);
  }

  const openSignals = (openSignalData ?? []) as RiskSignalRow[];
  const openByEmployeeId = new Map<string, RiskSignalRow>();
  for (const signal of openSignals) {
    if (signal.subject_employee_id) openByEmployeeId.set(signal.subject_employee_id, signal);
  }

  const desired = new Map<string, { count: number }>();
  for (const [employeeId, employeeLeaves] of leavesByEmployeeId.entries()) {
    const sorted = [...employeeLeaves].sort((a, b) => a.start_date.localeCompare(b.start_date));
    let count = 0;
    for (let index = 1; index < sorted.length; index += 1) {
      if (hasOverlap(sorted[index - 1] as LeaveRow, sorted[index] as LeaveRow)) {
        count += 1;
      }
    }
    if (count > 0) desired.set(employeeId, { count });
  }

  let createdSignals = 0;
  let updatedSignals = 0;
  let resolvedSignals = 0;

  for (const [employeeId, entry] of desired.entries()) {
    const existing = openByEmployeeId.get(employeeId);
    const evidence = {
      trigger_reason: "leave_conflict",
      subject_employee_id: employeeId,
      rule_version: "leave_conflict_v1",
      overlap_count: entry.count,
      what_is_wrong: `${entry.count} overlapping leave request${entry.count === 1 ? " was" : "s were"} found.`,
      why_it_matters: "Conflicting leave records can confuse approvals and planning coverage.",
      what_to_do_next: "View details and resolve the conflicting leave records.",
    };

    if (!existing) {
      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: "leave_conflict",
          trigger_reason: "leave_conflict",
          severity: "red",
          subject_employee_id: employeeId,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`LEAVE_CONFLICT_SIGNAL_CREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;
      const { error: actionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: employeeId,
          category: "leave_conflict",
          title: "Review leave conflict",
          suggested_action: "Review leave conflict",
          status: "open",
        } as never);

      if (actionError) {
        throw new Error(`LEAVE_CONFLICT_ACTION_CREATE_FAILED: ${actionError.message}`);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        tenant_id: params.tenantId,
        actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        action_type: "signal.leave_conflict.created",
        target_id: signalId,
      } as never);

      if (auditError) {
        throw new Error(`LEAVE_CONFLICT_AUDIT_CREATE_FAILED: ${auditError.message}`);
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
      throw new Error(`LEAVE_CONFLICT_SIGNAL_UPDATE_FAILED: ${updateSignalError.message}`);
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
      throw new Error(`LEAVE_CONFLICT_SIGNAL_RESOLVE_FAILED: ${resolveSignalError.message}`);
    }

    const { data: openActionItems, error: actionFindError } = await supabase
      .from("action_items")
      .select("id, risk_signal_id, status")
      .eq("tenant_id", params.tenantId)
      .eq("risk_signal_id", signal.id)
      .in("status", ["open", "in_progress"]);

    if (actionFindError) {
      throw new Error(`LEAVE_CONFLICT_ACTION_QUERY_FAILED: ${actionFindError.message}`);
    }

    for (const item of (openActionItems ?? []) as ActionItemRow[]) {
      const { error: actionResolveError } = await supabase
        .from("action_items")
        .update({ status: "done", resolved_at: nowIso } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", item.id)
        .in("status", ["open", "in_progress"]);

      if (actionResolveError) {
        throw new Error(`LEAVE_CONFLICT_ACTION_RESOLVE_FAILED: ${actionResolveError.message}`);
      }

      const { error: linkSignalError } = await supabase
        .from("risk_signals")
        .update({ resolution_action_item_id: item.id } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", signal.id);

      if (linkSignalError) {
        throw new Error(`LEAVE_CONFLICT_SIGNAL_LINK_ACTION_FAILED: ${linkSignalError.message}`);
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      action_type: "signal.leave_conflict.resolved",
      target_id: signal.id,
    } as never);

    if (auditError) {
      throw new Error(`LEAVE_CONFLICT_AUDIT_RESOLVE_FAILED: ${auditError.message}`);
    }

    resolvedSignals += 1;
  }

  return { scannedEmployees: leavesByEmployeeId.size, createdSignals, updatedSignals, resolvedSignals };
}