import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";

import type { SignalSeverity } from "@/services/signalEngine/contracts";
import type { LegacyEmployeeLifecycleState } from "@/services/employeeLifecycle";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  lifecycle_state: LegacyEmployeeLifecycleState;
  deleted_at: string | null;
};

type DocumentRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  subject_person_id: string | null;
  document_type: string | null;
  type: string | null;
  expires_at: string | null;
  deleted_at: string | null;
};

type RiskSignalRow = {
  id: string;
  tenant_id: string;
  kind: string;
  subject_document_id: string | null;
  resolved_at: string | null;
};

type ActionItemRow = {
  id: string;
  tenant_id: string;
  risk_signal_id: string;
  status: string;
};

type DesiredDocumentSignal = {
  document: DocumentRow;
  signalKind: "expiring_document" | "expired_document";
  severity: SignalSeverity;
  yellowWindowDays: number;
};

export type ExpiringDocumentReconcileResult = {
  scannedDocuments: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

function normalizeDocumentType(row: Pick<DocumentRow, "document_type" | "type">): string {
  const primary = (row.document_type ?? "").trim().toLowerCase();
  if (primary) return primary;
  return (row.type ?? "").trim().toLowerCase();
}

function getYellowWindowDays(documentType: string): number {
  if (documentType.includes("passport")) return 90;
  if (documentType.includes("emirates_id")) return 60;
  if (documentType.includes("labour_card")) return 60;
  if (documentType.includes("work_permit")) return 60;
  if (documentType.includes("residence_visa")) return 60;
  if (documentType.includes("schengen")) return 45;
  if (documentType.includes("certification")) return 60;
  if (documentType.includes("right_to_work")) return 60;
  return 30;
}

function getDocumentLabel(documentType: string): string {
  if (documentType.includes("passport")) return "passport";
  if (documentType.includes("emirates_id")) return "Emirates ID";
  if (documentType.includes("labour_card")) return "labour card";
  if (documentType.includes("work_permit")) return "work permit";
  if (documentType.includes("residence_visa")) return "residence visa";
  if (documentType.includes("schengen")) return "visa";
  if (documentType.includes("certification")) return "certification";
  if (documentType.includes("right_to_work")) return "right-to-work document";
  return "document";
}

function toUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function evaluateDocumentSignal(
  expiresAt: string,
  documentType: string,
  now: Date,
): { kind: "expiring_document" | "expired_document"; severity: SignalSeverity; yellowWindowDays: number } | null {
  const yellowWindowDays = getYellowWindowDays(documentType);
  const nowDay = toUtcDay(now);
  const expiresDay = toUtcDay(new Date(expiresAt));
  const daysUntilExpiry = Math.floor((expiresDay.getTime() - nowDay.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntilExpiry < 0) {
    return { kind: "expired_document", severity: "red", yellowWindowDays };
  }

  if (daysUntilExpiry <= yellowWindowDays) {
    return { kind: "expiring_document", severity: "yellow", yellowWindowDays };
  }

  return null;
}

function buildDesiredSignals(documents: DocumentRow[], employeesById: Map<string, EmployeeRow>, now: Date): DesiredDocumentSignal[] {
  const latestByPersonAndType = new Map<string, DocumentRow>();

  for (const doc of documents) {
    if (!doc.expires_at) continue;
    const subjectPersonId = doc.subject_person_id ?? doc.employee_id;
    const employee = employeesById.get(subjectPersonId);
    if (!employee) continue;
    if (employee.lifecycle_state === "exited") continue;

    const normalizedType = normalizeDocumentType(doc);
    const key = `${subjectPersonId}:${normalizedType}`;
    const current = latestByPersonAndType.get(key);
    if (!current) {
      latestByPersonAndType.set(key, doc);
      continue;
    }

    const currentExpiry = current.expires_at ? new Date(current.expires_at).getTime() : -Infinity;
    const nextExpiry = new Date(doc.expires_at).getTime();
    if (nextExpiry > currentExpiry) {
      latestByPersonAndType.set(key, doc);
    }
  }

  const desired: DesiredDocumentSignal[] = [];
  for (const doc of latestByPersonAndType.values()) {
    const documentType = normalizeDocumentType(doc);
    if (!doc.expires_at) continue;
    const evaluated = evaluateDocumentSignal(doc.expires_at, documentType, now);
    if (!evaluated) continue;

    desired.push({
      document: doc,
      signalKind: evaluated.kind,
      severity: evaluated.severity,
      yellowWindowDays: evaluated.yellowWindowDays,
    });
  }

  return desired;
}

export async function reconcileExpiringDocumentSignals(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<ExpiringDocumentReconcileResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const supabase = createServiceRoleClient();

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, lifecycle_state, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null);

  if (employeeError) {
    throw new Error(`EXPIRING_DOCUMENT_EMPLOYEE_QUERY_FAILED: ${employeeError.message}`);
  }

  const employees = (employeeData ?? []) as EmployeeRow[];
  const employeesById = new Map(employees.map((row) => [row.id, row]));

  const { data: docData, error: docError } = await supabase
    .from("documents")
    .select("id, tenant_id, employee_id, subject_person_id, document_type, type, expires_at, deleted_at")
    .eq("tenant_id", params.tenantId)
    .is("deleted_at", null)
    .not("expires_at", "is", null);

  if (docError) {
    throw new Error(`EXPIRING_DOCUMENT_QUERY_FAILED: ${docError.message}`);
  }

  const documents = (docData ?? []) as DocumentRow[];

  const desiredSignals = buildDesiredSignals(documents, employeesById, now);
  const desiredByDocumentId = new Map<string, DesiredDocumentSignal>();
  for (const signal of desiredSignals) {
    desiredByDocumentId.set(signal.document.id, signal);
  }

  const { data: openSignalData, error: openSignalError } = await supabase
    .from("risk_signals")
    .select("id, tenant_id, kind, subject_document_id, resolved_at")
    .eq("tenant_id", params.tenantId)
    .in("kind", ["expiring_document", "expired_document"])
    .is("resolved_at", null);

  if (openSignalError) {
    throw new Error(`EXPIRING_DOCUMENT_SIGNAL_QUERY_FAILED: ${openSignalError.message}`);
  }

  const openSignals = (openSignalData ?? []) as RiskSignalRow[];
  const openByDocumentId = new Map<string, RiskSignalRow>();
  for (const signal of openSignals) {
    if (signal.subject_document_id) {
      openByDocumentId.set(signal.subject_document_id, signal);
    }
  }

  let createdSignals = 0;
  let updatedSignals = 0;
  let resolvedSignals = 0;

  for (const desired of desiredSignals) {
    const doc = desired.document;
    const existing = openByDocumentId.get(doc.id);
    const docType = normalizeDocumentType(doc);
    const docLabel = getDocumentLabel(docType);
    const actionText = desired.signalKind === "expired_document"
      ? `Upload renewed ${docLabel}`
      : `Request renewal for ${docLabel}`;

    const evidence = {
      rule_version: "expiring_document_v1",
      trigger_reason: desired.signalKind,
      subject_document_id: doc.id,
      subject_employee_id: doc.employee_id,
      expires_at: doc.expires_at,
      yellow_window_days: desired.yellowWindowDays,
      what_is_wrong: desired.signalKind === "expired_document"
        ? `${docLabel} is expired.`
        : `${docLabel} is expiring soon.`,
      why_it_matters: "This can block operations and create compliance risk for the company.",
      what_to_do_next: actionText,
    };

    if (!existing) {
      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: desired.signalKind,
          trigger_reason: desired.signalKind,
          severity: desired.severity,
          subject_employee_id: doc.employee_id,
          subject_document_id: doc.id,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`EXPIRING_DOCUMENT_SIGNAL_CREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;

      const { error: actionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: doc.employee_id,
          category: desired.signalKind,
          title: actionText,
          suggested_action: actionText,
          status: "open",
        } as never);

      if (actionError) {
        throw new Error(`EXPIRING_DOCUMENT_ACTION_CREATE_FAILED: ${actionError.message}`);
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        tenant_id: params.tenantId,
        actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        action_type: `signal.${desired.signalKind}.created`,
        target_id: signalId,
      } as never);

      if (auditError) {
        throw new Error(`EXPIRING_DOCUMENT_AUDIT_CREATE_FAILED: ${auditError.message}`);
      }

      createdSignals += 1;
      continue;
    }

    if (existing.kind !== desired.signalKind) {
      const { error: resolveOldError } = await supabase
        .from("risk_signals")
        .update({ resolved_at: nowIso, last_seen_at: nowIso } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", existing.id)
        .is("resolved_at", null);

      if (resolveOldError) {
        throw new Error(`EXPIRING_DOCUMENT_OLD_SIGNAL_RESOLVE_FAILED: ${resolveOldError.message}`);
      }

      const { data: oldActionItems, error: oldActionQueryError } = await supabase
        .from("action_items")
        .select("id, tenant_id, risk_signal_id, status")
        .eq("tenant_id", params.tenantId)
        .eq("risk_signal_id", existing.id)
        .in("status", ["open", "in_progress"]);

      if (oldActionQueryError) {
        throw new Error(`EXPIRING_DOCUMENT_OLD_ACTION_QUERY_FAILED: ${oldActionQueryError.message}`);
      }

      for (const item of (oldActionItems ?? []) as ActionItemRow[]) {
        const { error: oldActionResolveError } = await supabase
          .from("action_items")
          .update({ status: "done", resolved_at: nowIso } as never)
          .eq("tenant_id", params.tenantId)
          .eq("id", item.id)
          .in("status", ["open", "in_progress"]);

        if (oldActionResolveError) {
          throw new Error(`EXPIRING_DOCUMENT_OLD_ACTION_RESOLVE_FAILED: ${oldActionResolveError.message}`);
        }
      }

      const { data: insertedSignal, error: insertSignalError } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: params.tenantId,
          kind: desired.signalKind,
          trigger_reason: desired.signalKind,
          severity: desired.severity,
          subject_employee_id: doc.employee_id,
          subject_document_id: doc.id,
          evidence,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        } as never)
        .select("id")
        .single();

      if (insertSignalError || !insertedSignal) {
        throw new Error(`EXPIRING_DOCUMENT_SIGNAL_RECREATE_FAILED: ${insertSignalError?.message ?? "no row"}`);
      }

      const signalId = (insertedSignal as { id: string }).id;

      const { error: actionError } = await supabase
        .from("action_items")
        .insert({
          tenant_id: params.tenantId,
          risk_signal_id: signalId,
          subject_employee_id: doc.employee_id,
          category: desired.signalKind,
          title: actionText,
          suggested_action: actionText,
          status: "open",
        } as never);

      if (actionError) {
        throw new Error(`EXPIRING_DOCUMENT_ACTION_RECREATE_FAILED: ${actionError.message}`);
      }

      updatedSignals += 1;
      continue;
    }

    const { error: updateSignalError } = await supabase
      .from("risk_signals")
      .update({
        severity: desired.severity,
        evidence,
        last_seen_at: nowIso,
      } as never)
      .eq("tenant_id", params.tenantId)
      .eq("id", existing.id)
      .is("resolved_at", null);

    if (updateSignalError) {
      throw new Error(`EXPIRING_DOCUMENT_SIGNAL_UPDATE_FAILED: ${updateSignalError.message}`);
    }

    updatedSignals += 1;
  }

  for (const signal of openSignals) {
    if (!signal.subject_document_id) continue;
    if (desiredByDocumentId.has(signal.subject_document_id)) continue;

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
      throw new Error(`EXPIRING_DOCUMENT_SIGNAL_RESOLVE_FAILED: ${resolveSignalError.message}`);
    }

    const { data: openActionItems, error: actionFindError } = await supabase
      .from("action_items")
      .select("id, tenant_id, risk_signal_id, status")
      .eq("tenant_id", params.tenantId)
      .eq("risk_signal_id", signal.id)
      .in("status", ["open", "in_progress"]);

    if (actionFindError) {
      throw new Error(`EXPIRING_DOCUMENT_ACTION_QUERY_FAILED: ${actionFindError.message}`);
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
        throw new Error(`EXPIRING_DOCUMENT_ACTION_RESOLVE_FAILED: ${actionResolveError.message}`);
      }

      const { error: linkSignalError } = await supabase
        .from("risk_signals")
        .update({ resolution_action_item_id: item.id } as never)
        .eq("tenant_id", params.tenantId)
        .eq("id", signal.id);

      if (linkSignalError) {
        throw new Error(`EXPIRING_DOCUMENT_SIGNAL_LINK_ACTION_FAILED: ${linkSignalError.message}`);
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId ?? "00000000-0000-0000-0000-000000000000",
      action_type: `signal.${signal.kind}.resolved`,
      target_id: signal.id,
    } as never);

    if (auditError) {
      throw new Error(`EXPIRING_DOCUMENT_AUDIT_RESOLVE_FAILED: ${auditError.message}`);
    }

    resolvedSignals += 1;
  }

  return {
    scannedDocuments: documents.length,
    createdSignals,
    updatedSignals,
    resolvedSignals,
  };
}
