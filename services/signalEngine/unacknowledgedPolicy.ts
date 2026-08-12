import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";

import type { SignalSeverity } from "@/services/signalEngine/contracts";
import { CURRENT_EMPLOYEE_DB_LIFECYCLE_STATES } from "@/services/employeeLifecycle";

type EmployeeLifecycleState = "preboarding" | "active" | "on_leave" | "offboarding" | "exited";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  lifecycle_state: EmployeeLifecycleState;
  deleted_at: string | null;
};

type PolicyRow = {
  id: string;
  tenant_id: string;
  version: number;
  is_published: boolean;
  archived_at: string | null;
};

type AcknowledgementRow = {
  policy_id: string;
  policy_version: number;
  employee_id: string;
};

type RiskSignalRow = {
  id: string;
  kind: string;
  subject_employee_id: string | null;
  evidence?: { evidence_fingerprint?: string } | null;
  resolved_at: string | null;
};

type ActionItemRow = {
  id: string;
  risk_signal_id: string;
  status: string;
};

export type UnacknowledgedPolicyReconcileResult = {
  scannedEmployees: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

function policyFingerprint(missingPolicyKeys: string[]): string {
  return `unacknowledged_policy:${missingPolicyKeys.sort().join("|")}`;
}

export async function reconcileUnacknowledgedPolicySignals(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<UnacknowledgedPolicyReconcileResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceRoleClient();

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, lifecycle_state, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null)
    .in("lifecycle_state", CURRENT_EMPLOYEE_DB_LIFECYCLE_STATES as unknown as string[]);

  if (employeeError) {
    throw new Error(`UNACKNOWLEDGED_POLICY_EMPLOYEE_QUERY_FAILED: ${employeeError.message}`);
  }

  const employees = (employeeData ?? []) as EmployeeRow[];

  const { data: policyData, error: policyError } = await supabase
    .from("policies")
    .select("id, tenant_id, version, is_published, archived_at")
    .eq("tenant_id", params.tenantId)
    .eq("is_published", true)
    .is("archived_at", null);

  if (policyError) {
    throw new Error(`UNACKNOWLEDGED_POLICY_POLICY_QUERY_FAILED: ${policyError.message}`);
  }

  const policies = (policyData ?? []) as PolicyRow[];

  const { data: acknowledgementData, error: acknowledgementError } = await supabase
    .from("acknowledgements")
    .select("policy_id, policy_version, employee_id")
    .eq("tenant_id", params.tenantId);

  if (acknowledgementError) {
    throw new Error(`UNACKNOWLEDGED_POLICY_ACK_QUERY_FAILED: ${acknowledgementError.message}`);
  }

  const acknowledgements = (acknowledgementData ?? []) as AcknowledgementRow[];
  const acknowledgedKeys = new Set(
    acknowledgements.map((row) => `${row.employee_id}:${row.policy_id}:${row.policy_version}`),
  );

  const { data: openSignalData, error: openSignalError } = await supabase
    .from("risk_signals")
    .select("id, kind, subject_employee_id, evidence, resolved_at")
    .eq("tenant_id", params.tenantId)
    .eq("kind", "unacknowledged_policy")
    .is("resolved_at", null);

  if (openSignalError) {
    throw new Error(`UNACKNOWLEDGED_POLICY_SIGNAL_QUERY_FAILED: ${openSignalError.message}`);
  }

  const openSignals = (openSignalData ?? []) as RiskSignalRow[];
  const openByEmployeeId = new Map<string, RiskSignalRow>();
  for (const signal of openSignals) {
    if (signal.subject_employee_id) openByEmployeeId.set(signal.subject_employee_id, signal);
  }

  const desired = new Map<string, { severity: SignalSeverity; count: number; fingerprint: string }>();
  for (const employee of employees) {
    const missingPolicyKeys: string[] = [];
    for (const policy of policies) {
      if (!acknowledgedKeys.has(`${employee.id}:${policy.id}:${policy.version}`)) {
        missingPolicyKeys.push(`${policy.id}:${policy.version}`);
      }
    }
    const count = missingPolicyKeys.length;
    if (count <= 0) continue;
    const fingerprint = policyFingerprint(missingPolicyKeys);
    desired.set(employee.id, { severity: count > 1 ? "red" : "yellow", count, fingerprint });
  }

  let createdSignals = 0;
  let updatedSignals = 0;
  let resolvedSignals = 0;

  for (const [employeeId, entry] of desired.entries()) {
    const existing = openByEmployeeId.get(employeeId);
    const evidence = {
      trigger_reason: "unacknowledged_policy",
      subject_employee_id: employeeId,
      rule_version: "unacknowledged_policy_v1",
      evidence_fingerprint: entry.fingerprint,
      missing_policy_count: entry.count,
      what_is_wrong: `${entry.count} published polic${entry.count === 1 ? "y has" : "ies have"} not been acknowledged.`,
      why_it_matters: "Policy acceptance gaps weaken compliance proof and leave expectations unclear.",
      what_to_do_next: "View details and collect the missing acknowledgements.",
    };

    if (!existing) {
      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: "unacknowledged_policy",
          trigger_reason: "unacknowledged_policy",
          severity: entry.severity,
          subject_employee_id: employeeId,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`UNACKNOWLEDGED_POLICY_SIGNAL_CREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;
      const { error: insertActionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: employeeId,
          category: "unacknowledged_policy",
          title: "Collect policy acknowledgement",
          suggested_action: "Collect policy acknowledgement",
          status: "open",
        } as never);

      if (insertActionError) {
        throw new Error(`UNACKNOWLEDGED_POLICY_ACTION_CREATE_FAILED: ${insertActionError.message}`);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        tenant_id: params.tenantId,
        actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        action_type: "signal.unacknowledged_policy.created",
        target_id: signalId,
      } as never);

      if (auditError) {
        throw new Error(`UNACKNOWLEDGED_POLICY_AUDIT_CREATE_FAILED: ${auditError.message}`);
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
      throw new Error(`UNACKNOWLEDGED_POLICY_SIGNAL_UPDATE_FAILED: ${updateSignalError.message}`);
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
      throw new Error(`UNACKNOWLEDGED_POLICY_SIGNAL_RESOLVE_FAILED: ${resolveSignalError.message}`);
    }

    const { data: openActionItems, error: actionFindError } = await supabase
      .from("action_items")
      .select("id, risk_signal_id, status")
      .eq("tenant_id", params.tenantId)
      .eq("risk_signal_id", signal.id)
      .in("status", ["open", "in_progress"]);

    if (actionFindError) {
      throw new Error(`UNACKNOWLEDGED_POLICY_ACTION_QUERY_FAILED: ${actionFindError.message}`);
    }

    for (const item of (openActionItems ?? []) as ActionItemRow[]) {
      const { error: actionResolveError } = await supabase
        .from("action_items")
        .update({ status: "done", resolved_at: nowIso } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", item.id)
        .in("status", ["open", "in_progress"]);

      if (actionResolveError) {
        throw new Error(`UNACKNOWLEDGED_POLICY_ACTION_RESOLVE_FAILED: ${actionResolveError.message}`);
      }

      const { error: linkSignalError } = await supabase
        .from("risk_signals")
        .update({ resolution_action_item_id: item.id } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", signal.id);

      if (linkSignalError) {
        throw new Error(`UNACKNOWLEDGED_POLICY_SIGNAL_LINK_ACTION_FAILED: ${linkSignalError.message}`);
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      action_type: "signal.unacknowledged_policy.resolved",
      target_id: signal.id,
    } as never);

    if (auditError) {
      throw new Error(`UNACKNOWLEDGED_POLICY_AUDIT_RESOLVE_FAILED: ${auditError.message}`);
    }

    resolvedSignals += 1;
  }

  return { scannedEmployees: employees.length, createdSignals, updatedSignals, resolvedSignals };
}
