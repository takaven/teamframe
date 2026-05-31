import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type SignalSeverity = "red" | "yellow";

type EmployeeLifecycleState = "preboarding" | "active" | "exited";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  lifecycle_state: EmployeeLifecycleState;
  start_date: string | null;
  deleted_at: string | null;
};

type ContractDocRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  subject_person_id: string | null;
  signed_at: string | null;
  document_type: string | null;
  type: string | null;
  deleted_at: string | null;
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

export type MissingContractReconcileResult = {
  scannedEmployees: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

function parseDateOnly(value: string): Date {
  const parts = value.split("-").map((part) => Number(part));
  const year = Number.isFinite(parts[0]) ? (parts[0] as number) : 1970;
  const month = Number.isFinite(parts[1]) ? (parts[1] as number) : 1;
  const day = Number.isFinite(parts[2]) ? (parts[2] as number) : 1;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function daysFromNow(startDate: string, now: Date): number {
  const start = parseDateOnly(startDate);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  return Math.floor((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function isContractDoc(row: ContractDocRow): boolean {
  const normalizedDocumentType = (row.document_type ?? "").toLowerCase();
  const normalizedLegacyType = (row.type ?? "").toLowerCase();
  return normalizedDocumentType === "contract" || normalizedLegacyType === "contract";
}

function hasFreshSignedContract(employee: EmployeeRow, docs: ContractDocRow[]): boolean {
  const startDate = employee.start_date ? parseDateOnly(employee.start_date) : null;
  const validDocs = docs.filter((doc) => {
    if (!doc.signed_at) return false;
    if (!isContractDoc(doc)) return false;
    return (doc.subject_person_id ?? doc.employee_id) === employee.id;
  });

  if (validDocs.length === 0) return false;
  if (!startDate) return true;

  const threshold = new Date(startDate);
  threshold.setUTCDate(threshold.getUTCDate() - 60);

  return validDocs.some((doc) => new Date(doc.signed_at as string) >= threshold);
}

export function evaluateMissingContractSeverity(
  employee: Pick<EmployeeRow, "lifecycle_state" | "start_date">,
  hasSignedContract: boolean,
  now: Date = new Date(),
): SignalSeverity | null {
  if (hasSignedContract) return null;
  if (employee.lifecycle_state === "exited") return null;

  if (employee.lifecycle_state === "active") {
    return "red";
  }

  if (employee.lifecycle_state === "preboarding") {
    if (!employee.start_date) return "red";
    const daysUntilStart = daysFromNow(employee.start_date, now);
    return daysUntilStart >= 7 ? "yellow" : "red";
  }

  return null;
}

export async function reconcileMissingContractSignals(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<MissingContractReconcileResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceRoleClient();

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, lifecycle_state, start_date, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null);

  if (employeeError) {
    throw new Error(`MISSING_CONTRACT_EMPLOYEE_QUERY_FAILED: ${employeeError.message}`);
  }

  const employees = (employeeData ?? []) as EmployeeRow[];

  const { data: docData, error: docError } = await supabase
    .from("documents")
    .select("id, tenant_id, employee_id, subject_person_id, signed_at, document_type, type, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null)
    .not("signed_at", "is", null);

  if (docError) {
    throw new Error(`MISSING_CONTRACT_DOCUMENT_QUERY_FAILED: ${docError.message}`);
  }

  const docs = (docData ?? []) as ContractDocRow[];

  const { data: openSignalData, error: openSignalError } = await supabase
    .from("risk_signals")
    .select("id, tenant_id, kind, severity, subject_employee_id, resolved_at")
    .eq("tenant_id", params.tenantId)
    .eq("kind", "missing_contract")
    .is("resolved_at", null);

  if (openSignalError) {
    throw new Error(`MISSING_CONTRACT_SIGNAL_QUERY_FAILED: ${openSignalError.message}`);
  }

  const openSignals = (openSignalData ?? []) as RiskSignalRow[];
  const openByEmployeeId = new Map<string, RiskSignalRow>();
  for (const signal of openSignals) {
    if (signal.subject_employee_id) {
      openByEmployeeId.set(signal.subject_employee_id, signal);
    }
  }

  const desired = new Map<string, SignalSeverity>();
  for (const employee of employees) {
    const severity = evaluateMissingContractSeverity(
      employee,
      hasFreshSignedContract(employee, docs),
      now,
    );
    if (severity) {
      desired.set(employee.id, severity);
    }
  }

  let createdSignals = 0;
  let updatedSignals = 0;
  let resolvedSignals = 0;

  for (const [employeeId, severity] of desired.entries()) {
    const existing = openByEmployeeId.get(employeeId);
    const evidence = {
      trigger_reason: "missing_contract",
      subject_employee_id: employeeId,
      rule_version: "missing_contract_v1",
      severity,
    };

    if (!existing) {
      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: "missing_contract",
          trigger_reason: "missing_contract",
          severity,
          subject_employee_id: employeeId,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`MISSING_CONTRACT_SIGNAL_CREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;

      const { error: insertActionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: employeeId,
          category: "missing_contract",
          title: "Upload signed contract",
          suggested_action: "Upload signed contract",
          status: "open",
        } as never);

      if (insertActionError) {
        throw new Error(`MISSING_CONTRACT_ACTION_CREATE_FAILED: ${insertActionError.message}`);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        tenant_id: params.tenantId,
        actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        action_type: "signal.missing_contract.created",
        target_id: signalId,
      } as never);

      if (auditError) {
        throw new Error(`MISSING_CONTRACT_AUDIT_CREATE_FAILED: ${auditError.message}`);
      }

      createdSignals += 1;
      continue;
    }

    const { error: updateSignalError } = await supabase
      .from("risk_signals")
      .update({
        severity,
        evidence,
        last_seen_at: nowIso,
      } as never)
      .eq("tenant_id", params.tenantId)
      .eq("id", existing.id)
      .is("resolved_at", null);

    if (updateSignalError) {
      throw new Error(`MISSING_CONTRACT_SIGNAL_UPDATE_FAILED: ${updateSignalError.message}`);
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
      throw new Error(`MISSING_CONTRACT_SIGNAL_RESOLVE_FAILED: ${resolveSignalError.message}`);
    }

    const { data: openActionItems, error: actionFindError } = await supabase
      .from("action_items")
      .select("id, tenant_id, risk_signal_id, status, resolved_at")
      .eq("tenant_id", params.tenantId)
      .eq("risk_signal_id", signal.id)
      .in("status", ["open", "in_progress"]);

    if (actionFindError) {
      throw new Error(`MISSING_CONTRACT_ACTION_QUERY_FAILED: ${actionFindError.message}`);
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
        throw new Error(`MISSING_CONTRACT_ACTION_RESOLVE_FAILED: ${actionResolveError.message}`);
      }

      const { error: linkSignalError } = await supabase
        .from("risk_signals")
        .update({ resolution_action_item_id: item.id } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", signal.id);

      if (linkSignalError) {
        throw new Error(`MISSING_CONTRACT_SIGNAL_LINK_ACTION_FAILED: ${linkSignalError.message}`);
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      action_type: "signal.missing_contract.resolved",
      target_id: signal.id,
    } as never);

    if (auditError) {
      throw new Error(`MISSING_CONTRACT_AUDIT_RESOLVE_FAILED: ${auditError.message}`);
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
