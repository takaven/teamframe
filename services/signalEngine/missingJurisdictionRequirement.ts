import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";

import type { SignalSeverity } from "@/services/signalEngine/missingContract";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  country: string | null;
  lifecycle_state: "preboarding" | "active" | "on_leave" | "offboarding" | "exited";
  deleted_at: string | null;
};

type DocumentRow = {
  id: string;
  employee_id: string;
  subject_person_id: string | null;
  document_type: string | null;
  type: string | null;
  deleted_at: string | null;
};

type RiskSignalRow = { id: string; subject_employee_id: string | null; resolved_at: string | null };
type ActionItemRow = { id: string; risk_signal_id: string; status: string };

function normalizeDocumentType(row: Pick<DocumentRow, "document_type" | "type">): string {
  const primary = (row.document_type ?? "").trim().toLowerCase();
  return primary || (row.type ?? "").trim().toLowerCase();
}

function getRequiredDocumentForCountry(country: string): string {
  const normalized = country.trim().toLowerCase();
  if (normalized === "uae" || normalized === "united arab emirates" || normalized === "ae") return "emirates_id";
  if (normalized === "uk" || normalized === "united kingdom" || normalized === "gb") return "right_to_work";
  if (normalized === "singapore" || normalized === "sg") return "work_permit";
  if (normalized === "hong kong" || normalized === "hk") return "work_permit";
  if (normalized === "mauritius" || normalized === "mu") return "residence_visa";
  return "passport";
}

function formatDocumentLabel(documentType: string): string {
  return documentType.replace(/_/g, " ");
}

export type MissingJurisdictionRequirementReconcileResult = {
  scannedEmployees: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

export async function reconcileMissingJurisdictionRequirementSignals(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<MissingJurisdictionRequirementReconcileResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceRoleClient();

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, country, lifecycle_state, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null)
    .not("country", "is", null)
    .in("lifecycle_state", ["preboarding", "active", "on_leave", "offboarding"]);

  if (employeeError) {
    throw new Error(`MISSING_JURISDICTION_REQUIREMENT_EMPLOYEE_QUERY_FAILED: ${employeeError.message}`);
  }

  const employees = (employeeData ?? []) as EmployeeRow[];

  const { data: documentData, error: documentError } = await supabase
    .from("documents")
    .select("id, employee_id, subject_person_id, document_type, type, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null);

  if (documentError) {
    throw new Error(`MISSING_JURISDICTION_REQUIREMENT_DOCUMENT_QUERY_FAILED: ${documentError.message}`);
  }

  const documents = (documentData ?? []) as DocumentRow[];
  const documentTypesByEmployeeId = new Map<string, Set<string>>();
  for (const doc of documents) {
    const employeeId = doc.subject_person_id ?? doc.employee_id;
    const normalizedType = normalizeDocumentType(doc);
    if (!documentTypesByEmployeeId.has(employeeId)) {
      documentTypesByEmployeeId.set(employeeId, new Set<string>());
    }
    documentTypesByEmployeeId.get(employeeId)?.add(normalizedType);
  }

  const { data: openSignalData, error: openSignalError } = await supabase
    .from("risk_signals")
    .select("id, subject_employee_id, resolved_at")
    .eq("tenant_id", params.tenantId)
    .eq("kind", "missing_jurisdiction_requirement")
    .is("resolved_at", null);

  if (openSignalError) {
    throw new Error(`MISSING_JURISDICTION_REQUIREMENT_SIGNAL_QUERY_FAILED: ${openSignalError.message}`);
  }

  const openSignals = (openSignalData ?? []) as RiskSignalRow[];
  const openByEmployeeId = new Map<string, RiskSignalRow>();
  for (const signal of openSignals) {
    if (signal.subject_employee_id) openByEmployeeId.set(signal.subject_employee_id, signal);
  }

  const desired = new Map<string, { severity: SignalSeverity; requiredDocument: string; country: string }>();
  for (const employee of employees) {
    const country = employee.country?.trim();
    if (!country) continue;
    const requiredDocument = getRequiredDocumentForCountry(country);
    const docs = documentTypesByEmployeeId.get(employee.id) ?? new Set<string>();
    if (docs.has(requiredDocument)) continue;
    desired.set(employee.id, {
      severity: employee.lifecycle_state === "active" || employee.lifecycle_state === "offboarding" ? "red" : "yellow",
      requiredDocument,
      country,
    });
  }

  let createdSignals = 0;
  let updatedSignals = 0;
  let resolvedSignals = 0;

  for (const [employeeId, entry] of desired.entries()) {
    const existing = openByEmployeeId.get(employeeId);
    const label = formatDocumentLabel(entry.requiredDocument);
    const evidence = {
      trigger_reason: "missing_jurisdiction_requirement",
      subject_employee_id: employeeId,
      rule_version: "missing_jurisdiction_requirement_v1",
      country: entry.country,
      required_document: entry.requiredDocument,
      what_is_wrong: `The required ${label} for ${entry.country} is missing.`,
      why_it_matters: "Jurisdiction-specific document gaps can block work authorization and compliance readiness.",
      what_to_do_next: `Open record and upload the required ${label}.`,
    };

    if (!existing) {
      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: "missing_jurisdiction_requirement",
          trigger_reason: "missing_jurisdiction_requirement",
          severity: entry.severity,
          subject_employee_id: employeeId,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`MISSING_JURISDICTION_REQUIREMENT_SIGNAL_CREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;
      const { error: actionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: employeeId,
          category: "missing_jurisdiction_requirement",
          title: `Upload ${label}`,
          suggested_action: `Upload ${label}`,
          status: "open",
        } as never);

      if (actionError) {
        throw new Error(`MISSING_JURISDICTION_REQUIREMENT_ACTION_CREATE_FAILED: ${actionError.message}`);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        tenant_id: params.tenantId,
        actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        action_type: "signal.missing_jurisdiction_requirement.created",
        target_id: signalId,
      } as never);

      if (auditError) {
        throw new Error(`MISSING_JURISDICTION_REQUIREMENT_AUDIT_CREATE_FAILED: ${auditError.message}`);
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
      throw new Error(`MISSING_JURISDICTION_REQUIREMENT_SIGNAL_UPDATE_FAILED: ${updateSignalError.message}`);
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
      throw new Error(`MISSING_JURISDICTION_REQUIREMENT_SIGNAL_RESOLVE_FAILED: ${resolveSignalError.message}`);
    }

    const { data: openActionItems, error: actionFindError } = await supabase
      .from("action_items")
      .select("id, risk_signal_id, status")
      .eq("tenant_id", params.tenantId)
      .eq("risk_signal_id", signal.id)
      .in("status", ["open", "in_progress"]);

    if (actionFindError) {
      throw new Error(`MISSING_JURISDICTION_REQUIREMENT_ACTION_QUERY_FAILED: ${actionFindError.message}`);
    }

    for (const item of (openActionItems ?? []) as ActionItemRow[]) {
      const { error: actionResolveError } = await supabase
        .from("action_items")
        .update({ status: "done", resolved_at: nowIso } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", item.id)
        .in("status", ["open", "in_progress"]);

      if (actionResolveError) {
        throw new Error(`MISSING_JURISDICTION_REQUIREMENT_ACTION_RESOLVE_FAILED: ${actionResolveError.message}`);
      }

      const { error: linkSignalError } = await supabase
        .from("risk_signals")
        .update({ resolution_action_item_id: item.id } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", signal.id);

      if (linkSignalError) {
        throw new Error(`MISSING_JURISDICTION_REQUIREMENT_SIGNAL_LINK_ACTION_FAILED: ${linkSignalError.message}`);
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      action_type: "signal.missing_jurisdiction_requirement.resolved",
      target_id: signal.id,
    } as never);

    if (auditError) {
      throw new Error(`MISSING_JURISDICTION_REQUIREMENT_AUDIT_RESOLVE_FAILED: ${auditError.message}`);
    }

    resolvedSignals += 1;
  }

  return { scannedEmployees: employees.length, createdSignals, updatedSignals, resolvedSignals };
}